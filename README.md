<p align="center">
  <img src="build/icon.svg" width="128" height="128" alt="nodaysidle">
</p>

<h1 align="center">nodaysidle</h1>

<p align="center">
  <strong>A minimal, privacy-first web browser.</strong><br>
  Zero telemetry. Built-in ad blocking. Your data stays on your machine.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux-333?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/electron-40.1.0-47848f?style=flat-square" alt="Electron">
  <img src="https://img.shields.io/badge/license-MIT-d4a72c?style=flat-square" alt="License">
</p>

---

## Why

Most browsers quietly phone home, track your history, and serve you ads disguised as features. nodaysidle does none of that.

- **No telemetry** -- not even font loading from Google (fonts are self-hosted)
- **No accounts** -- no sign-in, no sync, no cloud
- **No bloat** -- vanilla JS, one dependency (SQLite), that's it
- **Built-in ad blocker** -- 80+ ad domains blocked at the network level, plus YouTube-specific ad skipping

Your bookmarks and history live in a local SQLite database. When you close the browser, nothing leaves your machine.

---

## Features

| | |
|---|---|
| **Ad Blocking** | Network-level blocking (84 ad domains, O(1) lookup) + YouTube DOM injection that auto-skips video ads and speeds unskippable ones 16x |
| **Tab Management** | Create, close, drag-to-reorder, keyboard cycle through tabs |
| **Bookmarks** | One-click bookmark from URL bar, sidebar panel, folder support |
| **History** | Full browsing history with search, timestamps, visit counts |
| **Dark Theme** | Warm charcoal + amber accent, JetBrains Mono throughout |
| **Keyboard-First** | Full shortcut support for power users |
| **Error Handling** | Friendly error pages for DNS failures, timeouts, SSL errors |
| **DuckDuckGo Search** | Privacy-respecting search as default |

---

## Install

### macOS

**From release:**

Download the `.dmg` from [Releases](https://github.com/salvadalba/nodaysidle-minimalbrowser/releases), open it, drag to Applications.

**From source:**

```bash
git clone https://github.com/salvadalba/nodaysidle-minimalbrowser.git
cd nodaysidle-minimalbrowser
npm install
npm run build:mac
cp -R dist/mac-arm64/nodaysidle.app /Applications/
```

### Linux

```bash
git clone https://github.com/salvadalba/nodaysidle-minimalbrowser.git
cd nodaysidle-minimalbrowser
npm install
npm run build:linux
chmod +x dist/nodaysidle-*.AppImage
./dist/nodaysidle-*.AppImage
```

### Run in dev mode

```bash
npm install
npm run dev    # opens with DevTools
```

---

## Keyboard Shortcuts

All shortcuts use `Cmd` on macOS, `Ctrl` on Linux.

| Shortcut | Action |
|:---------|:-------|
| `Cmd+T` | New tab |
| `Cmd+W` | Close tab |
| `Cmd+L` | Focus URL bar |
| `Cmd+B` | Toggle sidebar |
| `Cmd+Tab` | Next tab |
| `Cmd+Shift+Tab` | Previous tab |

---

## Architecture

```
electron/
  main.js            Main process -- window, BrowserViews, ad blocking, IPC
  preload.js         Secure IPC bridge (contextIsolation + no nodeIntegration)
  database.js        SQLite with cached prepared statements (WAL mode)
  tabs.js            Tab state manager (crypto.randomUUID IDs)
  youtube-adblock.js Content script injected into YouTube pages

src/
  index.html         UI shell
  styles.css         Warm dark theme (self-hosted JetBrains Mono)
  main.js            Frontend logic (vanilla JS, no frameworks)
  fonts/             Bundled woff2 font files
```

### How ad blocking works

**Layer 1 -- Network interception** (`webRequest.onBeforeRequest`):
Requests are checked against a structured pattern set. Domain matching uses suffix decomposition + `Set.has()` for true O(1) lookups. YouTube, Facebook, and generic path/regex patterns are checked conditionally.

**Layer 2 -- YouTube DOM injection** (`youtube-adblock.js`):
A content script injected on YouTube pages that uses `MutationObserver` to detect the `ad-showing` class on the video player. Skippable ads are clicked away, unskippable ads are sped up 16x and muted, overlay ads are hidden via CSS.

### Performance choices

- **Prepared statements** -- All 15 SQL queries compiled once at startup, not per-call
- **O(1) domain matching** -- Hostname suffix decomposition into Set lookups, not iteration
- **IPC listener safety** -- `removeAllListeners` before registering to prevent leaks
- **Font self-hosting** -- No external network requests on startup
- **WAL journal mode** -- Concurrent reads without blocking

---

## Privacy model

| What | Where it goes |
|:-----|:-------------|
| Bookmarks | `~/Library/Application Support/nodaysidle/drift.db` |
| History | Same SQLite file |
| Fonts | Bundled in the app binary |
| Search queries | Sent to DuckDuckGo (their privacy policy applies) |
| Telemetry | Nowhere. There is none. |
| Analytics | None |
| Crash reports | None |

---

## Build

```bash
npm run build:mac     # macOS .dmg + .app
npm run build:linux   # Linux .AppImage
npm run build:win     # Windows .exe (NSIS)
```

Builds are handled by [electron-builder](https://www.electron.build/). CI/CD via GitHub Actions on version tags (`v*`).

---

## License

MIT

---

<p align="center">
  <sub>made with <strong>nodaysidle</strong></sub>
</p>
