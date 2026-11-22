import {Jimp} from 'jimp';
import {fetchBuffer} from '../utils/index.js';
import getFlipFlag from './getFlipFlag.js';
import {settingsNumber, settingsString} from '../settings.js';

// The one place a toolpath source image is turned into pixels. The two raster converters
// (bw and greyscale) differ in how they tone the image, but not in how they fetch, decode,
// size, flip or rotate it, so that part lives here and answers the "bad URL / not an image /
// huge image" questions once instead of twice.
//
// The other raster path is different on purpose: plotterHelperBridge/rasterToPng writes a
// PNG to disk for the native PlotterHelper engine to trace. That is an offload to a trace
// engine, not a decode, so it does not belong here — please don't "finish the job".

/** Fetch and decode a source image. Throws whatever Jimp throws for a non-image body. */
export const loadSource = async (url) => Jimp.read(await fetchBuffer(url));

/** The transformation settings that decide how the decoded image is fitted. */
export const readGeometry = (settings) => {
    return {
        width: settingsNumber(settings, 'transformation.width', 200),
        height: settingsNumber(settings, 'transformation.height', 200),
        rotation: settingsNumber(settings, 'transformation.rotation', 0), // degrees, counter-clockwise
        flipFlag: getFlipFlag(settingsString(settings, 'transformation.flip_model', 'None')),
        density: settingsNumber(settings, 'config.density', 4)
    };
};

/** Apply the flip, resize and rotate agreed by both converters, in that order. */
export const fitImage = (img, geometry) => {
    const {width, height, rotation, flipFlag, density} = geometry;
    return img
        .flip({horizontal: !!(Math.floor(flipFlag / 2)), vertical: !!(flipFlag % 2)})
        .resize({w: Math.round(width * density), h: Math.round(height * density)})
        .rotate(rotation); // degrees, clockwise
};
