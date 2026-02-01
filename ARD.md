# Architecture Requirements Document

## 🧱 System Overview
Drift is a native desktop application built with Tauri 2, combining a Rust backend with platform-native WebView rendering. The architecture prioritizes minimal binary size (<50MB), zero telemetry, and privacy through built-in ad blocking. Core data (bookmarks, history) persists in SQLite, while user preferences live in a JSON config file. The UI layer uses minimal HTML/CSS rendered in native WebViews (WebKitGTK on Linux, WebKit on macOS, WebView2 on Windows).

## 🏗 Architecture Style
Monolithic desktop application with event-driven communication between Rust backend and WebView frontend via Tauri IPC bridge

## 🎨 Frontend Architecture
- **Framework:** Tauri 2 WebView with vanilla HTML/CSS/JavaScript (no frameworks)
- **State Management:** Browser state managed in Rust backend, UI state synchronized via Tauri IPC events
- **Routing:** Single-window application with sidebar toggle and tab switching handled by backend state
- **Build Tooling:** Tauri CLI with Rust toolchain (cargo), minimal JavaScript bundling

## 🧠 Backend Architecture
- **Approach:** Single Rust binary with embedded resources, all business logic in Rust core
- **API Style:** Tauri commands exposed via IPC (async Rust functions callable from WebView JavaScript)
- **Services:**
- Navigation service: URL resolution, Google Search API integration, autocomplete
- Tab manager: Tab lifecycle, switching, reordering state
- Bookmark service: CRUD operations on SQLite bookmark store
- History service: Tracking, search, clearing on SQLite history store
- Adblock engine: adblock-rust filter list management and request blocking
- WebView coordinator: Platform-specific WebView instantiation and message routing
- Config manager: JSON file read/write for user settings

## 🗄 Data Layer
- **Primary Store:** SQLite database for persistent data (bookmarks, history) with separate tables; JSON file for configuration
- **Relationships:** Flat bookmark structure with optional parent_id for folders; history entries linked to URLs with timestamps; no cross-table relationships
- **Migrations:** Embedded SQL migrations in Rust binary executed on application startup using rusqlite migration utilities

## ☁️ Infrastructure
- **Hosting:** Standalone native binaries distributed per platform (no server infrastructure)
- **Scaling Strategy:** Single-user desktop application; performance scales with SQLite query optimization and adblock-rust filter efficiency
- **CI/CD:** GitHub Actions for cross-platform builds (Linux/macOS/Windows) with Tauri bundler generating platform-specific installers

## ⚖️ Key Trade-offs
- Native WebViews instead of embedded Chromium: 40MB+ size savings but less rendering consistency across platforms
- No extension system: Maintains sub-50MB binary and attack surface reduction at cost of user customization
- Google Search hardcoded: Simplifies implementation but locks users into single search provider
- SQLite over cloud sync: Ensures privacy and simplicity but prevents cross-device bookmark/history access
- Vanilla JS over framework: Reduces bundle size and complexity but requires manual DOM management
- JSON config over GUI settings: Keeps UI minimal but less discoverable for non-technical users

## 📐 Non-Functional Requirements
- Binary size under 50MB across all platforms
- Cold start under 1 second on modern hardware
- Memory usage under 200MB for 5 active tabs
- SQLite operations complete within 100ms
- Ad blocking with zero noticeable latency on page loads
- Zero telemetry or external network requests except user-initiated navigation and Google autocomplete
- UI responsiveness maintained during concurrent tab loads
- Cross-platform compatibility: Arch Linux (WebKitGTK), macOS (WebKit), Windows (WebView2)