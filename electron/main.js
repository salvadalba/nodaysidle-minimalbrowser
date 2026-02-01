/**
 * Drift Browser - Electron Main Process
 * Handles window management, BrowserViews for web content, and IPC
 */

const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
const path = require('path');
const Database = require('./database');
const TabManager = require('./tabs');

// Keep references to prevent garbage collection
let mainWindow = null;
let contentView = null;
let db = null;
let tabManager = null;

// Layout constants
const HEADER_HEIGHT = 80;
const SIDEBAR_WIDTH = 280;
let sidebarOpen = false;

// Ad blocking
let adsBlocked = 0;
const AD_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.com/tr',
  'connect.facebook.net',
  'ads.youtube.com',
  'youtube.com/api/stats/ads',
  'youtube.com/pagead',
  'youtube.com/ptracking',
  'youtube.com/get_video_info',
  'ad.doubleclick.net',
  'static.doubleclick.net',
  'adservice.google.com',
  'pagead2.googlesyndication.com',
  'tpc.googlesyndication.com',
  'www.googletagservices.com',
  'analytics.google.com',
  'ssl.google-analytics.com',
  'adsserver.',
  'adserver.',
  '/ads/',
  '/ad/',
  'banner',
  'tracking',
  '.ads.',
  'advertising',
  'amazon-adsystem.com',
  'adsymptotic.com',
  'adnxs.com',
  'adzerk.net',
  'pubmatic.com',
  'rubiconproject.com',
  'scorecardresearch.com',
  'taboola.com',
  'outbrain.com',
];

/**
 * Setup ad blocking using webRequest API
 */
function setupAdBlocking() {
  const filter = {
    urls: ['*://*/*'],
  };

  session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
    const url = details.url.toLowerCase();

    // Check if URL matches any ad pattern
    const isAd = AD_DOMAINS.some(pattern => url.includes(pattern));

    if (isAd) {
      adsBlocked++;
      console.log('Blocked ad:', details.url.substring(0, 80));

      // Notify renderer about blocked ad
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('ad-blocked', adsBlocked);
      }

      callback({ cancel: true });
    } else {
      callback({ cancel: false });
    }
  });

  console.log('Ad blocking enabled');
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

  // Create the content BrowserView for web pages
  contentView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.addBrowserView(contentView);

  // Hide content view initially (show welcome screen)
  contentView.setBounds({ x: 0, y: 0, width: 0, height: 0 });

  // Update bounds when window is resized
  mainWindow.on('resize', () => {
    if (contentView.getBounds().width > 0) {
      updateContentViewBounds();
    }
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
    contentView = null;
  });

  // Setup content view event listeners
  setupContentViewListeners();

  // Open DevTools in development
  if (process.argv.includes('--enable-logging')) {
    mainWindow.webContents.openDevTools();
  }
}

/**
 * Setup event listeners for the content view
 */
function setupContentViewListeners() {
  if (!contentView) return;

  contentView.webContents.on('page-title-updated', (event, title) => {
    const activeTab = tabManager.getActiveTab();
    if (activeTab) {
      tabManager.updateTabTitle(activeTab.id, title);
      if (mainWindow) {
        mainWindow.webContents.send('tab-title-updated', activeTab.id, title);
      }
    }
  });

  contentView.webContents.on('did-navigate', (event, url) => {
    const activeTab = tabManager.getActiveTab();
    if (activeTab) {
      tabManager.updateTabUrl(activeTab.id, url);
      if (mainWindow) {
        mainWindow.webContents.send('tab-url-updated', activeTab.id, url);
      }
    }
  });

  contentView.webContents.on('did-navigate-in-page', (event, url) => {
    const activeTab = tabManager.getActiveTab();
    if (activeTab) {
      tabManager.updateTabUrl(activeTab.id, url);
      if (mainWindow) {
        mainWindow.webContents.send('tab-url-updated', activeTab.id, url);
      }
    }
  });
}

/**
 * Update the content view bounds based on window size and sidebar state
 */
function updateContentViewBounds() {
  if (!mainWindow || !contentView) return;

  const bounds = mainWindow.getContentBounds();
  const xOffset = sidebarOpen ? SIDEBAR_WIDTH : 0;

  contentView.setBounds({
    x: xOffset,
    y: HEADER_HEIGHT,
    width: bounds.width - xOffset,
    height: bounds.height - HEADER_HEIGHT,
  });
}

/**
 * Navigate the content view to a URL
 */
function navigateToUrl(url) {
  if (!contentView) return;

  // Show the content view
  updateContentViewBounds();

  // Navigate
  contentView.webContents.loadURL(url);
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

  // Navigate the content view
  navigateToUrl(result.url);

  // Record in history
  db.recordVisit(result.url, null);

  return result;
});

ipcMain.handle('go-back', async () => {
  if (contentView && contentView.webContents.canGoBack()) {
    contentView.webContents.goBack();
    return true;
  }
  return false;
});

ipcMain.handle('go-forward', async () => {
  if (contentView && contentView.webContents.canGoForward()) {
    contentView.webContents.goForward();
    return true;
  }
  return false;
});

ipcMain.handle('reload', async () => {
  if (contentView) {
    contentView.webContents.reload();
    return true;
  }
  return false;
});

ipcMain.handle('show-content-view', async () => {
  updateContentViewBounds();
});

ipcMain.handle('hide-content-view', async () => {
  if (contentView) {
    contentView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  }
});

// Sidebar toggle
ipcMain.handle('toggle-sidebar', async (event, isOpen) => {
  sidebarOpen = isOpen;
  // Only update if content view is visible
  if (contentView && contentView.getBounds().width > 0) {
    updateContentViewBounds();
  }
  return sidebarOpen;
});

// Get ads blocked count
ipcMain.handle('get-ads-blocked', async () => {
  return adsBlocked;
});

// Tab Management
ipcMain.handle('create-tab', async (event, url) => {
  return tabManager.createTab(url);
});

ipcMain.handle('close-tab', async (event, tabId) => {
  return tabManager.closeTab(tabId);
});

ipcMain.handle('switch-tab', async (event, tabId) => {
  const tab = tabManager.switchTab(tabId);
  if (tab && tab.url && tab.url !== 'about:blank') {
    navigateToUrl(tab.url);
  } else {
    // Hide content view to show welcome screen
    if (contentView) {
      contentView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
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

ipcMain.handle('get-bookmarks', async (event, parentId) => {
  return db.getBookmarks(parentId);
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
