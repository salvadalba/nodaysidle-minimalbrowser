/**
 * Drift Browser - Tab Manager
 * Manages browser tabs state
 */

const { v4: uuidv4 } = require('crypto');

class TabManager {
  constructor() {
    this.tabs = new Map();
    this.activeTabId = null;
    this.tabOrder = [];
  }

  /**
   * Generate a unique tab ID
   */
  generateId() {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new tab
   */
  createTab(url = null) {
    const id = this.generateId();
    const tab = {
      id,
      url: url || 'about:blank',
      title: 'New Tab',
      createdAt: Date.now(),
    };

    this.tabs.set(id, tab);
    this.tabOrder.push(id);
    this.activeTabId = id;

    console.log('Created tab:', id, 'URL:', tab.url);
    return tab;
  }

  /**
   * Close a tab
   */
  closeTab(tabId) {
    if (!this.tabs.has(tabId)) {
      return false;
    }

    this.tabs.delete(tabId);
    const index = this.tabOrder.indexOf(tabId);
    if (index > -1) {
      this.tabOrder.splice(index, 1);
    }

    // If we closed the active tab, switch to another
    if (this.activeTabId === tabId) {
      if (this.tabOrder.length > 0) {
        // Switch to the tab at the same index, or the previous one
        const newIndex = Math.min(index, this.tabOrder.length - 1);
        this.activeTabId = this.tabOrder[newIndex];
      } else {
        this.activeTabId = null;
      }
    }

    console.log('Closed tab:', tabId, 'Active tab:', this.activeTabId);
    return true;
  }

  /**
   * Switch to a tab
   */
  switchTab(tabId) {
    if (!this.tabs.has(tabId)) {
      return null;
    }

    this.activeTabId = tabId;
    console.log('Switched to tab:', tabId);
    return this.tabs.get(tabId);
  }

  /**
   * Get all tabs
   */
  getAllTabs() {
    return this.tabOrder.map(id => this.tabs.get(id));
  }

  /**
   * Get the active tab
   */
  getActiveTab() {
    if (!this.activeTabId) {
      return null;
    }
    return this.tabs.get(this.activeTabId) || null;
  }

  /**
   * Update tab URL
   */
  updateTabUrl(tabId, url) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.url = url;
      console.log('Updated tab', tabId, 'URL:', url);
      return true;
    }
    return false;
  }

  /**
   * Update tab title
   */
  updateTabTitle(tabId, title) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.title = title;
      console.log('Updated tab', tabId, 'title:', title);
      return true;
    }
    return false;
  }

  /**
   * Reorder tabs
   */
  reorderTabs(newOrder) {
    // Validate all IDs exist
    if (!newOrder.every(id => this.tabs.has(id))) {
      return false;
    }
    this.tabOrder = newOrder;
    return true;
  }
}

module.exports = TabManager;
