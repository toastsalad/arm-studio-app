import {rasterBw} from './toolPathStr4bw.js';
import rasterGreyscale from './toolPathStr4greyscale.js';
import rasterToPng, {rasterToTonePng} from './rasterToPng.js';
import {log} from '../../../shared/log.mjs';

// Runs in a child process (the Electron binary in ELECTRON_RUN_AS_NODE mode) so jimp v1's
// dynamic ESM imports work; reads a JSON job on stdin and writes the result to stdout.
const main = async () => {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const job = JSON.parse(Buffer.concat(chunks).toString('utf8'));

    let output;
    switch (job.mode) {
        case 'bw':
            output = await rasterBw(job.url, job.settings);
            break;
        case 'greyscale':
            output = await rasterGreyscale(job.url, job.settings);
            break;
        case 'png':
            output = await rasterToPng(job.url, job.out);
            break;
        case 'tone':
            output = await rasterToTonePng(job.source, job.out, job.rotation, job.flip);
            break;
        default:
            throw new Error('unknown raster worker mode: ' + job.mode);
    }
    process.stdout.write(output);
};

main().catch((e) => {
    log.error('rasterWorker failed:', e && e.stack || e);
    process.exit(1);
});
