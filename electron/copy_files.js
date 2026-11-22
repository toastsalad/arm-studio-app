// Assemble the Electron app directory from the web / server build outputs.
// Run before `electron .` (dev) or `electron-builder` (packaging).
const fs = require('fs');
const path = require('path');

const copyDirectorySync = (src, dest) => {
    if (!fs.existsSync(src)) {
        return false;
    }
    fs.mkdirSync(dest, {recursive: true});
    for (const item of fs.readdirSync(src)) {
        const from = path.join(src, item);
        const to = path.join(dest, item);
        if (fs.statSync(from).isFile()) {
            fs.copyFileSync(from, to);
        } else {
            copyDirectorySync(from, to);
        }
    }
    return true;
};

// rmSync (not rmdirSync) so a leftover dev symlink is unlinked, not followed.
const clean = (p) => fs.rmSync(p, {recursive: true, force: true});

clean('./build-web');
clean('./build-server');
clean('./static');
clean('./CuraEngine');

copyDirectorySync('../web/build-web', './build-web');
copyDirectorySync('../server/build-server', './build-server');
copyDirectorySync('../server/static/fonts', './static/fonts');
// CuraEngine is AGPL-3.0 and is not shipped: the app downloads it into the user data dir on
// first use (/CuraEngine/config below is only the settings presets, not the engine).
copyDirectorySync('../server/CuraEngine/config', './CuraEngine/config');
