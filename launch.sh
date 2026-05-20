#!/bin/bash
# FolioFin — NVM-aware launcher
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
cd "$(dirname "$(realpath "$0")")"
exec npm run tauri dev
