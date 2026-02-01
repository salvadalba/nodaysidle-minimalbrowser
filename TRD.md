# Technical Requirements Document

## 🧭 System Context
Drift is a privacy-focused web browser built as a Tauri 2 desktop application. The Rust backend manages all browser state (tabs, bookmarks, history), integrates adblock-rust for request filtering, and coordinates platform-native WebViews. The frontend is minimal HTML/CSS/JS rendered in native WebViews (WebKitGTK on Arch Linux, WebKit on macOS, WebView2 on Windows). SQLite stores persistent data, JSON stores configuration. No telemetry or external services except user-initiated navigation and Google autocomplete API.

## 🔌 API Contracts
### navigate
- **Method:** Tauri Command
- **Description:** _Not specified_

### search_autocomplete
- **Method:** Tauri Command
- **Description:** _Not specified_

### create_tab
- **Method:** Tauri Command
- **Description:** _Not specified_

### close_tab
- **Method:** Tauri Command
- **Description:** _Not specified_

### switch_tab
- **Method:** Tauri Command
- **Description:** _Not specified_

### reorder_tabs
- **Method:** Tauri Command
- **Description:** _Not specified_

### add_bookmark
- **Method:** Tauri Command
- **Description:** _Not specified_

### remove_bookmark
- **Method:** Tauri Command
- **Description:** _Not specified_

### get_bookmarks
- **Method:** Tauri Command
- **Description:** _Not specified_

### create_bookmark_folder
- **Method:** Tauri Command
- **Description:** _Not specified_

### get_history
- **Method:** Tauri Command
- **Description:** _Not specified_

### search_history
- **Method:** Tauri Command
- **Description:** _Not specified_

### clear_history
- **Method:** Tauri Command
- **Description:** _Not specified_

### toggle_adblock
- **Method:** Tauri Command
- **Description:** _Not specified_

### get_adblock_status
- **Method:** Tauri Command
- **Description:** _Not specified_

### get_config
- **Method:** Tauri Command
- **Description:** _Not specified_

### update_config
- **Method:** Tauri Command
- **Description:** _Not specified_

## 🧱 Modules
### NavigationService
- **Responsibility:** _Not specified_
- **Dependencies:**
_None_

### TabManager
- **Responsibility:** _Not specified_
- **Dependencies:**
_None_

### BookmarkService
- **Responsibility:** _Not specified_
- **Dependencies:**
_None_

### HistoryService
- **Responsibility:** _Not specified_
- **Dependencies:**
_None_

### AdblockEngine
- **Responsibility:** _Not specified_
- **Dependencies:**
_None_

### WebViewCoordinator
- **Responsibility:** _Not specified_
- **Dependencies:**
_None_

### DatabaseManager
- **Responsibility:** _Not specified_
- **Dependencies:**
_None_

### ConfigManager
- **Responsibility:** _Not specified_
- **Dependencies:**
_None_

### FrontendUI
- **Responsibility:** _Not specified_
- **Dependencies:**
_None_

## 🗃 Data Model Notes
### Unknown Entity
_None_

### Unknown Entity
_None_

### Unknown Entity
_None_

### Unknown Entity
_None_

### Unknown Entity
_None_

### Unknown Entity
_None_

### Unknown Entity
_None_

## 🔐 Validation & Security
- **Rule:** _Not specified_
- **Rule:** _Not specified_
- **Rule:** _Not specified_
- **Rule:** _Not specified_
- **Rule:** _Not specified_
- **Rule:** _Not specified_
- **Rule:** _Not specified_
- **Rule:** _Not specified_
- **Rule:** _Not specified_
- **Rule:** _Not specified_

## 🧯 Error Handling Strategy
All Tauri commands return Result<T, E> with custom error enum (NavigationError, DatabaseError, ConfigError). Frontend displays error notifications via toast UI component (3-second auto-dismiss). Critical errors (database corruption, config write failure) log to stderr and attempt graceful recovery (recreate schema, reset to default config). Network errors (Google API timeout) fail silently with empty autocomplete results. Tab closure errors (cannot close last tab) show inline error message in tab bar.

## 🔭 Observability
- **Logging:** Use env_logger crate with log levels: ERROR for unrecoverable failures, WARN for degraded functionality (adblock filter load failure), INFO for user actions (tab created, bookmark added), DEBUG for IPC calls. Logs written to stdout only (no file logging to minimize disk I/O).
- **Tracing:** No distributed tracing (single-process desktop app). Use debug logs for async task flow debugging during development only.
- **Metrics:**
- Startup time (measured from main() to first window render)
- Memory usage per tab (RSS sampled every 30 seconds)
- Adblock blocked request count (in-memory counter, displayed in UI)
- SQLite query latency (histogram, p50/p95/p99)
- Tab count (gauge)
- Autocomplete API latency (histogram)

## ⚡ Performance Notes
- **Metric:** _Not specified_
- **Metric:** _Not specified_
- **Metric:** _Not specified_
- **Metric:** _Not specified_
- **Metric:** _Not specified_
- **Metric:** _Not specified_
- **Metric:** _Not specified_
- **Metric:** _Not specified_

## 🧪 Testing Strategy
### Unit
- URL resolution logic (is_url() vs is_search_query())
- Bookmark CRUD operations with mocked SQLite connection
- History search query construction and result parsing
- Adblock filter matching with sample URLs and filter rules
- Config serialization/deserialization with malformed JSON
- Tab manager state transitions (create, close, switch, reorder)
### Integration
- End-to-end Tauri command invocation from frontend to backend response
- SQLite migrations applied correctly on fresh database
- Adblock engine blocks known ad domains from EasyList
- Google autocomplete API returns valid suggestions for sample queries
- Config persistence survives app restart
- WebView navigation emits correct page load events to history service
### E2E
- Launch app, create tab, navigate to URL, verify page loads in WebView
- Add bookmark, close app, relaunch, verify bookmark persists
- Navigate to multiple pages, open history sidebar, search for visited URL
- Toggle adblock off, verify ads load; toggle on, verify ads blocked
- Open 10 tabs, switch between them, verify active tab state updates correctly
- Close all tabs except one, verify cannot close last tab error

## 🚀 Rollout Plan
### Phase
_Not specified_

### Phase
_Not specified_

### Phase
_Not specified_

### Phase
_Not specified_

### Phase
_Not specified_

### Phase
_Not specified_

### Phase
_Not specified_

## ❓ Open Questions
- Should autocomplete include local history results mixed with Google suggestions?
- What is the exact keyboard shortcut mapping (Ctrl+T for new tab, Ctrl+W for close, etc.)?
- Should tab restore on startup be opt-in or opt-out default?
- What is the maximum history retention period (default to 90 days with manual clear override)?
- Should bookmarks sidebar show folder tree or flat list by default?
- How should navigation errors (DNS failure, SSL errors) be presented (blocking modal vs inline banner)?
- What is the fallback behavior if Google autocomplete API is unreachable (empty suggestions vs local history only)?
- Should adblock stats (blocked count) persist across sessions or reset on restart?
- What is the policy for filter list updates (manual user update vs bundled in app updates)?