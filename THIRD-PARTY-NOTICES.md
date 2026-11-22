# Third-party notices

Arm Studio itself is MIT (see `LICENSE`). It ships, or downloads, the components below.

## Fork parent

**Rotrics Studio** — MIT, Copyright (c) 2019 liumingzw.
Arm Studio is a fork of https://github.com/liumingzw/rotrics-studio; its MIT text is reproduced in
`LICENSE`.

## Fonts

The app once shipped Microsoft and IPA font files. Those were removed and replaced with the
redistributable faces below. The full license text for each is in
`server/static/fonts/LICENSES/`.

| UI label | File | Face | License | Upstream |
| --- | --- | --- | --- | --- |
| `Liberation Sans` | `Liberation Sans.ttf` | Liberation Sans | SIL OFL 1.1 | https://github.com/liberationfonts/liberation-fonts |
| `Liberation Serif` | `Liberation Serif.ttf` | Liberation Serif | SIL OFL 1.1 | https://github.com/liberationfonts/liberation-fonts |
| `Liberation Mono` | `Liberation Mono.ttf` | Liberation Mono | SIL OFL 1.1 | https://github.com/liberationfonts/liberation-fonts |
| `DejaVu Sans` | `DejaVu Sans.ttf` | DejaVu Sans (also covers IPA) | Bitstream Vera / public domain | https://dejavu-fonts.github.io/ |
| `Gelasio` | `Gelasio.ttf` | Gelasio | SIL OFL 1.1 | https://github.com/SorkinType/Gelasio |
| `Comic Neue` | `Comic Neue.ttf` | Comic Neue | SIL OFL 1.1 | https://github.com/crozynski/comicneue |
| `Anton` | `Anton.ttf` | Anton | SIL OFL 1.1 | https://github.com/googlefonts/AntonFont |
| `Noto Sans JP` | `Noto Sans JP.ttf` | Noto Sans JP (Japanese; was IPAGothic) | SIL OFL 1.1 | https://github.com/notofonts/noto-cjk |

The `Line *` SVG fonts bundled beside them are original single-stroke outline sets created for
this app (MIT, same terms as the app).

## CuraEngine (not shipped; downloaded by the user)

**CuraEngine 5.13.0** — AGPL-3.0-or-later, Copyright (C) 2024 Ultimaker B.V.
Upstream: https://github.com/Ultimaker/CuraEngine — release page:
https://github.com/Ultimaker/Cura/releases/tag/5.13.0

The engine is **not** in this repository or in the installers. On first use of 3D printing the app
offers to download Ultimaker's official Cura 5.13.0 release, verifies its SHA-256 and unpacks the
slicer engine into the user data folder (`<userData>/CuraEngine/5.13.0/`). CuraEngine is used as a
separate program invoked over its command line; if you redistribute this app together with that
binary, AGPL-3.0 obligations attach and you must offer the engine's corresponding source.

The `.def.json` presets under `server/CuraEngine/config/` are Arm Studio's own settings data, not
AGPL code; they only describe print parameters.

## PlotterHelper

**PlotterHelper** — GPL-2.0-or-later. Built from
https://github.com/toastsalad/Drawing-Extension (`src/PlotterHelper.Cli`). It ships in the Windows
installer and is staged by `scripts/build-plotter-helper.sh`. It runs as a separate executable; the
app falls back to its built-in SVG converter when it is absent.

## Bundled runtime libraries

The installers carry these npm packages (all permissive; versions as locked in
`server/package-lock.json`). They are unmodified and their license files travel in `node_modules`.

| Package | License | Upstream |
| --- | --- | --- |
| `@hapi/bourne` | BSD-3-Clause | https://github.com/hapijs/bourne |
| `ieee754` | BSD-3-Clause | https://github.com/feross/ieee754 |
| `jpeg-js` | BSD-3-Clause | https://github.com/eugeneware/jpeg-js |
| `qs` | BSD-3-Clause | https://github.com/ljharb/qs |
| `dezalgo`, `inherits`, `once`, `pixelmatch`, `setprototypeof`, `wrappy` | ISC | https://www.npmjs.com/ |
| `sax` | BlueOak-1.0.0 | https://github.com/isaacs/sax-js |
| `pako` | MIT AND Zlib | https://github.com/nodeca/pako |
| `type-fest` | MIT OR CC0-1.0 | https://github.com/sindresorhus/type-fest |
| `three-math` | MIT | https://github.com/mrdoob/three.js |
| `exif-parser` | MIT (LICENSE.md in its package) | https://github.com/bwindels/exif-parser |
| other runtime packages | MIT | see each package's `LICENSE` |

Electron itself (MIT) and the Node.js runtime are part of the packaged app under their own
licenses, included in the installers' `LICENSE.electron.txt` and `LICENSES.chromium.html`.
