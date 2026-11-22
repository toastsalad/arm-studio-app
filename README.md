# Arm Studio

Offline desktop app for the DexArm robot arm: laser engraving, 3D printing and
pen plotting over USB serial or a network bridge. A fork of Rotrics Studio with
the Rotrics branding removed and the block-coding "Code" tab dropped.

## Install

Download both files from the Releases page of this repository.

Linux (x64):

```bash
chmod +x ArmStudio-1.0.1-x86_64.AppImage
./ArmStudio-1.0.1-x86_64.AppImage
```

The AppImage needs FUSE: `libfuse2` on Ubuntu 22.04 and older, `libfuse2t64` on
Ubuntu 24.04 and later. Without FUSE, add `--appimage-extract-and-run`.

Windows (x64): run `ArmStudio-1.0.1-x64.exe` and choose an install directory.
The installer is unsigned, so SmartScreen needs "More info" then "Run anyway".

## Build from source

```bash
cd web     && npm ci --legacy-peer-deps && npm run build
cd ../server  && npm ci --legacy-peer-deps --ignore-scripts && npx webpack --mode=production
cd ../electron && npm install && node copy_files.js linux && npx electron-builder --linux AppImage
```

`--legacy-peer-deps` is required by the web package. The AppImage lands in
`electron/output/`. For Windows run `node copy_files.js windows` and then
`npx electron-builder --windows --x64`. The Write & Draw engine is published by
`scripts/build-plotter-helper.sh`; without it the app falls back to its built-in
SVG converter.

## License

MIT. Fork of Rotrics Studio (MIT, (c) 2019 liumingzw); see `LICENSE`.
