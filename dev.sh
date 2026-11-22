#!/usr/bin/env bash
# Run Arm Studio from the working tree with live rebuilds.
#
# Builds once, then watches web + server and launches the app. Save a source
# file and relaunch the app to see the rebuild (the watchers keep running).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

for d in web server electron; do
    if [ ! -d "$d/node_modules" ]; then
        echo ">> Installing $d dependencies"
        ( cd "$d" && npm install --no-audit --no-fund )
    fi
done

# The staged binary is named PlotterHelper.exe on Windows and PlotterHelper elsewhere; checking only
# the extensionless name meant Windows re-built (and re-staged the wrong platform's binary) on every run.
ENGINE="$ROOT/electron/PlotterHelper/PlotterHelper"
if [ -f "$ENGINE.exe" ]; then ENGINE="$ENGINE.exe"; fi
if [ ! -x "$ENGINE" ]; then
    echo ">> Building PlotterHelper engine"
    scripts/build-plotter-helper.sh || echo ">> Continuing without PlotterHelper (built-in converter will be used)"
fi

# Point the app's entry at the live build outputs. Node resolves these symlinks
# to their real paths (web/ and server/), so the server finds its static fonts,
# CuraEngine config and node_modules without extra copies.
rm -rf electron/build-web electron/build-server
ln -sfn "$ROOT/web/build-web" electron/build-web
ln -sfn "$ROOT/server/build-server" electron/build-server

echo ">> Initial build"
# The repo's `web` package only runs webpack; on this machine the i18n assets and
# build-web/index.html come from the machine-local wrapper (see local/README.md).
if [ -x "$ROOT/local/web-build/build.sh" ]; then
    NODE_PATH="$ROOT/web/node_modules" "$ROOT/local/web-build/build.sh"
else
    npm --prefix web run build
    [ -f web/build-web/index.html ] || cp web/index.html web/build-web/index.html
fi
npm --prefix server run build

# Say what was assembled, so "is my change actually in the app I am about to launch?" is answerable. The
# packaged build under electron/output is a snapshot and launching it looks identical to a dev build that
# ignored the change, so this also points that out.
echo ">> Assembled"
node "$ROOT/scripts/dev-build-info.mjs" "$ROOT" || true

# Watch the raw webpack outputs (not `npm run watch`): the web bundle's
# copy_files step deletes build-web, which would blank a running app.
echo ">> Starting watchers (Ctrl+C to stop)"
( cd web && npx webpack --watch --mode=development ) &
WEB_PID=$!
( cd server && npx webpack --watch --mode=development ) &
SERVER_PID=$!

cleanup() {
    kill "$WEB_PID" "$SERVER_PID" 2>/dev/null || true
    wait 2>/dev/null || true
}
trap cleanup EXIT

echo ">> Launching Arm Studio"
"$ROOT/electron/node_modules/.bin/electron" "$ROOT/electron" --no-sandbox
