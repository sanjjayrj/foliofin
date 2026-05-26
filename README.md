# FolioFin

A Jellyfin reading client built with Tauri v2 + React + TypeScript. Supports EPUB, PDF, CBZ, and CBR formats with offline downloads, highlights, annotations, and search.

---

## Build from source

### Prerequisites

#### All platforms

- **Node.js** 18+ and **npm** — [nodejs.org](https://nodejs.org)
- **Rust** (stable) — install via [rustup.rs](https://rustup.rs):
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

#### Linux (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libxdo-dev
```

#### Linux (Fedora/RHEL)

```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  openssl-devel \
  gtk3-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel \
  patchelf
```

#### macOS

Install Xcode Command Line Tools:

```bash
xcode-select --install
```

No additional system libraries are required.

#### Windows

Install the [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **Desktop development with C++** workload selected, then install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 11).

---

### Clone and install

```bash
git clone https://github.com/sanjjayrj/foliofin.git
cd foliofin
npm install
```

---

### Run in development

```bash
npm run tauri dev
```

This starts the Vite dev server and the native Tauri window simultaneously with hot reload.

---

### Build and package

```bash
npm run tauri build
```

This compiles the frontend, builds the Rust backend in release mode, and produces native installers in `src-tauri/target/release/bundle/`:

| Platform | Format | Location |
|----------|--------|----------|
| Linux | `.deb` | `bundle/deb/` |
| Linux | `.rpm` | `bundle/rpm/` |
| Linux | `AppImage` | `bundle/appimage/` |
| macOS | `.dmg` | `bundle/dmg/` |
| macOS | `.app` | `bundle/macos/` |
| Windows | `.msi` | `bundle/msi/` |
| Windows | `.exe` (NSIS) | `bundle/nsis/` |

The first build takes 5–10 minutes while Cargo compiles dependencies. Subsequent builds are much faster.

---

### Install locally

#### Linux — `.deb`

```bash
sudo dpkg -i src-tauri/target/release/bundle/deb/foliofin_*.deb
```

#### Linux — `.rpm`

```bash
sudo rpm -i src-tauri/target/release/bundle/rpm/foliofin-*.rpm
```

#### Linux — AppImage (no install needed)

```bash
chmod +x src-tauri/target/release/bundle/appimage/foliofin_*.AppImage
./src-tauri/target/release/bundle/appimage/foliofin_*.AppImage
```

#### macOS

Open the `.dmg` in `bundle/dmg/`, drag FolioFin into Applications, then launch it from Spotlight or the Applications folder.

If macOS blocks the app ("unidentified developer"), run:

```bash
xattr -dr com.apple.quarantine /Applications/FolioFin.app
```

#### Windows

Run the `.msi` or `.exe` installer from `bundle/msi/` or `bundle/nsis/` and follow the prompts.

---

### Change the app icon

Provide a square PNG at least 1024×1024 and run:

```bash
npm run tauri icon /path/to/icon.png
```

Tauri generates all required sizes automatically, then rebuild with `npm run tauri build`.

---

## Tech stack

- [Tauri v2](https://tauri.app) — native shell
- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vitejs.dev) — frontend bundler
- [Tailwind CSS v4](https://tailwindcss.com)
- [epub.js](https://github.com/futurepress/epub.js) — EPUB rendering
- [PDF.js](https://mozilla.github.io/pdf.js/) — PDF rendering
- [Zustand](https://github.com/pmndrs/zustand) — state management
