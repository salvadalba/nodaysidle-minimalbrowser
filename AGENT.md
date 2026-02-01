# Agent Prompts — Drift Browser

## 🧭 Global Rules

### ✅ Do
- Use Tauri 2 with Rust backend exactly as specified
- Keep binary size under 50MB with strip=true and lto=true
- Use platform-native WebViews (WebKitGTK/WebKit/WebView2)
- Store bookmarks and history in SQLite with parameterized queries
- Embed adblock-rust filter lists (EasyList, EasyPrivacy) as static files
- Use vanilla HTML/CSS/JS for frontend (no frameworks)
- Validate all URLs with url crate before navigation or storage
- Log errors at appropriate levels (ERROR/WARN/INFO/DEBUG) with env_logger
- Return Result types from all Tauri commands with custom error enums
- Use atomic file writes (temp file + rename) for config persistence

### ❌ Don't
- Add browser extensions, plugin systems, or third-party integrations
- Implement telemetry, analytics, or any external data collection
- Use JavaScript frameworks (React, Vue, etc.) - vanilla JS only
- Embed Chromium or bundle non-native WebView engines
- Add password managers, sync features, or cloud integration
- Create GUI settings panels - JSON config file only
- Use eval(), innerHTML, or render user-generated HTML
- Exceed 50MB binary size on any platform
- Hardcode search engines other than Google
- Implement auto-update mechanisms in v1.0

## 🧩 Task Prompts
## Initialize Tauri 2 Project

**Context**
Create the foundational Tauri 2 desktop application structure with Rust backend configured for minimal binary size and cross-platform WebView support.

### Universal Agent Prompt
```
_No prompt generated_
```

---

## Database and Config Layer

**Context**
Implement SQLite database manager for bookmarks and history with embedded migrations, plus JSON configuration file management with atomic writes.

### Universal Agent Prompt
```
_No prompt generated_
```

---

## Tab Management and WebView Coordination

**Context**
Build in-memory tab state manager and platform-specific WebView instantiation for Linux (WebKitGTK), macOS (WebKit), and Windows (WebView2).

### Universal Agent Prompt
```
_No prompt generated_
```

---

## Navigation and Google Search Integration

**Context**
Implement URL vs search query detection, Google autocomplete API integration, and navigation command with history recording integration.

### Universal Agent Prompt
```
_No prompt generated_
```

---

## Bookmarks and History Services

**Context**
Implement CRUD operations for bookmarks with folder hierarchy and history recording with search/clear functionality, both persisted in SQLite.

### Universal Agent Prompt
```
_No prompt generated_
```