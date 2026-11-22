import fs from 'fs';
import {Jimp} from 'jimp';
import {fetchBuffer} from '../utils/index.js';

// PlotterHelper only decodes PNG, so Jimp (already in this worker for the laser modes)
// transcodes the source raster to PNG on the way to the tracer.
const rasterToPng = async (url, out) => {
    const img = await Jimp.read(await fetchBuffer(url));
    fs.writeFileSync(out, await img.getBuffer('image/png'));
    // The worker's stdout carries a toolpath string; this mode writes a file instead.
    return '';
};

/**
 * Transcode a raster into the tone image for a shading fill, turned the way the drawing is turned.
 *
 * The engine maps a tone image onto the element's axis-aligned bounding box, so the picture cannot be rotated
 * by rotating the region: a rotated rectangle's box would sample the picture unrotated across a larger area.
 * The rotation has to happen to the pixels instead.
 *
 * `rotate` turns the picture counter-clockwise, which is the direction the canvas turns a positive
 * transformation.rotation, and it grows the canvas to hold the result. Those new corners are transparent, and
 * the engine composites alpha over white before reading luminance, so they read as bare paper rather than as
 * ink.
 *
 * Flip is applied first, matching the order the SVG path applies its transforms: the picture is flipped, then
 * turned.
 *
 * `source` is a path to the PNG the tracer already decoded, not a url: the bytes behind an upload never change,
 * so decoding it a second time for every rotation would be work for nothing.
 */
export const rasterToTonePng = async (source, out, rotationDegrees = 0, flip = 'None') => {
    const img = await Jimp.read(fs.readFileSync(source));

    if (flip === 'Horizontal' || flip === 'Both') img.flip({horizontal: true});
    if (flip === 'Vertical' || flip === 'Both') img.flip({vertical: true});
    if (rotationDegrees) img.rotate(rotationDegrees);

    fs.writeFileSync(out, await img.getBuffer('image/png'));
    // Sizes are reported back so the caller can describe what it got without decoding the file again.
    return JSON.stringify({width: img.width, height: img.height});
};

export default rasterToPng;
