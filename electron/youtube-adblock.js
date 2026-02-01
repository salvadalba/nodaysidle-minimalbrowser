/**
 * YouTube Ad Blocker Content Script
 * Injected into YouTube pages to handle video ads
 *
 * Balanced approach: Strong blocking without breaking playback
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__youtubeAdBlockerInjected) return;
  window.__youtubeAdBlockerInjected = true;

  const CONFIG = {
    skipDelay: 300,           // Delay before clicking skip (ms)
    checkInterval: 1000,      // How often to check for ads (ms)
    adSpeedMultiplier: 16,    // Speed up unskippable ads
    debug: false,             // Set to true for console logs
  };

  let originalPlaybackRate = 1;
  let originalMuted = false;
  let isProcessingAd = false;
  let lastAdState = false;

  function log(...args) {
    if (CONFIG.debug) {
      console.log('[YT-AdBlock]', ...args);
    }
  }

  /**
   * CSS selectors for ad elements
   */
  const AD_SELECTORS = {
    // Video ad overlays
    skipButton: '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern',
    adOverlay: '.ytp-ad-overlay-slot, .ytp-ad-overlay-container',
    adModule: '.video-ads.ytp-ad-module',
    adText: '.ytp-ad-text, .ytp-ad-preview-text',

    // Page ads
    mastheadAd: '#masthead-ad, ytd-display-ad-renderer, ytd-primetime-promo-renderer',
    companionAd: '#companion, #player-ads, .ytd-companion-slot-renderer',
    inFeedAd: 'ytd-in-feed-ad-layout-renderer, ytd-ad-slot-renderer, ytd-banner-promo-renderer',
    promotedVideo: 'ytd-promoted-sparkles-web-renderer',

    // Sidebar and misc ads
    sidebarAd: '#related ytd-ad-slot-renderer, .ytd-merch-shelf-renderer',
    popupAd: 'tp-yt-paper-dialog.ytd-popup-container',
    surveyAd: '.ytd-enforcement-message-view-model',
  };

  /**
   * Check if video player is showing an ad (strict check)
   */
  function isVideoAd() {
    const player = document.querySelector('.html5-video-player');
    if (!player) return false;

    // Only trust the ad-showing class - this is the definitive indicator
    return player.classList.contains('ad-showing');
  }

  /**
   * Click the skip button if available
   */
  function trySkipAd() {
    const skipButtons = document.querySelectorAll(AD_SELECTORS.skipButton);

    for (const button of skipButtons) {
      // Check if button is visible and clickable
      if (button && button.offsetParent !== null && !button.disabled) {
        const style = window.getComputedStyle(button);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          log('Clicking skip button');
          button.click();
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Speed up unskippable ads
   */
  function handleUnskippableAd() {
    const video = document.querySelector('video.html5-main-video');
    if (!video) return;

    // Only save original state once when ad starts
    if (!isProcessingAd) {
      isProcessingAd = true;
      originalPlaybackRate = video.playbackRate || 1;
      originalMuted = video.muted;
      log('Ad detected - speeding up (original rate:', originalPlaybackRate, ')');
    }

    // Speed up and mute
    if (video.playbackRate !== CONFIG.adSpeedMultiplier) {
      video.playbackRate = CONFIG.adSpeedMultiplier;
    }
    if (!video.muted) {
      video.muted = true;
    }
  }

  /**
   * Restore normal playback after ad
   */
  function restorePlayback() {
    if (!isProcessingAd) return;

    const video = document.querySelector('video.html5-main-video');
    if (!video) return;

    log('Ad ended - restoring playback (rate:', originalPlaybackRate, ')');

    // Restore original state
    video.playbackRate = originalPlaybackRate;
    video.muted = originalMuted;
    isProcessingAd = false;
  }

  /**
   * Remove ad overlay elements from DOM
   */
  function removeAdOverlays() {
    document.querySelectorAll(AD_SELECTORS.adOverlay).forEach(el => {
      if (el.style.display !== 'none') {
        el.style.display = 'none';
        log('Hidden ad overlay');
      }
    });
  }

  /**
   * Remove page ads (non-video ads)
   */
  function removePageAds() {
    const pageAdSelectors = [
      AD_SELECTORS.mastheadAd,
      AD_SELECTORS.companionAd,
      AD_SELECTORS.inFeedAd,
      AD_SELECTORS.promotedVideo,
      AD_SELECTORS.sidebarAd,
      AD_SELECTORS.surveyAd,
    ].join(', ');

    document.querySelectorAll(pageAdSelectors).forEach(el => {
      if (el && el.parentNode) {
        el.remove();
        log('Removed page ad element');
      }
    });
  }

  /**
   * Main ad check and removal function
   */
  function processAds() {
    const currentAdState = isVideoAd();

    // Handle video ads
    if (currentAdState) {
      // First try to skip
      if (!trySkipAd()) {
        // If can't skip, speed through it
        handleUnskippableAd();
      }
      removeAdOverlays();
    } else if (lastAdState && !currentAdState) {
      // Ad just ended - restore normal playback
      restorePlayback();
    }

    lastAdState = currentAdState;

    // Always remove page ads
    removePageAds();
  }

  /**
   * Setup MutationObserver to detect ad-showing class changes
   */
  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target;
          // Only react to player class changes
          if (target.classList && target.classList.contains('html5-video-player')) {
            processAds();
            break;
          }
        }

        // Check for new ad elements being added
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              const tagName = node.tagName?.toLowerCase() || '';
              if (tagName === 'ytd-ad-slot-renderer' ||
                  tagName === 'ytd-in-feed-ad-layout-renderer' ||
                  tagName === 'ytd-display-ad-renderer') {
                removePageAds();
                break;
              }
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    log('MutationObserver started');
    return observer;
  }

  /**
   * Inject CSS to hide ads immediately (before JS runs)
   */
  function injectAdBlockCSS() {
    if (document.getElementById('yt-adblock-css')) return;

    const style = document.createElement('style');
    style.id = 'yt-adblock-css';
    style.textContent = `
      /* Hide video ad overlays */
      .ytp-ad-overlay-slot,
      .ytp-ad-overlay-container,
      .ytp-ad-text,
      .ytp-ad-preview-text,
      .ytp-ad-skip-button-slot {
        display: none !important;
      }

      /* Hide page ads */
      #masthead-ad,
      ytd-display-ad-renderer,
      ytd-ad-slot-renderer,
      ytd-in-feed-ad-layout-renderer,
      ytd-banner-promo-renderer,
      ytd-promoted-sparkles-web-renderer,
      ytd-primetime-promo-renderer,
      #player-ads,
      .ytd-merch-shelf-renderer,
      ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"] {
        display: none !important;
      }

      /* Hide "Ad" badges */
      .ytp-ad-badge,
      .ytd-badge-supported-renderer[aria-label="Ad"] {
        display: none !important;
      }

      /* Hide premium upsells */
      ytd-mealbar-promo-renderer,
      tp-yt-paper-dialog.ytd-popup-container:has(yt-upsell-dialog-renderer) {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
    log('Injected ad-block CSS');
  }

  /**
   * Initialize the ad blocker
   */
  function init() {
    log('Initializing YouTube Ad Blocker');

    // Inject CSS first (fastest)
    injectAdBlockCSS();

    // Setup observer for DOM changes
    setupObserver();

    // Run initial check
    processAds();

    // Backup interval check (less frequent)
    setInterval(processAds, CONFIG.checkInterval);

    log('YouTube Ad Blocker active');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
