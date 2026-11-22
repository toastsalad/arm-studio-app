#!/usr/bin/env node
// Smoke test for the local server's Write & Draw toolpath path, especially raster tracing.
//
// A malformed socket.on() registration does not fail at build time: it throws inside the connect
// handler and kills the server with no reply, leaving the app stuck on "Previewing". This starts
// the server the way the app does and fails loudly if nothing answers.
//
//   node scripts/smoke-trace.js                                  # handlers registered?
//   node scripts/smoke-trace.js <image>                          # + full trace/export round trip
//   node scripts/smoke-trace.js <image> <startLocalServer.js>   # against another build
//
// With an image it needs a settings file shaped like the app's trace.json; pass SMOKE_SETTINGS,
// otherwise the repo's own is used.
'use strict';

const {spawn} = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const SERVER = process.argv[3] || path.join(ROOT, 'server', 'build-server', 'startLocalServer.js');
const IMAGE = process.argv[2] || null;
const SETTINGS = process.env.SMOKE_SETTINGS
    || path.join(ROOT, 'web', 'src', 'containers', 'writeAndDraw', 'lib', 'settings', 'trace.json');

const GENERATE = 'TOOL_PATH_GENERATE_WRITE_AND_DRAW';
const EXPORT = 'TOOL_PATH_EXPORT_TRACED_SVG';

const fail = (message) => { console.error('SMOKE FAILED: ' + message); process.exit(1); };

const io = require(path.join(ROOT, 'web', 'node_modules', 'socket.io-client'));

const main = async () => {
    if (!fs.existsSync(SERVER)) fail('server bundle not found: ' + SERVER + ' (run `npm --prefix server run build`)');

    // The non-electron branch listens on a fixed port.
    const server = spawn(process.execPath, [SERVER], {stdio: ['ignore', 'pipe', 'pipe']});
    let log = '';
    server.stdout.on('data', (d) => { log += d; });
    server.stderr.on('data', (d) => { log += d; });
    const cleanup = () => { try { server.kill('SIGKILL'); } catch (e) { /* gone */ } };
    process.on('exit', cleanup);

    await waitForServer(server, () => log, () => fail('server did not come up on :9000\n' + log));

    const socket = io('http://localhost:9000');
    const started = Date.now();
    const at = () => ((Date.now() - started) / 1000).toFixed(2) + 's';

    socket.on('connect', () => {
        console.log(at(), 'connected');

        // The cheapest check that the export handler is registered: it must answer, even to say
        // it has nothing.
        socket.emit(EXPORT, {url: 'http://localhost:9000/cache/definitely-not-here.png'}, (response) => {
            if (!response || typeof response.error !== 'string') {
                fail('export handler did not answer with a result: ' + JSON.stringify(response));
            }
            console.log(at(), 'export handler alive ->', response.error);

            if (!IMAGE) {
                console.log('SMOKE OK (handlers registered). Pass an image path for a full round trip.');
                process.exit(0);
            }
            trace();
        });
    });

    socket.on('connect_error', (e) => fail('could not connect: ' + e.message));

    const trace = () => {
        const image = path.resolve(IMAGE);
        if (!fs.existsSync(image)) fail('image not found: ' + image);
        // Serve it the way the app does: from the server's own cache directory.
        const cacheDir = path.join(ROOT, 'server', 'static', 'cache');
        fs.mkdirSync(cacheDir, {recursive: true});
        const served = path.join(cacheDir, 'smoke-' + path.basename(image));
        fs.copyFileSync(image, served);
        const url = 'http://localhost:9000/cache/' + path.basename(served);

        const settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
        const transformation = settings.transformation.children;
        transformation.img_width.default_value = 400;
        transformation.img_height.default_value = 260;
        transformation.width.default_value = 120;
        transformation.height.default_value = 78;

        console.log(at(), 'requesting a preview of', path.basename(image));
        socket.emit(GENERATE, {url, settings, toolPathId: 'smoke', fileType: 'trace'}, () => {});

        socket.on(GENERATE, (data) => {
            if (data.error) fail('preview failed: ' + data.error);
            console.log(at(), 'preview ->', data.toolPathLines.length, 'toolpath lines');

            socket.emit(EXPORT, {url}, (response) => {
                if (response.error) fail('export failed: ' + response.error);
                const svg = response.svg || '';
                if (!svg.startsWith('<svg')) fail('export is not an SVG: ' + JSON.stringify(svg.slice(0, 40)));
                const paths = (svg.match(/<path/g) || []).length;
                console.log(at(), 'export ->', svg.length, 'bytes,', paths, 'paths');
                if (paths === 0) fail('exported SVG contains no geometry');
                console.log('SMOKE OK (full trace + export round trip).');
                process.exit(0);
            });
        });
    };

    setTimeout(() => fail('timed out with no reply -- the server is probably dead. Log:\n' + log), 120000);
};

// Poll the port rather than trusting stdout ordering.
const waitForServer = (server, log, onFail) => new Promise((resolve) => {
    const deadline = Date.now() + 15000;
    const probe = () => {
        if (server.exitCode !== null) return onFail();
        const request = http.get('http://localhost:9000/fonts/', () => { resolve(); });
        request.on('error', () => {
            if (Date.now() > deadline) return onFail();
            setTimeout(probe, 200);
        });
    };
    probe();
});

main();
