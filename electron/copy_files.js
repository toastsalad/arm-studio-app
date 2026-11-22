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
copyDirectorySync('../server/CuraEngine/config', './CuraEngine/config');

const platform = process.argv[2] || 'linux';
if (platform === 'linux') {
    const curaDir = '../server/CuraEngine/5.13.0/Linux-x64';
    if (copyDirectorySync(curaDir, './CuraEngine/5.13.0/Linux-x64')) {
        fs.chmodSync('./CuraEngine/5.13.0/Linux-x64/CuraEngine', 0o755);
    } else {
        console.warn('CuraEngine Linux-x64 binary is missing from the repo.');
        console.warn('The 3D print module will not be able to slice.');
    }
} else if (platform === 'windows') {
    const curaDir = '../server/CuraEngine/5.13.0/Win-x64';
    if (!copyDirectorySync(curaDir, './CuraEngine/5.13.0/Win-x64')) {
        console.warn('CuraEngine Win-x64 binary is missing from the repo.');
        console.warn('The 3D print module will not be able to slice.');
    }
}
