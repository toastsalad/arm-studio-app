# Arm Studio

Desktop app for the DexArm robot arm: laser engraving, 3D printing, pen plotting.
Fork of Rotrics Studio with the branding removed and the "Code" tab dropped.

## Install

Download from the Releases page.

Linux (x64):

```bash
chmod +x ArmStudio-1.0.1-x86_64.AppImage && ./ArmStudio-1.0.1-x86_64.AppImage
```

Needs FUSE (`libfuse2` on Ubuntu 22.04, `libfuse2t64` on 24.04+). Without it, add
`--appimage-extract-and-run`.

Windows (x64): run the `.exe` and pick a folder. Unsigned, so SmartScreen needs "More info"
then "Run anyway".

3D printing downloads CuraEngine from Ultimaker on first use. Laser and plotting never
touch the network.

## License

MIT for this app. See `THIRD-PARTY-NOTICES.md` for the fork parent, fonts, CuraEngine and
bundled packages.
