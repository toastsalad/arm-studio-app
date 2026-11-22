/* global window */
// isElectron() probes `window`, which exists when this runs as an Electron
// preload script and does not when it runs under plain node.
import path from 'path' ;
import fs from 'fs';
import http from 'http';
import sizeOf from 'image-size';

// https://github.com/image-size/image-size#readme
const getImageSize = (imagePath) => {
    // image-size v2 takes a Buffer, not a path.
    const dimensions = sizeOf(fs.readFileSync(imagePath));
    return {
        width: dimensions.width,
        height: dimensions.height
    }
};

const fetchBuffer = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
            res.resume();
            reject(new Error(`Cannot load ${url} (HTTP ${res.statusCode})`));
            return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
});

const isElectron = () => {
    if (typeof window !== 'undefined' && window.process && window.process.type) return true;
    return typeof process !== 'undefined' && process.versions != null && process.versions.electron != null;
};

const getUniqueFilename = (filename) => {
    return Date.now() + path.extname(filename);
};

const degree2radian = (degree) => {
    return degree * Math.PI / 180
};

export {getImageSize, fetchBuffer, isElectron, getUniqueFilename, degree2radian};
