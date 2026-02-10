/**
 * Drift Browser - Preload Script
 * Exposes secure IPC bridge to renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Helper to safely register one-time listeners (prevents leak on re-call)
function onceListener(channel, callback) {
  ipcRenderer.removeAllListeners(channel);
  ipcRenderer.on(channel, callback);
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Navigation
  navigate: (input, tabId) => ipcRenderer.invoke('navigate', input, tabId),
  goBack: () => ipcRenderer.invoke('go-back'),
  goForward: () => ipcRenderer.invoke('go-forward'),
  reload: () => ipcRenderer.invoke('reload'),
  showContentView: () => ipcRenderer.invoke('show-content-view'),
  hideContentView: () => ipcRenderer.invoke('hide-content-view'),

  // Tab Management
  createTab: (url) => ipcRenderer.invoke('create-tab', url),
  closeTab: (tabId) => ipcRenderer.invoke('close-tab', tabId),
  switchTab: (tabId) => ipcRenderer.invoke('switch-tab', tabId),
  getTabs: () => ipcRenderer.invoke('get-tabs'),
  getActiveTab: () => ipcRenderer.invoke('get-active-tab'),
  updateTabUrl: (tabId, url) => ipcRenderer.invoke('update-tab-url', tabId, url),
  updateTabTitle: (tabId, title) => ipcRenderer.invoke('update-tab-title', tabId, title),

  // Bookmarks
  addBookmark: (title, url, parentId) => ipcRenderer.invoke('add-bookmark', title, url, parentId),
  removeBookmark: (id) => ipcRenderer.invoke('remove-bookmark', id),
  removeBookmarkByUrl: (url) => ipcRenderer.invoke('remove-bookmark-by-url', url),
  getBookmarks: (parentId) => ipcRenderer.invoke('get-bookmarks', parentId),
  isBookmarked: (url) => ipcRenderer.invoke('is-bookmarked', url),
  createBookmarkFolder: (title, parentId) => ipcRenderer.invoke('create-bookmark-folder', title, parentId),

  // History
  recordVisit: (url, title) => ipcRenderer.invoke('record-visit', url, title),
  getHistory: (limit, offset) => ipcRenderer.invoke('get-history', limit, offset),
  searchHistory: (query) => ipcRenderer.invoke('search-history', query),
  clearHistory: (beforeTimestamp) => ipcRenderer.invoke('clear-history', beforeTimestamp),
  deleteHistoryEntry: (id) => ipcRenderer.invoke('delete-history-entry', id),

  // Sidebar
  toggleSidebar: (isOpen) => ipcRenderer.invoke('toggle-sidebar', isOpen),

  // Ad blocking
  getAdsBlocked: () => ipcRenderer.invoke('get-ads-blocked'),

  // Event listeners (safe: removes previous before adding)
  onTabTitleUpdated: (callback) => {
    onceListener('tab-title-updated', (event, tabId, title) => callback(tabId, title));
  },
  onTabUrlUpdated: (callback) => {
    onceListener('tab-url-updated', (event, tabId, url) => callback(tabId, url));
  },
  onAdBlocked: (callback) => {
    onceListener('ad-blocked', (event, count) => callback(count));
  },
  onNewTabCreated: (callback) => {
    onceListener('new-tab-created', (event, tab) => callback(tab));
  },
  onNavStateUpdated: (callback) => {
    onceListener('nav-state-updated', (event, tabId, state) => callback(tabId, state));
  },
  onNavigationError: (callback) => {
    onceListener('navigation-error', (event, tabId, error) => callback(tabId, error));
  },
});
