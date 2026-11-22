// Report what the assembled app directory actually contains.
//
// The point is to answer "is the feature I just wrote in the build I am about to launch?" without opening
// the app. It reads electron/build-web, which is what Electron loads, not the source or web/build-web.
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ?? process.cwd();
const bundle = path.join(root, 'electron/build-web/bundle.js');
const server = path.join(root, 'electron/build-server/startLocalServer.js');
const engine = path.join(root, 'electron/PlotterHelper/PlotterHelper.exe');

const stamp = (file) => {
    if (!fs.existsSync(file)) return 'missing';
    const s = fs.statSync(file);
    return `${s.mtime.toISOString()}  ${Math.round(s.size / 1024)} KB`;
};

if (!fs.existsSync(bundle)) {
    console.error('!! electron/build-web/bundle.js is missing: Electron would open a blank window.');
    process.exit(1);
}

const text = fs.readFileSync(bundle, 'utf8');
const patternStyles = /fill_style[\s\S]{0,8000}?"hilbert"/.test(text);
// 'Image shading' is the group label only image.json carries now, so it doubles as the marker for the tab.
const imageTab = text.includes('Image shading');

console.log(`   web bundle     ${stamp(bundle)}`);
console.log(`   server bundle  ${stamp(server)}`);
console.log(`   engine         ${stamp(engine)}`);
console.log(`   pattern fills in bundle:    ${patternStyles ? 'yes' : 'NO (stale build)'}`);
console.log(`   image tab in bundle:        ${imageTab ? 'yes' : 'NO (stale build)'}`);

// A packaged build is a snapshot: it keeps whatever it was built with, and launching it looks exactly like
// a dev build that ignored the latest change. Say so when one is lying around.
const packaged = path.join(root, 'electron/output/win-unpacked/resources/app/build-web/bundle.js');
if (fs.existsSync(packaged)) {
    const packagedTime = fs.statSync(packaged).mtimeMs;
    const devTime = fs.statSync(bundle).mtimeMs;
    if (packagedTime < devTime) {
        const days = Math.round((devTime - packagedTime) / 86400000);
        console.log(`   note: electron/output/win-unpacked holds an older build (${days} day(s) behind).`);
        console.log('         Launching that exe shows the old UI. Rebuild it with:');
        console.log('           npm --prefix electron run build:win-x64');
    }
}
