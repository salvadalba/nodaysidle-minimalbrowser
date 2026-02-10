/**
 * Drift Browser - Electron Main Process
 * Handles window management, BrowserViews for web content, and IPC
 */

const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('./database');
const TabManager = require('./tabs');

// Load YouTube ad-block content script
let youtubeAdBlockScript = '';
try {
  youtubeAdBlockScript = fs.readFileSync(path.join(__dirname, 'youtube-adblock.js'), 'utf8');
} catch (e) {
  console.error('Failed to load YouTube ad-block script:', e);
}

// Keep references to prevent garbage collection
let mainWindow = null;
let tabViews = new Map(); // Map of tabId -> BrowserView
let db = null;
let tabManager = null;

// Layout constants
const HEADER_HEIGHT = 80;
const SIDEBAR_WIDTH = 280;
let sidebarOpen = false;

// Ad blocking
let adsBlocked = 0;
let youtubeAdsBlocked = 0;

// Structured ad patterns for optimized matching
const AD_PATTERNS = {
  // Exact domain matches (O(1) lookup with Set)
  // Includes base domains - we check if hostname ends with these
  domains: new Set([
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'google-analytics.com',
    'googletagmanager.com',
    'googletagservices.com',
    'connect.facebook.net',
    'amazon-adsystem.com',
    'adsymptotic.com',
    'adnxs.com',
    'adzerk.net',
    'pubmatic.com',
    'rubiconproject.com',
    'scorecardresearch.com',
    'taboola.com',
    'outbrain.com',
    'criteo.com',
    'criteo.net',
    'moatads.com',
    'bluekai.com',
    'exelator.com',
    'quantserve.com',
    'rlcdn.com',
    'sharethis.com',
    'addthis.com',
    'eyeota.net',
    'adsrvr.org',
    'adform.net',
    'serving-sys.com',
    'mathtag.com',
    'openx.net',
    'casalemedia.com',
    'contextweb.com',
    'lijit.com',
    'intentiq.com',
    'bidswitch.net',
    'justpremium.com',
    'smartadserver.com',
    'adservice.google.com',
  ]),

  // YouTube-specific patterns (checked only on youtube.com)
  youtube: [
    'ads.youtube.com',
    '/pagead/',
    '/ptracking',
    '/api/stats/ads',
    '/api/stats/watchtime',
    '/api/stats/playback',
    '/api/stats/qoe',
    '/api/stats/atr',
    '/api/stats/delayplay',
    '/get_midroll_info',
    '/get_video_info',
    '/youtubei/v1/log_event',
    '/youtubei/v1/player/ad',
    '/pagead/viewthroughconversion',
    '/pcs/activeview',
    'youtube.com/api/stats',
    '/generate_204',
    '/youtubei/v1/att',
    'youtube.com/sw.js_data',
    'i.ytimg.com/an_webp/',
    'i.ytimg.com/an/',
    '/ad_status',
    'yt3.ggpht.com/a/default',
  ],

  // Facebook tracking
  facebook: [
    'facebook.com/tr',
    'facebook.com/plugins',
    'fbcdn.net/signals',
  ],

  // Regex patterns (for complex matching)
  regex: [
    /\/ads?\//i,
    /\/advert/i,
    /[\?&]ad[_=]/i,
    /\/sponsored/i,
    /\/tracker/i,
    /\/pixel\./i,
    /\/beacon/i,
    /\/telemetry/i,
    /\/analytics\.js/i,
    /\/gtag\//i,
  ],

  // Generic path patterns
  paths: [
    'adsserver.',
    'adserver.',
    '.ads.',
    '/banner',
    '/popunder',
    '/popup_',
    'tracking.',
    'tracker.',
    'advertising.',
    '/promo/',
  ],
};

/**
 * Check if hostname matches any ad domain via suffix matching (true O(1))
 * e.g. "pagead2.googlesyndication.com" matches "googlesyndication.com"
 */
function matchesDomain(hostname) {
  const parts = hostname.split('.');
  // Check progressively shorter suffixes: a.b.c.com -> b.c.com -> c.com
  for (let i = 0; i < parts.length - 1; i++) {
    const suffix = parts.slice(i).join('.');
    if (AD_PATTERNS.domains.has(suffix)) return true;
  }
  return false;
}

/**
 * Check if URL matches ad patterns (optimized)
 */
function isAdUrl(url, hostname) {
  const urlLower = url.toLowerCase();
  const hostLower = hostname.toLowerCase();

  // 1. Check exact domain matches first (fastest - O(1) Set lookup)
  if (matchesDomain(hostLower)) {
    return { blocked: true, type: 'domain' };
  }

  // 2. YouTube-specific patterns (only check on YouTube)
  if (hostLower.includes('youtube.com') || hostLower.includes('ytimg.com') || hostLower.includes('googlevideo.com')) {
    for (const pattern of AD_PATTERNS.youtube) {
      if (urlLower.includes(pattern)) {
        return { blocked: true, type: 'youtube' };
      }
    }
  }

  // 3. Facebook tracking patterns
  if (hostLower.includes('facebook.com') || hostLower.includes('fbcdn.net')) {
    for (const pattern of AD_PATTERNS.facebook) {
      if (urlLower.includes(pattern)) {
        return { blocked: true, type: 'facebook' };
      }
    }
  }

  // 4. Generic path patterns
  for (const pattern of AD_PATTERNS.paths) {
    if (urlLower.includes(pattern)) {
      return { blocked: true, type: 'path' };
    }
  }

  // 5. Regex patterns (slowest - check last)
  for (const regex of AD_PATTERNS.regex) {
    if (regex.test(urlLower)) {
      return { blocked: true, type: 'regex' };
    }
  }

  return { blocked: false, type: null };
}

/**
 * Setup ad blocking using webRequest API
 */
function setupAdBlocking() {
  const filter = {
    urls: ['*://*/*'],
  };

  session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
    try {
      const urlObj = new URL(details.url);
      const result = isAdUrl(details.url, urlObj.hostname);

      if (result.blocked) {
        adsBlocked++;
        if (result.type === 'youtube') {
          youtubeAdsBlocked++;
        }

        // Log in dev mode only
        if (process.argv.includes('--enable-logging')) {
          console.log(`[AdBlock:${result.type}]`, details.url.substring(0, 80));
        }

        // Notify renderer about blocked ad
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('ad-blocked', { total: adsBlocked, youtube: youtubeAdsBlocked });
        }

        callback({ cancel: true });
      } else {
        callback({ cancel: false });
      }
    } catch (e) {
      // Invalid URL, allow it
      callback({ cancel: false });
    }
  });

  console.log('Ad blocking enabled with', AD_PATTERNS.domains.size, 'domains +',
    AD_PATTERNS.youtube.length, 'YouTube patterns +',
    AD_PATTERNS.regex.length, 'regex patterns');
}

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'nodaysidle',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the UI
  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  // Update bounds when window is resized
  mainWindow.on('resize', () => {
    updateActiveTabViewBounds();
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
    tabViews.clear();
  });

  // Open DevTools in development
  if (process.argv.includes('--enable-logging')) {
    mainWindow.webContents.openDevTools();
  }
}

/**
 * Create a BrowserView for a specific tab
 */
function createTabView(tabId) {
  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  tabViews.set(tabId, view);
  mainWindow.addBrowserView(view);

  // Hide initially
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 });

  // Setup event listeners for this view
  setupTabViewListeners(tabId, view);

  return view;
}

/**
 * Get the active tab's BrowserView
 */
function getActiveTabView() {
  const activeTab = tabManager.getActiveTab();
  if (!activeTab) return null;
  return tabViews.get(activeTab.id) || null;
}

/**
 * Update bounds for the active tab's view
 */
function updateActiveTabViewBounds() {
  const view = getActiveTabView();
  if (!view || !mainWindow) return;

  const bounds = mainWindow.getContentBounds();
  const xOffset = sidebarOpen ? SIDEBAR_WIDTH : 0;

  view.setBounds({
    x: xOffset,
    y: HEADER_HEIGHT,
    width: bounds.width - xOffset,
    height: bounds.height - HEADER_HEIGHT,
  });
}

/**
 * Show only the specified tab's view, hide all others
 */
function showTabView(tabId) {
  if (!mainWindow) return;

  const bounds = mainWindow.getContentBounds();
  const xOffset = sidebarOpen ? SIDEBAR_WIDTH : 0;
  const visibleBounds = {
    x: xOffset,
    y: HEADER_HEIGHT,
    width: bounds.width - xOffset,
    height: bounds.height - HEADER_HEIGHT,
  };
  const hiddenBounds = { x: 0, y: 0, width: 0, height: 0 };

  // Hide all views, show only the active one
  for (const [id, view] of tabViews) {
    if (id === tabId) {
      view.setBounds(visibleBounds);
    } else {
      view.setBounds(hiddenBounds);
    }
  }
}

/**
 * Hide all tab views (show welcome screen)
 */
function hideAllTabViews() {
  const hiddenBounds = { x: 0, y: 0, width: 0, height: 0 };
  for (const view of tabViews.values()) {
    view.setBounds(hiddenBounds);
  }
}

/**
 * Destroy a tab's BrowserView
 */
function destroyTabView(tabId) {
  const view = tabViews.get(tabId);
  if (view) {
    mainWindow.removeBrowserView(view);
    view.webContents.destroy();
    tabViews.delete(tabId);
  }
}

/**
 * Inject YouTube ad-block script if on YouTube
 */
function injectYouTubeAdBlocker(view, url) {
  if (!view || !youtubeAdBlockScript) return;

  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('youtube.com')) {
      view.webContents.executeJavaScript(youtubeAdBlockScript)
        .then(() => {
          if (process.argv.includes('--enable-logging')) {
            console.log('[YouTube] Ad-block script injected');
          }
        })
        .catch(err => {
          console.error('[YouTube] Failed to inject ad-block script:', err);
        });
    }
  } catch (e) {
    // Invalid URL, ignore
  }
}

/**
 * Setup event listeners for a tab's BrowserView
 */
function setupTabViewListeners(tabId, view) {
  if (!view) return;

  view.webContents.on('page-title-updated', (event, title) => {
    tabManager.updateTabTitle(tabId, title);
    if (mainWindow) {
      mainWindow.webContents.send('tab-title-updated', tabId, title);
    }
  });

  view.webContents.on('did-navigate', (event, url) => {
    tabManager.updateTabUrl(tabId, url);
    if (mainWindow) {
      mainWindow.webContents.send('tab-url-updated', tabId, url);
    }
  });

  view.webContents.on('did-navigate-in-page', (event, url) => {
    tabManager.updateTabUrl(tabId, url);
    if (mainWindow) {
      mainWindow.webContents.send('tab-url-updated', tabId, url);
    }
  });

  // Inject YouTube ad-blocker when page finishes loading
  view.webContents.on('did-finish-load', () => {
    const url = view.webContents.getURL();
    injectYouTubeAdBlocker(view, url);

    // Send back/forward state to renderer
    if (mainWindow) {
      mainWindow.webContents.send('nav-state-updated', tabId, {
        canGoBack: view.webContents.canGoBack(),
        canGoForward: view.webContents.canGoForward(),
      });
    }
  });

  // Handle navigation errors (DNS failures, SSL errors, timeouts)
  view.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    // Ignore aborted loads (user navigated away) and cancelled loads
    if (errorCode === -3 || errorCode === -1) return;

    if (mainWindow) {
      mainWindow.webContents.send('navigation-error', tabId, {
        errorCode,
        errorDescription,
        url: validatedURL,
      });
    }
  });

  // Also inject on SPA navigation (YouTube is a SPA)
  view.webContents.on('did-navigate-in-page', (event, url) => {
    injectYouTubeAdBlocker(view, url);
  });

  // Handle links that want to open in a new window/tab
  view.webContents.setWindowOpenHandler(({ url }) => {
    // Create a new tab with this URL instead of opening external browser
    const newTab = tabManager.createTab(url);
    const newView = createTabView(newTab.id);

    // Navigate the new tab to the URL
    newView.webContents.loadURL(url);

    // Show the new tab
    showTabView(newTab.id);

    // Notify renderer to update UI
    if (mainWindow) {
      mainWindow.webContents.send('new-tab-created', newTab);
    }

    // Prevent default behavior (opening in external browser)
    return { action: 'deny' };
  });
}

/**
 * Navigate a tab's view to a URL
 */
function navigateToUrl(tabId, url) {
  let view = tabViews.get(tabId);

  // Create view if it doesn't exist
  if (!view) {
    view = createTabView(tabId);
  }

  // Show this tab's view
  showTabView(tabId);

  // Navigate
  view.webContents.loadURL(url);
}

/**
 * Resolve input to URL (handles search queries vs URLs)
 */
function resolveInput(input) {
  const trimmed = input.trim();

  // Check if it looks like a URL
  if (trimmed.includes('.') && !trimmed.includes(' ')) {
    // Add protocol if missing
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return { url: `https://${trimmed}`, isSearch: false };
    }
    return { url: trimmed, isSearch: false };
  }

  // Treat as search query - use DuckDuckGo
  const encoded = encodeURIComponent(trimmed);
  return { url: `https://duckduckgo.com/?q=${encoded}`, isSearch: true };
}

// ============================================
// IPC Handlers
// ============================================

// Navigation
ipcMain.handle('navigate', async (event, input, tabId) => {
  const result = resolveInput(input);

  // Update tab state
  tabManager.updateTabUrl(tabId, result.url);

  // Navigate the tab's view
  navigateToUrl(tabId, result.url);

  // Record in history
  db.recordVisit(result.url, null);

  return result;
});

ipcMain.handle('go-back', async () => {
  const view = getActiveTabView();
  if (view && view.webContents.canGoBack()) {
    view.webContents.goBack();
    return true;
  }
  return false;
});

ipcMain.handle('go-forward', async () => {
  const view = getActiveTabView();
  if (view && view.webContents.canGoForward()) {
    view.webContents.goForward();
    return true;
  }
  return false;
});

ipcMain.handle('reload', async () => {
  const view = getActiveTabView();
  if (view) {
    view.webContents.reload();
    return true;
  }
  return false;
});

ipcMain.handle('show-content-view', async () => {
  const activeTab = tabManager.getActiveTab();
  if (activeTab) {
    showTabView(activeTab.id);
  }
});

ipcMain.handle('hide-content-view', async () => {
  hideAllTabViews();
});

// Sidebar toggle
ipcMain.handle('toggle-sidebar', async (event, isOpen) => {
  sidebarOpen = isOpen;
  // Update active tab view bounds
  updateActiveTabViewBounds();
  return sidebarOpen;
});

// Get ads blocked count
ipcMain.handle('get-ads-blocked', async () => {
  return { total: adsBlocked, youtube: youtubeAdsBlocked };
});

// Tab Management
ipcMain.handle('create-tab', async (event, url) => {
  const tab = tabManager.createTab(url);
  // Create a BrowserView for this tab
  createTabView(tab.id);
  return tab;
});

ipcMain.handle('close-tab', async (event, tabId) => {
  // Destroy the BrowserView for this tab
  destroyTabView(tabId);
  return tabManager.closeTab(tabId);
});

ipcMain.handle('switch-tab', async (event, tabId) => {
  const tab = tabManager.switchTab(tabId);
  if (tab && tab.url && tab.url !== 'about:blank') {
    // Just show the existing view (no reload!)
    showTabView(tabId);
  } else {
    // Hide all views to show welcome screen
    hideAllTabViews();
  }
  return tab;
});

ipcMain.handle('get-tabs', async () => {
  return tabManager.getAllTabs();
});

ipcMain.handle('get-active-tab', async () => {
  return tabManager.getActiveTab();
});

ipcMain.handle('update-tab-url', async (event, tabId, url) => {
  return tabManager.updateTabUrl(tabId, url);
});

ipcMain.handle('update-tab-title', async (event, tabId, title) => {
  return tabManager.updateTabTitle(tabId, title);
});

// Bookmarks
ipcMain.handle('add-bookmark', async (event, title, url, parentId) => {
  return db.addBookmark(title, url, parentId);
});

ipcMain.handle('remove-bookmark', async (event, id) => {
  return db.removeBookmark(id);
});

ipcMain.handle('remove-bookmark-by-url', async (event, url) => {
  return db.removeBookmarkByUrl(url);
});

ipcMain.handle('get-bookmarks', async (event, parentId) => {
  return db.getBookmarks(parentId);
});

ipcMain.handle('is-bookmarked', async (event, url) => {
  return db.isBookmarked(url);
});

ipcMain.handle('create-bookmark-folder', async (event, title, parentId) => {
  return db.createBookmarkFolder(title, parentId);
});

// History
ipcMain.handle('record-visit', async (event, url, title) => {
  return db.recordVisit(url, title);
});

ipcMain.handle('get-history', async (event, limit, offset) => {
  return db.getHistory(limit, offset);
});

ipcMain.handle('search-history', async (event, query) => {
  return db.searchHistory(query);
});

ipcMain.handle('clear-history', async (event, beforeTimestamp) => {
  return db.clearHistory(beforeTimestamp);
});

ipcMain.handle('delete-history-entry', async (event, id) => {
  return db.deleteHistoryEntry(id);
});

// ============================================
// App Lifecycle
// ============================================

app.whenReady().then(() => {
  // Initialize database
  db = new Database();

  // Initialize tab manager
  tabManager = new TabManager();

  // Setup ad blocking
  setupAdBlocking();

  // Create window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Close database cleanly on quit
app.on('before-quit', () => {
  if (db) {
    try {
      db.close();
      console.log('Database closed');
    } catch (e) {
      console.error('Error closing database:', e);
    }
  }
});
