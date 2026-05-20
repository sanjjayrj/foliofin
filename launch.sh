#!/bin/bash
# FolioFin launcher — runs the dev build until a packaged binary is available
cd "$(dirname "$0")"
exec npm run tauri dev
