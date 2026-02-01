# Tasks Plan — Drift Browser

## 📌 Global Assumptions
- Target platforms have compatible WebView versions (WebKitGTK 4.1+ on Linux, macOS 10.15+, Windows 10+ with WebView2)
- Google autocomplete API remains publicly accessible without authentication
- EasyList and EasyPrivacy filter lists provide adequate ad coverage for v1.0
- Users accept manual updates (no auto-update in v1.0)
- SQLite single-file database sufficient for bookmarks/history without sync
- Binary size optimization achievable with Rust LTO and symbol stripping under 50MB
- 32 tab limit acceptable for target users (privacy/minimalism focus)

## ⚠️ Risks
- Google autocomplete API changes or rate limiting breaks search suggestions
- Platform WebView API differences cause rendering inconsistencies
- Adblock filter lists grow too large for sub-50MB binary constraint
- SQLite database corruption on unclean shutdown loses user data
- WebView2 runtime missing on Windows requires user manual install
- Memory usage exceeds 200MB with media-heavy tabs (video/WebGL)

## 🧩 Epics
## Project Scaffolding & Build Infrastructure
**Goal:** Establish Tauri 2 project structure with Rust backend, cross-platform build pipeline, and development tooling

### User Stories
_None_

### Acceptance Criteria
_None_

### ✅ Initialize Tauri 2 project with Rust backend (2h)

Create new Tauri 2 project using CLI, configure Cargo.toml with dependencies (tauri, serde, serde_json, url, env_logger, log), set up basic main.rs with Tauri app initialization

**Acceptance Criteria**
- Project builds successfully with `cargo tauri build`
- Empty window launches on development machine
- Tauri.conf.json configured with app name 'Drift', no default menu bar
- Cargo.toml includes strip=true and lto=true for binary size optimization

**Dependencies**
_None_

### ✅ Configure platform-specific WebView dependencies (3h)

Add platform-specific dependencies for WebKitGTK (Linux), WebKit (macOS), WebView2 (Windows) in Cargo.toml with conditional compilation flags

**Acceptance Criteria**
- Linux build compiles with WebKitGTK 4.1+ dependency
- macOS build uses native WebKit framework
- Windows build detects/requires WebView2 runtime
- Conditional compilation flags isolate platform code

**Dependencies**
- Initialize Tauri 2 project with Rust backend

### ✅ Set up GitHub Actions CI/CD for cross-platform builds (4h)

Create .github/workflows/build.yml with jobs for Linux (Arch container), macOS, Windows builds using Tauri bundler, output AppImage, DMG, MSI artifacts

**Acceptance Criteria**
- CI builds all three platforms on git push
- Artifacts uploaded to GitHub Actions artifacts storage
- Binary size verified under 50MB for all platforms
- Build failures block merge to main branch

**Dependencies**
- Configure platform-specific WebView dependencies

### ✅ Create minimal frontend HTML/CSS shell (3h)

Build basic HTML structure with URL bar input, tab container div, bookmarks sidebar div, WebView iframe container, dark theme CSS variables and base styles

**Acceptance Criteria**
- index.html renders dark-themed UI with all layout containers
- CSS uses CSS variables for colors (dark background, light text)
- No JavaScript frameworks included, only vanilla JS placeholder
- UI matches minimal design spec (no bloat, single URL bar, collapsible sidebar)

**Dependencies**
- Initialize Tauri 2 project with Rust backend

## Database Layer & Configuration
**Goal:** Implement SQLite persistence for bookmarks and history with migrations, JSON config management

### User Stories
_None_

### Acceptance Criteria
_None_

### ✅ Create DatabaseManager module with SQLite initialization (3h)

Implement src/database.rs with DatabaseManager struct, init() function to create/open SQLite connection in platform-specific app data directory, enable WAL mode

**Acceptance Criteria**
- SQLite database file created at correct platform path (Linux: ~/.local/share/drift/, macOS: ~/Library/Application Support/drift/, Windows: %APPDATA%/drift/)
- Connection pool initialized with single connection
- WAL mode enabled for concurrent reads
- Timeout set to 100ms on all queries

**Dependencies**
- Initialize Tauri 2 project with Rust backend

### ✅ Implement embedded SQL migrations for bookmarks table (2h)

Create bookmarks table schema (id, title, url, parent_id, is_folder, created_at) as embedded SQL string, run migration on DatabaseManager::init(), add index on parent_id

**Acceptance Criteria**
- Bookmarks table created with correct schema on first launch
- Migration runs idempotently (no error on re-run)
- Index on parent_id exists for folder hierarchy queries
- Foreign key constraint enforced for parent_id references

**Dependencies**
- Create DatabaseManager module with SQLite initialization

### ✅ Implement embedded SQL migrations for history table (2h)

Create history table schema (id, url UNIQUE, title, visit_time, visit_count) as embedded SQL string, run migration on init(), add index on visit_time for time-based queries

**Acceptance Criteria**
- History table created with correct schema on first launch
- UNIQUE constraint on url prevents duplicate entries
- Index on visit_time exists for chronological sorting
- visit_count defaults to 1 on insert

**Dependencies**
- Create DatabaseManager module with SQLite initialization

### ✅ Create ConfigManager module with JSON config loading (2h)

Implement src/config.rs with ConfigManager struct, Config struct (adblock_enabled, sidebar_open, restore_tabs, filter_lists, max_history_days), load config.json from app data directory, return defaults if missing

**Acceptance Criteria**
- Config loaded from config.json on startup
- Default config returned if file missing: {adblock_enabled: true, sidebar_open: true, restore_tabs: false, filter_lists: ["easylist", "easyprivacy"], max_history_days: 90}
- Malformed JSON logs error and uses defaults
- Config struct serializable with serde

**Dependencies**
- Initialize Tauri 2 project with Rust backend

### ✅ Implement ConfigManager save with atomic write (2h)

Add save() method to write config to temp file, then atomic rename to config.json, implement update_config Tauri command to persist changes

**Acceptance Criteria**
- save() writes to config.json.tmp then renames atomically
- Partial writes prevented (no corrupted config on crash)
- update_config command validates key exists in Config struct
- Invalid value types rejected with error

**Dependencies**
- Create ConfigManager module with JSON config loading

## Tab Management & WebView Coordination
**Goal:** Implement in-memory tab state management, platform-specific WebView instantiation, tab switching/reordering

### User Stories
_None_

### Acceptance Criteria
_None_

### ✅ Create TabManager module with in-memory tab state (3h)

Implement src/tabs.rs with TabManager struct holding Vec<Tab> (id: UUID, url: String, title: String, is_active: bool), create_tab(), close_tab(), switch_tab(), get_active_tab() methods

**Acceptance Criteria**
- Tabs stored in memory with unique UUIDs
- create_tab() adds new tab and sets as active
- close_tab() removes tab, cannot close last tab (error)
- switch_tab() sets is_active=true for target, false for others
- get_active_tab() returns currently active tab

**Dependencies**
- Initialize Tauri 2 project with Rust backend

### ✅ Implement max tab limit enforcement (1h)

Add MAX_TABS constant (32), check in create_tab(), return MaxTabsExceeded error if limit reached

**Acceptance Criteria**
- create_tab() rejects when 32 tabs already open
- Error message returned to frontend
- Limit logged at WARN level
- UI displays error toast (frontend task dependency)

**Dependencies**
- Create TabManager module with in-memory tab state

### ✅ Implement tab reordering logic (2h)

Add reorder_tabs(tab_ids: Vec<String>) method to TabManager, validate all tab IDs exist, reorder internal Vec to match provided order

**Acceptance Criteria**
- reorder_tabs() updates tab order in internal Vec
- Invalid tab ID returns InvalidTabOrder error
- Order persists until next reorder or tab close
- Emits tab-reordered event to frontend

**Dependencies**
- Create TabManager module with in-memory tab state

### ✅ Create WebViewCoordinator module skeleton (2h)

Implement src/webview.rs with WebViewCoordinator struct, create_webview(tab_id, url) and destroy_webview(tab_id) placeholder methods, platform-specific conditional compilation setup

**Acceptance Criteria**
- WebViewCoordinator struct compiles on all platforms
- create_webview() logs creation attempt (no actual WebView yet)
- destroy_webview() logs destruction attempt
- Platform-specific code isolated with #[cfg(target_os)] directives

**Dependencies**
- Configure platform-specific WebView dependencies

### ✅ Implement WebView instantiation for Linux (WebKitGTK) (4h)

Add WebKitGTK WebView creation in create_webview() for Linux, load URL in WebView, attach to Tauri window, store WebView handle in TabManager

**Acceptance Criteria**
- WebView created with webkit2gtk crate on Linux
- URL loaded in WebView on creation
- WebView attached to main Tauri window container
- Handle stored for later destruction

**Dependencies**
- Create WebViewCoordinator module skeleton

### ✅ Implement WebView instantiation for macOS (WebKit) (4h)

Add macOS WebView creation using WKWebView via tauri::webview API, load URL, attach to window

**Acceptance Criteria**
- WKWebView created on macOS
- URL navigation works
- WebView renders in Tauri window
- Handle stored in TabManager

**Dependencies**
- Create WebViewCoordinator module skeleton

### ✅ Implement WebView instantiation for Windows (WebView2) (4h)

Add Windows WebView2 creation via tauri::webview, check WebView2 runtime availability, load URL, attach to window

**Acceptance Criteria**
- WebView2 created on Windows
- Missing WebView2 runtime shows error dialog
- URL navigation works
- Handle stored in TabManager

**Dependencies**
- Create WebViewCoordinator module skeleton

### ✅ Expose create_tab, close_tab, switch_tab Tauri commands (2h)

Implement #[tauri::command] functions for create_tab(url: Option<String>), close_tab(tab_id: String), switch_tab(tab_id: String), wire to TabManager methods, register in main.rs

**Acceptance Criteria**
- create_tab command callable from frontend, returns tab_id
- close_tab command removes tab from TabManager
- switch_tab command sets active tab and returns tab details
- All commands return Result with error types

**Dependencies**
- Create TabManager module with in-memory tab state
- Implement WebView instantiation for Linux (WebKitGTK)
- Implement WebView instantiation for macOS (WebKit)
- Implement WebView instantiation for Windows (WebView2)

### ✅ Expose reorder_tabs Tauri command (1h)

Implement #[tauri::command] reorder_tabs(tab_ids: Vec<String>), call TabManager::reorder_tabs(), register in main.rs

**Acceptance Criteria**
- reorder_tabs command callable from frontend
- Tab order updated in backend state
- Frontend receives success response
- Invalid tab IDs return error

**Dependencies**
- Implement tab reordering logic

## Navigation & Search Integration
**Goal:** Implement URL resolution, Google autocomplete API integration, navigation command with history recording

### User Stories
_None_

### Acceptance Criteria
_None_

### ✅ Create NavigationService module with URL vs search detection (2h)

Implement src/navigation.rs with is_url() function using url crate to parse input, return true if valid URL (has scheme or TLD), else treat as search query

**Acceptance Criteria**
- is_url("https://example.com") returns true
- is_url("example.com") returns true (infer https://)
- is_url("rust programming") returns false (search query)
- url crate used for parsing validation

**Dependencies**
- Initialize Tauri 2 project with Rust backend

### ✅ Implement Google Search URL construction (1h)

Add build_search_url(query: String) function to NavigationService, construct Google search URL: https://www.google.com/search?q=<query>

**Acceptance Criteria**
- build_search_url("rust programming") returns https://www.google.com/search?q=rust+programming
- Query properly URL-encoded with url crate
- Function returns valid URL string

**Dependencies**
- Create NavigationService module with URL vs search detection

### ✅ Implement Google autocomplete API integration (3h)

Add search_autocomplete(query: String) function to NavigationService, call https://suggestqueries.google.com/complete/search?client=chrome&q=<query>, parse JSON response, return Vec<String> suggestions

**Acceptance Criteria**
- Autocomplete API called with reqwest or ureq HTTP client
- Response parsed as JSON array of suggestions
- Network timeout set to 2 seconds
- Empty vec returned on API failure (no error to user)

**Dependencies**
- Create NavigationService module with URL vs search detection

### ✅ Implement navigate Tauri command (2h)

Create #[tauri::command] navigate(url: String, tab_id: String), call NavigationService::is_url() to resolve URL vs search, call WebViewCoordinator to load URL in tab's WebView, return final URL

**Acceptance Criteria**
- navigate command resolves search queries to Google search URLs
- navigate command loads URLs directly in WebView
- Invalid URLs return NavigationError
- TabNotFound error returned if tab_id invalid

**Dependencies**
- Implement Google Search URL construction
- Expose create_tab, close_tab, switch_tab Tauri commands

### ✅ Expose search_autocomplete Tauri command (1h)

Create #[tauri::command] search_autocomplete(query: String), call NavigationService::search_autocomplete(), return suggestions array to frontend

**Acceptance Criteria**
- search_autocomplete command callable from frontend
- Returns JSON array of suggestion strings
- Empty array on API timeout/failure
- Logged at DEBUG level for debugging

**Dependencies**
- Implement Google autocomplete API integration

### ✅ Integrate navigation with HistoryService recording (1h)

Add history recording call in navigate command after successful WebView navigation, pass URL and page title to HistoryService::record_visit()

**Acceptance Criteria**
- Successful navigation triggers history recording
- URL and title passed to HistoryService
- Navigation errors do not record history
- History service task must be complete first

**Dependencies**
- Implement navigate Tauri command
- Implement record_visit in HistoryService

## Bookmarks Management
**Goal:** Implement bookmark CRUD operations with folder hierarchy, SQLite persistence, Tauri commands

### User Stories
_None_

### Acceptance Criteria
_None_

### ✅ Create BookmarkService module with add_bookmark (2h)

Implement src/bookmarks.rs with BookmarkService struct, add_bookmark(title, url, parent_id) method inserting into SQLite bookmarks table, return Bookmark struct with id

**Acceptance Criteria**
- add_bookmark() inserts row into bookmarks table
- Returns Bookmark with auto-incremented id
- parent_id NULL for root bookmarks
- URL validated with url crate before insert

**Dependencies**
- Implement embedded SQL migrations for bookmarks table

### ✅ Implement remove_bookmark in BookmarkService (1h)

Add remove_bookmark(id: i64) method to BookmarkService, DELETE from bookmarks table, return success or BookmarkNotFound error

**Acceptance Criteria**
- remove_bookmark() deletes row by id
- Returns success if row deleted
- Returns BookmarkNotFound if id doesn't exist
- Cascades delete to child bookmarks (if folder)

**Dependencies**
- Create BookmarkService module with add_bookmark

### ✅ Implement get_bookmarks for folder hierarchy (2h)

Add get_bookmarks(parent_id: Option<i64>) method to BookmarkService, SELECT from bookmarks WHERE parent_id matches parameter, return Vec<Bookmark>

**Acceptance Criteria**
- get_bookmarks(None) returns root-level bookmarks
- get_bookmarks(Some(id)) returns bookmarks in folder
- Empty vec if no bookmarks in folder
- Sorted by created_at ascending

**Dependencies**
- Create BookmarkService module with add_bookmark

### ✅ Implement create_bookmark_folder in BookmarkService (1h)

Add create_folder(title, parent_id) method to BookmarkService, INSERT into bookmarks with is_folder=1, url=NULL, return folder id

**Acceptance Criteria**
- create_folder() inserts row with is_folder=true
- url field NULL for folders
- Returns folder id
- parent_id supports nesting folders

**Dependencies**
- Create BookmarkService module with add_bookmark

### ✅ Expose bookmark Tauri commands (2h)

Implement #[tauri::command] add_bookmark, remove_bookmark, get_bookmarks, create_bookmark_folder, wire to BookmarkService methods, register in main.rs

**Acceptance Criteria**
- All four bookmark commands callable from frontend
- Commands return JSON serialized results
- DatabaseError variants returned on SQLite failures
- Commands logged at INFO level

**Dependencies**
- Create BookmarkService module with add_bookmark
- Implement remove_bookmark in BookmarkService
- Implement get_bookmarks for folder hierarchy
- Implement create_bookmark_folder in BookmarkService

## History Management
**Goal:** Implement browsing history recording, search, clear functionality with SQLite persistence

### User Stories
_None_

### Acceptance Criteria
_None_

### ✅ Create HistoryService module with record_visit (2h)

Implement src/history.rs with HistoryService struct, record_visit(url, title) method using INSERT OR REPLACE to increment visit_count for existing URLs, store visit_time as Unix timestamp

**Acceptance Criteria**
- record_visit() inserts new history entry with visit_count=1
- Duplicate URL increments visit_count and updates visit_time
- visit_time stored as INTEGER Unix timestamp
- UNIQUE constraint on url enforced

**Dependencies**
- Implement embedded SQL migrations for history table

### ✅ Implement get_history with pagination (2h)

Add get_history(limit: i64, offset: i64) method to HistoryService, SELECT from history ORDER BY visit_time DESC with LIMIT and OFFSET, return Vec<HistoryEntry>

**Acceptance Criteria**
- get_history(50, 0) returns most recent 50 entries
- Pagination works with offset parameter
- Ordered by visit_time descending (newest first)
- Empty vec if no history

**Dependencies**
- Create HistoryService module with record_visit

### ✅ Implement search_history with LIKE query (2h)

Add search_history(query: String) method to HistoryService, SELECT from history WHERE title LIKE %query% OR url LIKE %query%, return Vec<HistoryEntry>

**Acceptance Criteria**
- search_history("rust") returns entries with 'rust' in title or URL
- Case-insensitive search (use COLLATE NOCASE in SQLite)
- Returns empty vec if no matches
- Limited to 100 results to prevent UI overload

**Dependencies**
- Create HistoryService module with record_visit

### ✅ Implement clear_history with timestamp filtering (2h)

Add clear_history(before_timestamp: Option<i64>) method to HistoryService, DELETE from history WHERE visit_time < timestamp (or all if None), return deleted count

**Acceptance Criteria**
- clear_history(Some(ts)) deletes entries before timestamp
- clear_history(None) deletes all history
- Returns count of deleted rows
- Vacuum database after clear to reclaim space

**Dependencies**
- Create HistoryService module with record_visit

### ✅ Expose history Tauri commands (1h)

Implement #[tauri::command] get_history, search_history, clear_history, wire to HistoryService methods, register in main.rs

**Acceptance Criteria**
- All three history commands callable from frontend
- Commands return JSON serialized results
- DatabaseError returned on SQLite failures
- Commands logged at INFO level

**Dependencies**
- Implement get_history with pagination
- Implement search_history with LIKE query
- Implement clear_history with timestamp filtering

## Ad Blocking Integration
**Goal:** Integrate adblock-rust engine with filter lists, custom protocol interception, toggle control

### User Stories
_None_

### Acceptance Criteria
_None_

### ✅ Add adblock-rust dependency and embed filter lists (2h)

Add adblock crate to Cargo.toml, download EasyList and EasyPrivacy filter lists, embed as static files in binary using include_str! macro

**Acceptance Criteria**
- adblock crate version 0.8+ in Cargo.toml
- easylist.txt and easyprivacy.txt in src/filters/ directory
- Filter lists embedded at compile time with include_str!
- Binary size increase under 5MB from filter lists

**Dependencies**
- Initialize Tauri 2 project with Rust backend

### ✅ Create AdblockEngine module with filter initialization (3h)

Implement src/adblock.rs with AdblockEngine struct, initialize adblock::Engine with embedded filter lists on startup, store engine in app state

**Acceptance Criteria**
- AdblockEngine initializes with EasyList + EasyPrivacy
- Engine compiled filter list loaded into memory
- Initialization time under 500ms
- Engine stored in Tauri managed state

**Dependencies**
- Add adblock-rust dependency and embed filter lists

### ✅ Implement should_block request filtering (2h)

Add should_block(url: &str, resource_type: &str) method to AdblockEngine, call adblock engine's check() method, return true if blocked, increment blocked_count

**Acceptance Criteria**
- should_block() returns true for known ad domains
- should_block() returns false for non-ad requests
- blocked_count incremented on each block
- resource_type mapped to adblock ResourceType enum

**Dependencies**
- Create AdblockEngine module with filter initialization

### ✅ Integrate adblock with WebView custom protocol (4h)

Register Tauri custom protocol handler to intercept WebView resource requests, call AdblockEngine::should_block() for each request, block if matched, allow otherwise

**Acceptance Criteria**
- Custom protocol registered for http/https schemes
- Requests intercepted before WebView loads resource
- Blocked requests return empty response
- Allowed requests proxied to original URL

**Dependencies**
- Implement should_block request filtering
- Expose create_tab, close_tab, switch_tab Tauri commands

### ✅ Implement toggle_adblock command (2h)

Add toggle(enabled: bool) method to AdblockEngine, enable/disable blocking via flag, implement #[tauri::command] toggle_adblock(enabled: bool), persist to config

**Acceptance Criteria**
- toggle_adblock(false) disables blocking
- toggle_adblock(true) enables blocking
- State persisted to config.json
- Change takes effect immediately without restart

**Dependencies**
- Implement should_block request filtering
- Implement ConfigManager save with atomic write

### ✅ Implement get_adblock_status command (1h)

Add get_status() method to AdblockEngine returning enabled flag, blocked_count, filter_lists array, expose as #[tauri::command] get_adblock_status()

**Acceptance Criteria**
- get_adblock_status() returns {enabled: bool, blocked_count: int, filter_lists: [string]}
- blocked_count reflects session total
- filter_lists returns ["easylist", "easyprivacy"]
- Command callable from frontend

**Dependencies**
- Implement toggle_adblock command

## Frontend UI Implementation
**Goal:** Build functional HTML/CSS/JS UI with tab bar, URL bar, bookmarks sidebar, keyboard shortcuts

### User Stories
_None_

### Acceptance Criteria
_None_

### ✅ Implement URL bar with search/navigate functionality (2h)

Add input element to index.html, attach JS event listener for Enter key, call window.__TAURI__.invoke('navigate') with URL/query, handle response

**Acceptance Criteria**
- Enter key in URL bar triggers navigate command
- URL bar input passed to backend as-is
- Loading indicator shown during navigation
- URL bar updated with final URL on success

**Dependencies**
- Create minimal frontend HTML/CSS shell
- Implement navigate Tauri command

### ✅ Implement autocomplete dropdown for URL bar (3h)

Add input event listener to URL bar, debounce 300ms, call search_autocomplete command, render dropdown with suggestions, select suggestion on click or arrow keys + Enter

**Acceptance Criteria**
- Autocomplete dropdown appears 300ms after typing stops
- Suggestions rendered as clickable list items
- Arrow keys navigate suggestions
- Enter selects highlighted suggestion and navigates
- Dropdown hidden on Escape or click outside

**Dependencies**
- Implement URL bar with search/navigate functionality
- Expose search_autocomplete Tauri command

### ✅ Implement tab bar rendering and tab creation (3h)

Add tab container div to HTML, render tab elements from backend tab state, add '+' button to create new tab calling create_tab command, update tab bar on tab-created event

**Acceptance Criteria**
- Tab bar displays all open tabs with titles
- '+' button creates new tab
- New tab appears in tab bar immediately
- Active tab highlighted with CSS class

**Dependencies**
- Create minimal frontend HTML/CSS shell
- Expose create_tab, close_tab, switch_tab Tauri commands

### ✅ Implement tab switching and closing (2h)

Add click listener to tab elements to call switch_tab command, add close button (X) on each tab calling close_tab command, update UI on tab-closed event

**Acceptance Criteria**
- Clicking tab switches to that tab
- Active tab updates in UI
- Close button removes tab from tab bar
- Error toast shown if attempting to close last tab

**Dependencies**
- Implement tab bar rendering and tab creation

### ✅ Implement tab drag-and-drop reordering (3h)

Add HTML5 drag-and-drop listeners to tab elements, reorder tabs in UI on drop, call reorder_tabs command with new order, handle reordering errors

**Acceptance Criteria**
- Tabs draggable within tab bar
- Tab order updates in UI on drop
- Backend state updated via reorder_tabs command
- Drag visual feedback (ghost image)

**Dependencies**
- Implement tab switching and closing
- Expose reorder_tabs Tauri command

### ✅ Implement collapsible bookmarks sidebar (4h)

Add sidebar div with toggle button, fetch bookmarks via get_bookmarks command on load, render bookmarks as nested list (folders + bookmarks), toggle sidebar with button click, persist state to config

**Acceptance Criteria**
- Sidebar renders bookmarks in folder hierarchy
- Toggle button shows/hides sidebar with CSS transition
- Sidebar state persisted to config.json
- Folders expandable/collapsible with click

**Dependencies**
- Create minimal frontend HTML/CSS shell
- Expose bookmark Tauri commands

### ✅ Implement bookmark add/remove UI (3h)

Add 'Add Bookmark' button in sidebar, show modal dialog with title/URL inputs, call add_bookmark command, update sidebar on success, add delete button per bookmark calling remove_bookmark

**Acceptance Criteria**
- Add Bookmark button shows modal dialog
- Dialog validates URL before submit
- Bookmark added to sidebar on success
- Delete button removes bookmark from sidebar
- Modal closes on Escape or cancel

**Dependencies**
- Implement collapsible bookmarks sidebar

### ✅ Implement history sidebar panel (3h)

Add history panel to sidebar (tab switcher between bookmarks/history), fetch history via get_history command, render as chronological list, implement search input calling search_history, add clear history button

**Acceptance Criteria**
- History panel shows recent visits
- Search input filters history in real-time
- Clear history button shows confirmation dialog
- Clicking history entry navigates to URL

**Dependencies**
- Implement collapsible bookmarks sidebar
- Expose history Tauri commands

### ✅ Implement keyboard shortcuts (2h)

Add global keydown listener, map Ctrl+T (new tab), Ctrl+W (close tab), Ctrl+Tab (next tab), Ctrl+Shift+Tab (prev tab), Ctrl+L (focus URL bar), Ctrl+B (toggle sidebar), call corresponding commands

**Acceptance Criteria**
- Ctrl+T creates new tab
- Ctrl+W closes active tab
- Ctrl+Tab cycles through tabs
- Ctrl+L focuses URL bar
- Ctrl+B toggles bookmarks sidebar
- Shortcuts work regardless of focus

**Dependencies**
- Implement URL bar with search/navigate functionality
- Implement tab switching and closing
- Implement collapsible bookmarks sidebar

### ✅ Implement dark theme CSS (2h)

Define CSS variables for dark theme colors (--bg-primary: #1a1a1a, --text-primary: #e0e0e0, --accent: #4a90e2), apply to all UI elements, ensure sufficient contrast for accessibility

**Acceptance Criteria**
- All UI elements use CSS variables
- Background dark (#1a1a1a or similar)
- Text light (#e0e0e0 or similar)
- Accent color for active tab/buttons (#4a90e2 or similar)
- Contrast ratio 4.5:1+ for WCAG AA compliance

**Dependencies**
- Create minimal frontend HTML/CSS shell

### ✅ Implement error toast notifications (2h)

Create toast component (div with fixed position), show toast with error message on command failures, auto-dismiss after 3 seconds, support stacking multiple toasts

**Acceptance Criteria**
- Toast appears at top-right of window
- Error messages displayed with red accent
- Auto-dismiss after 3 seconds
- Multiple toasts stack vertically
- Click to dismiss immediately

**Dependencies**
- Create minimal frontend HTML/CSS shell

## Configuration & Settings UI
**Goal:** Expose config management via Tauri commands, build minimal settings UI for adblock toggle and sidebar preferences

### User Stories
_None_

### Acceptance Criteria
_None_

### ✅ Expose get_config and update_config Tauri commands (1h)

Implement #[tauri::command] get_config() returning full Config struct, update_config(key, value) calling ConfigManager::set(), register commands in main.rs

**Acceptance Criteria**
- get_config() returns JSON config object
- update_config("adblock_enabled", false) persists change
- Invalid keys return ConfigError
- Commands callable from frontend

**Dependencies**
- Implement ConfigManager save with atomic write

### ✅ Add adblock toggle to UI (2h)

Add toggle switch in sidebar or toolbar for adblock, bind to get_adblock_status and toggle_adblock commands, show blocked count badge when enabled

**Acceptance Criteria**
- Toggle switch reflects adblock enabled state
- Clicking toggle calls toggle_adblock command
- Blocked count badge updates on page loads
- State persists across restarts

**Dependencies**
- Implement get_adblock_status command
- Implement collapsible bookmarks sidebar

## Testing & Quality Assurance
**Goal:** Write unit, integration, and E2E tests to validate core functionality and meet non-functional requirements

### User Stories
_None_

### Acceptance Criteria
_None_

### ✅ Write unit tests for NavigationService (2h)

Test is_url() with valid URLs, invalid URLs, search queries; test build_search_url() encoding; use #[cfg(test)] module in navigation.rs

**Acceptance Criteria**
- is_url() correctly identifies URLs vs search queries
- build_search_url() properly encodes special characters
- All tests pass with `cargo test`
- Test coverage >80% for NavigationService

**Dependencies**
- Create NavigationService module with URL vs search detection
- Implement Google Search URL construction

### ✅ Write unit tests for BookmarkService CRUD (3h)

Test add_bookmark, remove_bookmark, get_bookmarks with mocked SQLite connection using in-memory database

**Acceptance Criteria**
- CRUD operations work with in-memory SQLite
- Duplicate bookmarks handled correctly
- Folder hierarchy queries return correct results
- All tests pass

**Dependencies**
- Expose bookmark Tauri commands

### ✅ Write unit tests for HistoryService (3h)

Test record_visit increments visit_count, search_history LIKE query, clear_history timestamp filtering, use in-memory SQLite

**Acceptance Criteria**
- record_visit correctly handles duplicates
- search_history returns matching entries
- clear_history deletes correct entries
- All tests pass

**Dependencies**
- Expose history Tauri commands

### ✅ Write unit tests for AdblockEngine (2h)

Test should_block() with known ad domains from EasyList, test non-ad domains pass through, test toggle enable/disable

**Acceptance Criteria**
- Ad domains blocked correctly
- Non-ad domains allowed
- Toggle updates blocking behavior
- All tests pass

**Dependencies**
- Implement toggle_adblock command

### ✅ Write integration test for Tauri command invocation (3h)

Use Tauri test harness to invoke commands (create_tab, add_bookmark, navigate) from mock frontend, verify responses

**Acceptance Criteria**
- Commands callable via Tauri IPC in test
- Responses match expected JSON schema
- Errors returned correctly
- All tests pass

**Dependencies**
- Expose create_tab, close_tab, switch_tab Tauri commands
- Expose bookmark Tauri commands
- Implement navigate Tauri command

### ✅ Write integration test for SQLite migrations (2h)

Test DatabaseManager::init() creates tables correctly, test migrations run idempotently, test database corruption recovery

**Acceptance Criteria**
- Tables created on fresh database
- Migrations don't fail on re-run
- Corrupted database triggers schema recreation
- All tests pass

**Dependencies**
- Implement embedded SQL migrations for bookmarks table
- Implement embedded SQL migrations for history table

### ✅ Write E2E test for tab creation and navigation (4h)

Use Tauri WebDriver or Playwright to launch app, create tab, enter URL in URL bar, verify WebView loads page, verify tab appears in tab bar

**Acceptance Criteria**
- App launches successfully
- Tab created via UI interaction
- URL navigation loads page in WebView
- Tab title updates after page load
- Test runs on Linux CI

**Dependencies**
- Implement URL bar with search/navigate functionality
- Implement tab bar rendering and tab creation

### ✅ Write E2E test for bookmark persistence (3h)

Launch app, add bookmark via UI, close app, relaunch, verify bookmark still exists in sidebar

**Acceptance Criteria**
- Bookmark added via UI
- App closed cleanly
- Bookmark loaded on relaunch
- Test runs on Linux CI

**Dependencies**
- Implement bookmark add/remove UI

### ✅ Write E2E test for adblock functionality (3h)

Launch app, navigate to page with ads (test page), verify adblock status shows blocked count > 0, toggle adblock off, reload page, verify ads load

**Acceptance Criteria**
- Ads blocked on test page with adblock enabled
- Blocked count increments
- Ads load when adblock disabled
- Test runs on Linux CI

**Dependencies**
- Add adblock toggle to UI
- Integrate adblock with WebView custom protocol

### ✅ Validate binary size under 50MB (2h)

Build release binary for all platforms, measure binary size, fail CI if >50MB, optimize with strip and LTO if needed

**Acceptance Criteria**
- Linux binary <50MB
- macOS binary <50MB
- Windows binary <50MB
- CI job fails if size exceeded

**Dependencies**
- Set up GitHub Actions CI/CD for cross-platform builds

### ✅ Validate cold start time under 1 second (2h)

Measure app launch time from process start to first window render on mid-range hardware, optimize initialization if needed

**Acceptance Criteria**
- Launch time <1s on Ubuntu VM with 2 CPU cores
- Measured with `time` command or custom timer
- Test documented in README

**Dependencies**
- Implement URL bar with search/navigate functionality

### ✅ Validate memory usage under 200MB for 5 tabs (1h)

Open 5 tabs with different websites, measure RSS with `ps` or task manager, verify <200MB total, document in README

**Acceptance Criteria**
- 5 tabs open with real websites
- RSS <200MB measured
- Test repeatable on Linux/macOS/Windows

**Dependencies**
- Implement tab switching and closing

## Documentation & Release Preparation
**Goal:** Write README with installation instructions, build from source guide, keyboard shortcuts reference, prepare GitHub Release

### User Stories
_None_

### Acceptance Criteria
_None_

### ✅ Write README.md with installation instructions (2h)

Document installation steps for Linux (AppImage chmod +x, move to /usr/local/bin), macOS (DMG install), Windows (MSI installer), include WebView2 requirement for Windows

**Acceptance Criteria**
- README includes installation for all platforms
- WebView2 requirement documented for Windows
- Linux: AppImage permissions and PATH setup
- macOS: DMG mount and drag-to-Applications
- Markdown formatted, hosted in repo root

**Dependencies**
- Set up GitHub Actions CI/CD for cross-platform builds

### ✅ Document build from source instructions (1h)

Add section to README with prerequisites (Rust, Node.js, platform WebView dependencies), `cargo tauri build` command, troubleshooting common build errors

**Acceptance Criteria**
- Prerequisites listed for all platforms
- Build command documented
- Troubleshooting section for common errors (missing WebKitGTK, WebView2)
- Tested on fresh Arch Linux install

**Dependencies**
- Write README.md with installation instructions

### ✅ Document keyboard shortcuts reference (1h)

Add keyboard shortcuts table to README: Ctrl+T (new tab), Ctrl+W (close), Ctrl+Tab (next tab), Ctrl+L (URL bar focus), Ctrl+B (toggle sidebar)

**Acceptance Criteria**
- All shortcuts documented in table
- Platform differences noted (Cmd on macOS vs Ctrl)
- Shortcuts match implemented functionality

**Dependencies**
- Implement keyboard shortcuts

### ✅ Create GitHub Release v1.0.0 (2h)

Tag commit as v1.0.0, create GitHub Release with binaries (AppImage, DMG, MSI) from CI artifacts, write release notes highlighting features and known limitations

**Acceptance Criteria**
- v1.0.0 tag pushed to main branch
- GitHub Release created with all platform binaries
- Release notes include feature list and known limitations
- Download links functional

**Dependencies**
- Validate binary size under 50MB
- Write E2E test for adblock functionality
- Document keyboard shortcuts reference

## ❓ Open Questions
- Should tab restore on startup be opt-in or opt-out?
- What is max history retention period (90 days default vs unlimited)?
- Should bookmarks sidebar default to open or closed?
- How to handle SSL certificate errors (block, warn, allow)?
- Should autocomplete mix Google suggestions with local history?
- What is fallback behavior if Google API unreachable (local history only, empty)?
- Should adblock stats persist across sessions or reset?
- What is the strategy for filter list updates (manual download, bundled in app updates)?
- Should navigation errors show modal dialog or inline banner?