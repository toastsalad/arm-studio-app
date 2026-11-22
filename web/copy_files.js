// Run copy_files before extract_i18n.
const fs = require('fs');
const path = require('path');

const copyDirectorySync = (src, dest) => {
    if (!fs.existsSync(src)) {
        return false;
    }
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, {recursive: true});
    }
    const items = fs.readdirSync(src);
    items.forEach(function (item) {
        const itemPath = path.join(src, item);
        const stats = fs.statSync(itemPath);
        if (stats.isFile()) {
            fs.copyFileSync(itemPath, path.join(dest, item));
        } else if (stats.isDirectory()) {
            copyDirectorySync(itemPath, path.join(dest, item));
        }
    });
};

fs.rmSync("./build-web", {recursive: true, force: true});
fs.mkdirSync("./build-web");
fs.copyFileSync("./index.html", "./build-web/index.html");

