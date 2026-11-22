import {spawn} from 'child_process';
import path from 'path';
import {log} from '../../../shared/log.mjs';

// Spawn the raster worker as a real Node process (the Electron binary in
// ELECTRON_RUN_AS_NODE mode) and resolve with its stdout.
const runWorker = (job) => new Promise((resolve, reject) => {
    const worker = path.join(__dirname, 'rasterWorker.js');
    const child = spawn(process.execPath, [worker], {
        env: {...process.env, ELECTRON_RUN_AS_NODE: '1'},
    });
    let out = '', errOut = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { errOut += d; });
    child.on('error', reject);
    child.on('close', (code) => {
        if (code !== 0) {
            log.error('raster worker failed:', errOut);
            reject(new Error('raster worker exited with code ' + code));
            return;
        }
        resolve(out);
    });
    child.stdin.write(JSON.stringify(job));
    child.stdin.end();
});

export const runRasterWorker = (mode, url, settings) => runWorker({mode, url, settings});

/** Decode any supported raster and write it out as a PNG, for the tracer. */
export const runRasterToPng = (url, out) => runWorker({mode: 'png', url, out});

/**
 * Turn an already-decoded PNG into the tone image for a shading fill, and report its pixel size.
 *
 * A separate mode because it runs in the worker: jimp v1's plugins are dynamic imports, which only resolve in
 * the Electron binary running as node.
 */
export const runRasterToTonePng = (source, out, rotation, flip) =>
    runWorker({mode: 'tone', source, out, rotation, flip});

export default runRasterWorker;
