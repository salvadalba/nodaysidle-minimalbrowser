/**
 * Drift Browser - Main JavaScript
 * Vanilla JS frontend for Electron browser
 */

// ============================================
// Electron API Helper
// ============================================
function isElectronAvailable() {
    return !!(window.electronAPI);
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Drift browser UI initialized');

    // Initialize UI components
    initSidebar();
    initTabBar();
    initUrlBar();
    initModals();
    initKeyboardShortcuts();
    initNavControls();
    initQuickBookmark();
    initNavErrorBanner();

    // Load initial data
    loadBookmarks();
    loadHistory();
    loadTabs();

    // Setup event listeners from main process
    setupElectronListeners();
});

// ============================================
// Electron Event Listeners
// ============================================
function setupElectronListeners() {
    if (!isElectronAvailable()) return;

    // Listen for tab title updates from main process
    window.electronAPI.onTabTitleUpdated((tabId, title) => {
        const tab = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
        if (tab) {
            tab.querySelector('.tab-title').textContent = title;
        }
    });

    // Listen for tab URL updates from main process
    window.electronAPI.onTabUrlUpdated((tabId, url) => {
        const activeTab = document.querySelector('.tab.active');
        if (activeTab && activeTab.dataset.tabId === tabId) {
            document.getElementById('url-input').value = url;
            updateBookmarkStatus(url);
            // Hide error banner on successful navigation
            hideNavError();
        }
    });

    // Listen for ad blocked events
    window.electronAPI.onAdBlocked((data) => {
        const adblockCount = document.getElementById('adblock-count');
        if (adblockCount) {
            adblockCount.textContent = data.total;
        }
    });

    // Listen for new tabs created from links (target="_blank")
    window.electronAPI.onNewTabCreated((tab) => {
        renderTab(tab.id, tab.title, true);
        document.getElementById('url-input').value = tab.url || '';
        document.getElementById('welcome-screen').classList.add('hidden');
        hideNavError();
        updateBookmarkStatus(tab.url || '');
    });

    // Listen for back/forward state changes
    window.electronAPI.onNavStateUpdated((tabId, state) => {
        const activeTab = document.querySelector('.tab.active');
        if (activeTab && activeTab.dataset.tabId === tabId) {
            document.getElementById('back-btn').disabled = !state.canGoBack;
            document.getElementById('forward-btn').disabled = !state.canGoForward;
        }
    });

    // Listen for navigation errors
    window.electronAPI.onNavigationError((tabId, error) => {
        const activeTab = document.querySelector('.tab.active');
        if (activeTab && activeTab.dataset.tabId === tabId) {
            showNavError(error);
        }
    });
}

// ============================================
// Navigation Error Banner
// ============================================
function initNavErrorBanner() {
    document.getElementById('nav-error-retry').addEventListener('click', async () => {
        hideNavError();
        if (isElectronAvailable()) {
            await window.electronAPI.reload();
        }
    });
}

function showNavError(error) {
    const banner = document.getElementById('nav-error-banner');
    const ERROR_MESSAGES = {
        '-2': ['DNS resolution failed', 'The server could not be found. Check the URL or your internet connection.'],
        '-3': ['Navigation cancelled', 'The page load was interrupted.'],
        '-6': ['Connection refused', 'The server refused the connection. It may be down or unreachable.'],
        '-7': ['Connection timed out', 'The server took too long to respond.'],
        '-100': ['Connection closed', 'The connection was unexpectedly closed.'],
        '-101': ['Connection reset', 'The connection was reset by the server.'],
        '-102': ['Connection refused', 'The server actively refused the connection.'],
        '-105': ['Name not resolved', 'The server name could not be found. Check the URL.'],
        '-106': ['Internet disconnected', 'Your device appears to be offline.'],
        '-200': ['Certificate error', 'The site\'s security certificate is not trusted.'],
        '-201': ['Certificate date invalid', 'The site\'s certificate has expired or is not yet valid.'],
        '-202': ['Certificate authority invalid', 'The certificate is not from a trusted authority.'],
    };

    const code = String(error.errorCode);
    const [title, description] = ERROR_MESSAGES[code] || [
        `Load failed (${error.errorDescription || code})`,
        'The page could not be loaded.'
    ];

    document.getElementById('nav-error-title').textContent = title;
    document.getElementById('nav-error-description').textContent = description;
    document.getElementById('nav-error-url').textContent = error.url || '';
    banner.classList.add('visible');
}

function hideNavError() {
    document.getElementById('nav-error-banner').classList.remove('visible');
}

// ============================================
// Quick Bookmark Button
// ============================================
let currentPageBookmarked = false;

function initQuickBookmark() {
    const quickBookmarkBtn = document.getElementById('quick-bookmark-btn');

    quickBookmarkBtn.addEventListener('click', async () => {
        const urlInput = document.getElementById('url-input');
        const currentUrl = urlInput.value;

        if (!currentUrl || currentUrl === '' || currentUrl === 'about:blank') {
            showToast('No page to bookmark', 'info');
            return;
        }

        try {
            if (isElectronAvailable()) {
                if (currentPageBookmarked) {
                    await window.electronAPI.removeBookmarkByUrl(currentUrl);
                    currentPageBookmarked = false;
                    quickBookmarkBtn.classList.remove('bookmarked');
                    showToast('Bookmark removed', 'success');
                } else {
                    const activeTab = document.querySelector('.tab.active');
                    const title = activeTab ?
                        activeTab.querySelector('.tab-title').textContent :
                        extractDomain(currentUrl);
                    await window.electronAPI.addBookmark(title, currentUrl, null);
                    currentPageBookmarked = true;
                    quickBookmarkBtn.classList.add('bookmarked');
                    showToast('Bookmarked', 'success');
                }
                loadBookmarks();
            }
        } catch (error) {
            showToast('Failed to update bookmark: ' + error, 'error');
        }
    });
}

async function updateBookmarkStatus(url) {
    if (!url || url === '' || url === 'about:blank') {
        currentPageBookmarked = false;
        document.getElementById('quick-bookmark-btn').classList.remove('bookmarked');
        return;
    }

    try {
        if (isElectronAvailable()) {
            const result = await window.electronAPI.isBookmarked(url);
            currentPageBookmarked = result.bookmarked;
            const quickBookmarkBtn = document.getElementById('quick-bookmark-btn');
            if (result.bookmarked) {
                quickBookmarkBtn.classList.add('bookmarked');
            } else {
                quickBookmarkBtn.classList.remove('bookmarked');
            }
        }
    } catch (error) {
        console.error('Failed to check bookmark status:', error);
    }
}

// ============================================
// Navigation Controls (Back, Forward, Reload)
// ============================================
function initNavControls() {
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');
    const reloadBtn = document.getElementById('reload-btn');

    backBtn.addEventListener('click', async () => {
        if (isElectronAvailable()) {
            await window.electronAPI.goBack();
        }
    });

    forwardBtn.addEventListener('click', async () => {
        if (isElectronAvailable()) {
            await window.electronAPI.goForward();
        }
    });

    reloadBtn.addEventListener('click', async () => {
        hideNavError();
        if (isElectronAvailable()) {
            await window.electronAPI.reload();
        }
    });

    // Start disabled until navigation state is received
    backBtn.disabled = true;
    forwardBtn.disabled = true;
}

// ============================================
// Sidebar Management
// ============================================
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarTabs = document.querySelectorAll('.sidebar-tab');

    sidebar.classList.remove('open');

    toggleBtn.addEventListener('click', async () => {
        sidebar.classList.toggle('open');
        const isOpen = sidebar.classList.contains('open');
        if (isElectronAvailable()) {
            await window.electronAPI.toggleSidebar(isOpen);
        }
    });

    sidebarTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const panelName = tab.dataset.panel;

            sidebarTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`${panelName}-panel`).classList.add('active');

            if (panelName === 'history') {
                loadHistory();
            } else if (panelName === 'bookmarks') {
                loadBookmarks();
            }
        });
    });

    // Clear history button - uses custom confirm modal instead of native confirm()
    document.getElementById('clear-history-btn').addEventListener('click', () => {
        showConfirmDialog(
            'Clear History',
            'Are you sure you want to clear all browsing history? This cannot be undone.',
            async () => {
                try {
                    if (isElectronAvailable()) {
                        await window.electronAPI.clearHistory(null);
                    }
                    loadHistory();
                    showToast('History cleared', 'success');
                } catch (error) {
                    showToast('Failed to clear history: ' + error, 'error');
                }
            }
        );
    });

    // History search
    const historySearchInput = document.getElementById('history-search-input');
    let searchDebounce = null;
    historySearchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            searchHistory(historySearchInput.value);
        }, 300);
    });
}

// ============================================
// Tab Bar Management
// ============================================
function initTabBar() {
    const newTabBtn = document.getElementById('new-tab-btn');
    const tabsContainer = document.getElementById('tabs-container');

    newTabBtn.addEventListener('click', () => {
        createTab();
    });

    tabsContainer.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (!tab) return;

        if (e.target.closest('.tab-close')) {
            closeTab(tab.dataset.tabId);
        } else {
            switchTab(tab.dataset.tabId);
        }
    });
}

async function loadTabs() {
    try {
        if (!isElectronAvailable()) {
            await createTab();
            return;
        }

        const tabs = await window.electronAPI.getTabs();
        const tabsContainer = document.getElementById('tabs-container');

        if (!tabs || tabs.length === 0) {
            await createTab();
            return;
        }

        tabsContainer.innerHTML = '';
        const activeTab = await window.electronAPI.getActiveTab();
        tabs.forEach(tab => {
            renderTab(tab.id, tab.title, activeTab && activeTab.id === tab.id);
        });

    } catch (error) {
        console.error('Failed to load tabs:', error);
        await createTab();
    }
}

async function createTab(url = null) {
    try {
        if (isElectronAvailable()) {
            const tab = await window.electronAPI.createTab(url);
            renderTab(tab.id, tab.title, true);

            document.getElementById('url-input').value = url || '';

            if (!url || url === 'about:blank') {
                document.getElementById('welcome-screen').classList.remove('hidden');
                await window.electronAPI.hideContentView();
            } else {
                document.getElementById('welcome-screen').classList.add('hidden');
            }

            hideNavError();
            updateBookmarkStatus(url || '');

            // Reset nav buttons for new tab
            document.getElementById('back-btn').disabled = true;
            document.getElementById('forward-btn').disabled = true;
        } else {
            const tabId = 'tab-' + Date.now();
            renderTab(tabId, url || 'New Tab', true);
        }
    } catch (error) {
        showToast('Failed to create tab: ' + error, 'error');
    }
}

function renderTab(tabId, title, isActive = true) {
    const tabsContainer = document.getElementById('tabs-container');

    const tab = document.createElement('div');
    tab.className = 'tab' + (isActive ? ' active' : '');
    tab.dataset.tabId = tabId;
    tab.draggable = true;
    tab.innerHTML = `
        <span class="tab-title">${escapeHtml(title)}</span>
        <button class="tab-close">&times;</button>
    `;

    if (isActive) {
        tabsContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    }

    tabsContainer.appendChild(tab);
    setupTabDragDrop(tab);
}

function setupTabDragDrop(tab) {
    tab.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', tab.dataset.tabId);
        tab.classList.add('dragging');
    });

    tab.addEventListener('dragend', () => {
        tab.classList.remove('dragging');
    });

    tab.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = document.querySelector('.tab.dragging');
        if (dragging && dragging !== tab) {
            const rect = tab.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;
            if (e.clientX < midpoint) {
                tab.parentNode.insertBefore(dragging, tab);
            } else {
                tab.parentNode.insertBefore(dragging, tab.nextSibling);
            }
        }
    });
}

async function closeTab(tabId) {
    try {
        const tabs = document.querySelectorAll('.tab');

        if (tabs.length <= 1) {
            showToast('Cannot close the last tab', 'info');
            return;
        }

        if (isElectronAvailable()) {
            await window.electronAPI.closeTab(tabId);
        }

        const tab = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
        if (tab) {
            const wasActive = tab.classList.contains('active');
            const nextTab = tab.nextElementSibling || tab.previousElementSibling;
            tab.remove();

            if (wasActive && nextTab) {
                await switchTab(nextTab.dataset.tabId);
            } else if (wasActive) {
                showWelcomeScreen();
            }
        }

        if (document.querySelectorAll('.tab').length === 0) {
            showWelcomeScreen();
        }
    } catch (error) {
        showToast('Failed to close tab: ' + error, 'error');
    }
}

async function showWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcome-screen');
    welcomeScreen.classList.remove('hidden');
    hideNavError();

    if (isElectronAvailable()) {
        await window.electronAPI.hideContentView();
    }
}

async function switchTab(tabId) {
    try {
        if (isElectronAvailable()) {
            const tab = await window.electronAPI.switchTab(tabId);

            if (tab && tab.url && tab.url !== 'about:blank') {
                document.getElementById('url-input').value = tab.url;
                document.getElementById('welcome-screen').classList.add('hidden');
                updateBookmarkStatus(tab.url);
            } else {
                document.getElementById('url-input').value = '';
                document.getElementById('welcome-screen').classList.remove('hidden');
                updateBookmarkStatus('');
            }

            hideNavError();
        }

        document.querySelectorAll('.tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tabId === tabId);
        });
    } catch (error) {
        showToast('Failed to switch tab: ' + error, 'error');
    }
}

// ============================================
// URL Bar Management
// ============================================
let selectedIndex = -1;

function initUrlBar() {
    const urlInput = document.getElementById('url-input');
    const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
    let debounceTimer = null;

    urlInput.addEventListener('keydown', (e) => {
        const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');

        if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && items[selectedIndex]) {
                const url = items[selectedIndex].dataset.url;
                navigate(url);
            } else {
                navigate(urlInput.value);
            }
            hideAutocomplete();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            updateAutocompleteSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            updateAutocompleteSelection(items);
        } else if (e.key === 'Escape') {
            hideAutocomplete();
            urlInput.blur();
        }
    });

    urlInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            fetchAutocomplete(urlInput.value);
        }, 300);
    });

    urlInput.addEventListener('focus', () => {
        urlInput.select();
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.url-bar-container')) {
            hideAutocomplete();
        }
    });
}

async function fetchAutocomplete(query) {
    if (!query || query.length < 2) {
        hideAutocomplete();
        return;
    }

    try {
        let suggestions = [];

        // Search history for suggestions
        if (isElectronAvailable()) {
            const historyResults = await window.electronAPI.searchHistory(query);
            suggestions = historyResults.slice(0, 5).map(h => ({
                label: h.title || h.url,
                url: h.url,
                type: 'history',
            }));
        }

        // Add URL suggestion if it looks like a domain
        if (query.includes('.') && !query.includes(' ')) {
            suggestions.unshift({
                label: `https://${query}`,
                url: `https://${query}`,
                type: 'url',
            });
        }

        // Add DuckDuckGo search suggestion (navigates to search, not the literal text)
        suggestions.push({
            label: `Search "${query}"`,
            url: query,  // resolveInput on backend will convert to DuckDuckGo URL
            type: 'search',
        });

        renderAutocomplete(suggestions);
    } catch (error) {
        console.error('Autocomplete error:', error);
    }
}

function renderAutocomplete(suggestions) {
    const dropdown = document.getElementById('autocomplete-dropdown');

    if (suggestions.length === 0) {
        hideAutocomplete();
        return;
    }

    const ICONS = { history: '&#x23F2;', url: '&#x1F310;', search: '&#x1F50D;' };

    dropdown.innerHTML = suggestions.map((s, index) => `
        <div class="autocomplete-item" data-index="${index}" data-url="${escapeHtml(s.url)}">
            <span class="autocomplete-item-icon">${ICONS[s.type] || ICONS.search}</span>
            <span class="autocomplete-item-text">${escapeHtml(s.label)}</span>
        </div>
    `).join('');

    dropdown.classList.add('visible');

    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
            navigate(item.dataset.url);
            hideAutocomplete();
        });
    });
}

function updateAutocompleteSelection(items) {
    items.forEach((item, index) => {
        item.classList.toggle('selected', index === selectedIndex);
    });
}

function hideAutocomplete() {
    const dropdown = document.getElementById('autocomplete-dropdown');
    dropdown.classList.remove('visible');
    selectedIndex = -1;
}

async function navigate(input) {
    if (!input) return;

    const urlInput = document.getElementById('url-input');
    const welcomeScreen = document.getElementById('welcome-screen');
    const activeTab = document.querySelector('.tab.active');

    if (!activeTab) {
        await createTab(input);
        return;
    }

    const tabId = activeTab.dataset.tabId;

    try {
        if (isElectronAvailable()) {
            hideNavError();
            const result = await window.electronAPI.navigate(input, tabId);
            urlInput.value = result.url;

            const title = result.isSearch ? `Search: ${input}` : extractDomain(result.url);
            activeTab.querySelector('.tab-title').textContent = title;

            welcomeScreen.classList.add('hidden');
            updateBookmarkStatus(result.url);
        }
    } catch (error) {
        showToast('Navigation failed: ' + error, 'error');
    }
}

function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return url.substring(0, 30);
    }
}

// ============================================
// Modal Management
// ============================================
let pendingConfirmCallback = null;

function initModals() {
    // Add Bookmark Modal
    const addBookmarkBtn = document.getElementById('add-bookmark-btn');
    const addBookmarkModal = document.getElementById('add-bookmark-modal');
    const modalClose = document.getElementById('modal-close');
    const bookmarkCancel = document.getElementById('bookmark-cancel');
    const addBookmarkForm = document.getElementById('add-bookmark-form');

    addBookmarkBtn.addEventListener('click', () => {
        const urlInput = document.getElementById('url-input');
        document.getElementById('bookmark-title').value = '';
        document.getElementById('bookmark-url').value = urlInput.value || '';
        addBookmarkModal.classList.add('visible');
        document.getElementById('bookmark-title').focus();
    });

    modalClose.addEventListener('click', () => {
        addBookmarkModal.classList.remove('visible');
    });

    bookmarkCancel.addEventListener('click', () => {
        addBookmarkModal.classList.remove('visible');
    });

    addBookmarkForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('bookmark-title').value;
        const url = document.getElementById('bookmark-url').value;

        try {
            if (isElectronAvailable()) {
                await window.electronAPI.addBookmark(title, url, null);
                showToast('Bookmark added', 'success');
                addBookmarkModal.classList.remove('visible');
                addBookmarkForm.reset();
                loadBookmarks();
            }
        } catch (error) {
            showToast('Failed to add bookmark: ' + error, 'error');
        }
    });

    // Confirm modal buttons
    document.getElementById('confirm-cancel').addEventListener('click', () => {
        pendingConfirmCallback = null;
        document.getElementById('confirm-modal').classList.remove('visible');
    });

    document.getElementById('confirm-ok').addEventListener('click', () => {
        if (pendingConfirmCallback) {
            pendingConfirmCallback();
            pendingConfirmCallback = null;
        }
        document.getElementById('confirm-modal').classList.remove('visible');
    });

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.visible').forEach(m => m.classList.remove('visible'));
            pendingConfirmCallback = null;
        }
    });

    // Close modal on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('visible');
                pendingConfirmCallback = null;
            }
        });
    });
}

/**
 * Show a custom confirm dialog (replaces native confirm())
 */
function showConfirmDialog(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    pendingConfirmCallback = onConfirm;
    document.getElementById('confirm-modal').classList.add('visible');
}

// ============================================
// Keyboard Shortcuts
// ============================================
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

        if (ctrlKey) {
            switch (e.key.toLowerCase()) {
                case 't':
                    e.preventDefault();
                    createTab();
                    break;
                case 'w':
                    e.preventDefault();
                    const activeTab = document.querySelector('.tab.active');
                    if (activeTab) {
                        closeTab(activeTab.dataset.tabId);
                    }
                    break;
                case 'l':
                    e.preventDefault();
                    document.getElementById('url-input').focus();
                    break;
                case 'b':
                    e.preventDefault();
                    const sidebar = document.getElementById('sidebar');
                    sidebar.classList.toggle('open');
                    if (isElectronAvailable()) {
                        window.electronAPI.toggleSidebar(sidebar.classList.contains('open'));
                    }
                    break;
                case 'tab':
                    e.preventDefault();
                    if (e.shiftKey) {
                        switchToPrevTab();
                    } else {
                        switchToNextTab();
                    }
                    break;
            }
        }
    });
}

async function switchToNextTab() {
    const tabs = document.querySelectorAll('.tab');
    if (tabs.length === 0) return;

    const activeIndex = Array.from(tabs).findIndex(t => t.classList.contains('active'));
    const nextIndex = (activeIndex + 1) % tabs.length;
    if (tabs[nextIndex]) {
        await switchTab(tabs[nextIndex].dataset.tabId);
    }
}

async function switchToPrevTab() {
    const tabs = document.querySelectorAll('.tab');
    if (tabs.length === 0) return;

    const activeIndex = Array.from(tabs).findIndex(t => t.classList.contains('active'));
    const prevIndex = activeIndex === 0 ? tabs.length - 1 : activeIndex - 1;
    if (tabs[prevIndex]) {
        await switchTab(tabs[prevIndex].dataset.tabId);
    }
}

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close">&times;</button>
    `;

    container.appendChild(toast);

    toast.querySelector('.toast-close').addEventListener('click', () => {
        dismissToast(toast);
    });

    setTimeout(() => {
        dismissToast(toast);
    }, 3000);
}

function dismissToast(toast) {
    if (!toast.parentNode) return;
    toast.classList.add('toast-out');
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 300);
}

// ============================================
// Bookmarks Loading
// ============================================
async function loadBookmarks() {
    try {
        let bookmarks = [];

        if (isElectronAvailable()) {
            bookmarks = await window.electronAPI.getBookmarks(null);
        }

        renderBookmarks(bookmarks);
    } catch (error) {
        console.error('Failed to load bookmarks:', error);
    }
}

function renderBookmarks(bookmarks) {
    const list = document.getElementById('bookmarks-list');

    if (!bookmarks || bookmarks.length === 0) {
        list.innerHTML = '<div class="empty-state">No bookmarks yet</div>';
        return;
    }

    list.innerHTML = bookmarks.map(bookmark => `
        <div class="bookmark-item" data-id="${bookmark.id}" data-url="${escapeHtml(bookmark.url || '')}">
            <div class="bookmark-favicon"></div>
            <div class="bookmark-info">
                <div class="bookmark-title">${escapeHtml(bookmark.title)}</div>
                <div class="bookmark-url">${escapeHtml(bookmark.url || '')}</div>
            </div>
            <button class="bookmark-delete" title="Delete">&times;</button>
        </div>
    `).join('');

    list.querySelectorAll('.bookmark-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.bookmark-delete')) {
                e.stopPropagation();
                deleteBookmark(item.dataset.id);
            } else if (item.dataset.url) {
                navigate(item.dataset.url);
            }
        });
    });
}

async function deleteBookmark(id) {
    try {
        if (isElectronAvailable()) {
            await window.electronAPI.removeBookmark(parseInt(id));
        }
        loadBookmarks();
        showToast('Bookmark removed', 'success');
    } catch (error) {
        showToast('Failed to remove bookmark: ' + error, 'error');
    }
}

// ============================================
// History Loading
// ============================================
async function loadHistory() {
    try {
        let history = [];

        if (isElectronAvailable()) {
            history = await window.electronAPI.getHistory(50, 0);
        }

        renderHistory(history);
    } catch (error) {
        console.error('Failed to load history:', error);
    }
}

async function searchHistory(query) {
    try {
        let history = [];

        if (isElectronAvailable() && query) {
            history = await window.electronAPI.searchHistory(query);
        } else {
            await loadHistory();
            return;
        }

        renderHistory(history);
    } catch (error) {
        console.error('Failed to search history:', error);
    }
}

function renderHistory(entries) {
    const list = document.getElementById('history-list');

    if (!entries || entries.length === 0) {
        list.innerHTML = '<div class="empty-state">No history yet</div>';
        return;
    }

    list.innerHTML = entries.map(entry => `
        <div class="history-item" data-url="${escapeHtml(entry.url)}">
            <div class="history-favicon"></div>
            <div class="history-info">
                <div class="history-title">${escapeHtml(entry.title || entry.url)}</div>
                <div class="history-url">${escapeHtml(entry.url)}</div>
            </div>
            <span class="history-time">${formatTime(entry.last_visit)}</span>
        </div>
    `).join('');

    list.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            navigate(item.dataset.url);
        });
    });
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return date.toLocaleDateString();
}

// ============================================
// Utility Functions
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
