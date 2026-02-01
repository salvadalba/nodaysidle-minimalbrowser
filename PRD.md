# Drift

## 🎯 Product Vision
A minimal, privacy-focused web browser that respects user privacy while delivering fast, clean browsing with built-in ad blocking and zero telemetry.

## ❓ Problem Statement
Modern browsers are bloated with unnecessary features, track user behavior extensively, and consume excessive system resources. Users who value privacy and minimalism lack a lightweight browser option that provides essential features without compromise.

## 🎯 Goals
- Deliver a sub-50MB binary that launches instantly and uses minimal system resources
- Provide zero-telemetry browsing with built-in ad blocking using Brave's adblock-rust engine
- Offer essential browser features: tabs, bookmarks, history, and search without bloat
- Maintain a clean, minimal dark-themed interface focused on content over chrome
- Support cross-platform deployment on Linux (Arch), macOS, and Windows using native WebViews

## 🚫 Non-Goals
- Browser extensions or plugin ecosystem
- Syncing across devices or cloud integration
- Developer tools or advanced debugging features
- Password manager or form autofill
- Multiple theme options or UI customization
- Video conferencing or built-in communication tools
- Reading mode or article parsing

## 👥 Target Users
- Privacy-conscious users who distrust mainstream browsers with telemetry
- Minimalist users who want fast browsing without feature bloat
- Resource-conscious users on older hardware or limited systems
- Linux power users (particularly Arch users) seeking lightweight alternatives
- Users frustrated with excessive memory consumption of Chrome/Firefox

## 🧩 Core Features
- URL/Search bar with Google search integration and autocomplete suggestions
- Tab management: create, close, switch between, and reorder tabs via tab bar
- Collapsible bookmarks sidebar with add/remove/organize functionality stored in SQLite
- Browsing history with view/search/clear capabilities stored in SQLite
- Built-in ad blocking using adblock-rust (Brave's engine) with default filter lists and toggle control
- Keyboard shortcuts for navigation without menu bar dependency
- Dark theme default interface with minimal UI chrome
- Native WebView rendering (WebKitGTK on Linux, WebKit on macOS, WebView2 on Windows)

## ⚙️ Non-Functional Requirements
- Binary size must not exceed 50MB
- Zero telemetry or tracking - no data collection whatsoever
- Cold start time under 1 second on modern hardware
- Memory usage under 200MB for 5 active tabs
- SQLite database operations complete within 100ms for typical queries
- Ad blocking should not introduce noticeable page load delays
- UI must remain responsive during page loads and tab switches
- Settings stored in local JSON config file with human-readable format
- Cross-platform compatibility: Linux (Arch), macOS, Windows

## 📊 Success Metrics
- Binary size remains under 50MB across all platforms
- Memory footprint 60% lower than Chrome for equivalent tab count
- 90% of ads blocked on standard filter lists without user intervention
- Launch time under 1 second measured on mid-range hardware
- User retention rate above 70% after 30 days among early adopters
- Zero crashes or data loss incidents in bookmark/history storage
- 100% of core features accessible via keyboard shortcuts

## 📌 Assumptions
- Users have Google as their preferred search engine (no alternative search engine support initially)
- SQLite is sufficient for bookmark and history storage without need for syncing
- Default adblock-rust filter lists provide adequate coverage for most users
- Users prefer dark theme and do not require theme customization
- Native WebView APIs provide sufficient rendering capabilities without Chromium embedding
- Users are comfortable with keyboard-driven workflows without traditional menu bars
- Target platforms (Arch Linux, macOS, Windows) have compatible WebView implementations
- JSON configuration files are acceptable for settings persistence

## ❓ Open Questions
- What specific Google Search API should be used for autocomplete suggestions?
- How should bookmark organization work - folders, tags, or flat list?
- What default filter lists should be included in adblock-rust configuration?
- Should history be cleared automatically after a certain period or only manually?
- What keyboard shortcuts should be implemented as defaults?
- How should tabs persist across browser restarts - restore session or clean start?
- Should the bookmarks sidebar be open or closed by default?
- What is the maximum number of concurrent tabs before performance degrades?
- How should navigation errors (404, DNS failures) be displayed to users?