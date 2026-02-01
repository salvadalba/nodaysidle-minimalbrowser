/**
 * Drift Browser - Preload Script
 * Exposes secure IPC bridge to renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

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
  getBookmarks: (parentId) => ipcRenderer.invoke('get-bookmarks', parentId),
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

  // Event listeners
  onTabTitleUpdated: (callback) => {
    ipcRenderer.on('tab-title-updated', (event, tabId, title) => callback(tabId, title));
  },
  onTabUrlUpdated: (callback) => {
    ipcRenderer.on('tab-url-updated', (event, tabId, url) => callback(tabId, url));
  },
  onAdBlocked: (callback) => {
    ipcRenderer.on('ad-blocked', (event, count) => callback(count));
  },
});
