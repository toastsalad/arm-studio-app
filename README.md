# Arm Studio

Offline desktop app for the DexArm robot arm: laser engraving, 3D printing and pen plotting over
USB serial or a network bridge. A fork of Rotrics Studio: Rotrics branding removed, "Code" tab dropped.

## Install

Download both files from this repository's Releases page.

Linux (x64):

```bash
chmod +x ArmStudio-1.0.1-x86_64.AppImage && ./ArmStudio-1.0.1-x86_64.AppImage
```

The AppImage needs FUSE (`libfuse2` on Ubuntu 22.04, `libfuse2t64` on 24.04+); without
FUSE, add `--appimage-extract-and-run`.

Windows (x64): run `ArmStudio-1.0.1-x64.exe`, choose an install directory. The installer is
unsigned, so SmartScreen needs "More info" then "Run anyway".

3D printing needs CuraEngine, which is not bundled: the 3D Print panel offers a one-time download
from Ultimaker's release page (laser engraving and pen plotting never use the network).

## Build from source

```bash
cd web     && npm ci --legacy-peer-deps && npm run build
cd ../server  && npm ci --legacy-peer-deps --ignore-scripts && npx webpack --mode=production
cd ../electron && npm install && node copy_files.js linux && npx electron-builder --linux AppImage
```

`--legacy-peer-deps` is required by the web package. The AppImage lands in `electron/output/`;
for Windows run `node copy_files.js windows` then `npx electron-builder --windows --x64`.
The Write & Draw engine is published by `scripts/build-plotter-helper.sh`; without it the app falls back to its built-in SVG converter.

## License

MIT for this app; see `THIRD-PARTY-NOTICES.md`. Fork of Rotrics Studio (MIT, (c) 2019 liumingzw).
