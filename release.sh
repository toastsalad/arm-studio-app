#!/usr/bin/env bash
# Build, package, and install the newest Arm Studio AppImage.
#
# Installs to ~/Applications/ArmStudio, refreshes the ~/bin/arm-studio launcher
# and the desktop entry, so the app always launches the build you just made.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

APP_DIR="${ARM_STUDIO_APPDIR:-$HOME/Applications/ArmStudio}"
BIN="$HOME/bin/arm-studio"
DESKTOP="$HOME/.local/share/applications/ArmStudio.desktop"
ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

for d in web server electron; do
    if [ ! -d "$d/node_modules" ]; then
        say "Installing $d dependencies"
        ( cd "$d" && npm install --no-audit --no-fund )
    fi
done

# Replace any dev symlinks (or stale copies) with real directories before packaging.
rm -rf electron/build-web electron/build-server

say "Building PlotterHelper engine"
scripts/build-plotter-helper.sh \
    || echo "  Continuing without PlotterHelper; the built-in converter will be used."

say "Building web bundle"
# The repo's `web` package only runs webpack; on this machine the i18n assets and
# build-web/index.html come from the machine-local wrapper (see local/README.md).
if [ -x "$ROOT/local/web-build/build.sh" ]; then
    NODE_PATH="$ROOT/web/node_modules" "$ROOT/local/web-build/build.sh"
else
    npm --prefix web run build
    [ -f web/build-web/index.html ] || cp web/index.html web/build-web/index.html
fi

say "Building server bundle"
npm --prefix server run build

say "Packaging AppImage"
npm --prefix electron run dist

APPIMAGE="$(ls -t "$ROOT"/electron/output/*.AppImage 2>/dev/null | head -1)"
if [ -z "$APPIMAGE" ]; then
    echo "Packaging produced no AppImage." >&2
    exit 1
fi

say "Installing $(basename "$APPIMAGE")"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
( cd "$STAGE" && "$APPIMAGE" --appimage-extract >/dev/null )
rm -rf "$APP_DIR"
mkdir -p "$(dirname "$APP_DIR")"
mv "$STAGE/squashfs-root" "$APP_DIR"

say "Installing launcher and desktop entry"
mkdir -p "$HOME/bin" "$(dirname "$DESKTOP")" "$ICON_DIR"

cat > "$BIN" <<WRAPPER
#!/bin/bash
# Arm Studio launcher: runs the pre-extracted AppImage (no FUSE, fast start).
APP_DIR="$APP_DIR"
APP_BIN="\$APP_DIR/arm-studio"
if pgrep -f "\$APP_BIN" >/dev/null 2>&1; then
    command -v xdotool >/dev/null 2>&1 && xdotool search --class "Arm Studio" windowactivate 2>/dev/null
    exit 0
fi
exec "\$APP_BIN" --no-sandbox "\$@"
WRAPPER
chmod +x "$BIN"

cp "$ROOT/electron/electron-builder/icon.png" "$ICON_DIR/arm-studio.png"
# Drop any previously installed icon size (the old artwork was 256x256).
rm -f "$HOME/.local/share/icons/hicolor/256x256/apps/arm-studio.png"

cat > "$DESKTOP" <<DESKTOP
[Desktop Entry]
Type=Application
Version=1.0
Name=Arm Studio
GenericName=Robot Arm Studio
Comment=Control the DexArm robot arm: laser, 3D print, write & draw
Exec=$BIN %u
Icon=arm-studio
Terminal=false
Categories=Graphics;
StartupWMClass=Arm Studio
DESKTOP

desktop-file-validate "$DESKTOP" || true
update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true
gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" >/dev/null 2>&1 || true

# Keep only the newest AppImage on disk.
ls -t "$ROOT"/electron/output/*.AppImage 2>/dev/null | tail -n +2 | xargs -r rm -f

say "Installed. Launch with: arm-studio"
printf '  build: %s\n' "$(basename "$APPIMAGE")"
printf '  commit: %s\n' "$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
printf '  time:   %s\n' "$(date '+%Y-%m-%d %H:%M:%S')"
