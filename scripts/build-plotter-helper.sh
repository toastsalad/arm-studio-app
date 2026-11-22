#!/usr/bin/env bash
# Publish the PlotterHelper SVG -> G-code engine and stage it for the Electron app.
#
# PlotterHelper lives in its own repo (default: ../Drawing-Extension). Override
# the source with PLOTTER_HELPER_SRC. The app falls back to its built-in SVG
# converter if the engine is missing, so this is optional but recommended.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${PLOTTER_HELPER_SRC:-$ROOT/../Drawing-Extension}"
OUT="$ROOT/electron/PlotterHelper"
# Publish for the machine that will run it. This defaulted to linux-x64 everywhere, so on Windows it
# staged a Linux binary -- under the name the Windows probe does not look for. The app then fell back
# to its built-in converter, which honours neither the fill style nor travel optimisation, so every
# style drew the same picture and "optimise" did nothing, with no error anywhere.
host_rid() {
    case "$(uname -s)" in
        Linux*)  echo linux-x64 ;;
        Darwin*)
            if [ "$(uname -m)" = "arm64" ]; then echo osx-arm64; else echo osx-x64; fi ;;
        MINGW*|MSYS*|CYGWIN*) echo win-x64 ;;
        *) echo linux-x64 ;;
    esac
}
RID="${PLOTTER_HELPER_RID:-$(host_rid)}"
SELF_CONTAINED="${PLOTTER_HELPER_SELF_CONTAINED:-true}"

PROJECT="$SRC/src/PlotterHelper.Cli/PlotterHelper.Cli.csproj"
if [ ! -f "$PROJECT" ]; then
    echo "PlotterHelper source not found at $SRC" >&2
    echo "Set PLOTTER_HELPER_SRC to a Drawing-Extension checkout." >&2
    exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

SC_FLAG=""
if [ "$SELF_CONTAINED" = "true" ]; then
    SC_FLAG="--self-contained true"
fi

dotnet publish "$PROJECT" -c Release -r "$RID" -o "$TMP" \
    $SC_FLAG -p:InkscapeAutoInstall=false

BIN_NAME="PlotterHelper"
if [ "$RID" = "win-x64" ]; then
    BIN_NAME="PlotterHelper.exe"
fi

mkdir -p "$OUT"
rm -f "$OUT/PlotterHelper" "$OUT/PlotterHelper.exe"
cp "$TMP/$BIN_NAME" "$OUT/$BIN_NAME"
chmod +x "$OUT/$BIN_NAME"
echo "Staged $OUT/$BIN_NAME"
