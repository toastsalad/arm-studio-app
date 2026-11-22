import Normalizer from './Normalizer.js';
import {img2toolPathStrBw} from './toolPathStr4bw.js';
import {loadSource, readGeometry, fitImage} from './loadImage.js';
import {settingsBool, settingsNumber, settingsString, settingsPlaceholder} from '../settings.js';

const algorithms = {
    Atkinson: [
        [0, 0, 1 / 8, 1 / 8],
        [1 / 8, 1 / 8, 1 / 8, 0],
        [0, 1 / 8, 0, 0]
    ],
    Burkes: [
        [0, 0, 0, 8 / 32, 4 / 32],
        [2 / 32, 4 / 32, 8 / 32, 4 / 32, 2 / 32]
    ],
    FloydSteinburg: [
        [0, 0, 7 / 16],
        [3 / 16, 5 / 16, 1 / 16]
    ],
    JarvisJudiceNinke: [
        [0, 0, 0, 7 / 48, 5 / 48],
        [3 / 48, 5 / 48, 7 / 48, 5 / 48, 3 / 48],
        [1 / 48, 3 / 48, 5 / 48, 3 / 48, 1 / 48]
    ],
    Sierra2: [
        [0, 0, 0, 4 / 16, 3 / 16],
        [1 / 16, 2 / 16, 3 / 16, 2 / 16, 1 / 16]
    ],
    Sierra3: [
        [0, 0, 0, 5 / 32, 3 / 32],
        [2 / 32, 4 / 32, 5 / 32, 4 / 32, 2 / 32],
        [0, 2 / 32, 3 / 32, 2 / 32, 0]
    ],
    SierraLite: [
        [0, 0, 2 / 4],
        [1 / 4, 1 / 4, 0]
    ],
    Stucki: [
        [0, 0, 0, 8 / 42, 4 / 42],
        [2 / 42, 4 / 42, 8 / 42, 4 / 42, 2 / 42],
        [1 / 42, 2 / 42, 4 / 42, 2 / 42, 1 / 42]
    ]
};

const toBit = function (x) {
    if (x >= 128) {
        return 255;
    } else {
        return 0;
    }
};

const normalize = function (x) {
    if (x < 0) {
        return 0;
    } else if (x > 255) {
        return 255;
    }
    return Math.round(x);
};

// Settings: {transformation, config}; config: {invert, contrast, brightness, white_clip, algorithm, density}
const file2img = async (url, settings) => {
    const invert = settingsBool(settings, 'config.invert', false);
    const contrast = settingsNumber(settings, 'config.contrast', 50);
    const brightness = settingsNumber(settings, 'config.brightness', 50);
    const whiteClip = settingsNumber(settings, 'config.white_clip', 100);
    const algorithm = settingsString(settings, 'config.algorithm', 'JarvisJudiceNinke');

    const matrix = algorithms[algorithm];
    const matrixHeight = matrix.length;
    const matrixWidth = matrix[0].length;

    let startingOffset = 0;
    for (let offset = 1; offset < matrixWidth; offset++) {
        if (matrix[0][offset] > 0) {
            startingOffset = offset - 1;
            break;
        }
    }

    const img = await loadSource(url);

    img.background = 0xffffffff;
    img
        .brightness((brightness - 50.0) / 50)
        .contrast((contrast - 50.0) / 50)
        .greyscale();
    fitImage(img, readGeometry(settings));

    img.scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
        const data = img.bitmap.data;

        if (data[idx + 3] === 0) {
            data[idx] = 255;
        } else {
            if (invert) {
                data[idx] = 255 - data[idx];
                if (data[idx] < 255 - whiteClip) {
                    data[idx] = 0;
                }
            } else {
                if (data[idx] >= whiteClip) {
                    data[idx] = 255;
                }
            }
        }
    });

    // Diffuse the quantisation error along a serpentine path.
    for (let y = 0; y < img.bitmap.height; y++) {
        const reverse = (y & 1) === 1;

        for (let x = reverse ? img.bitmap.width - 1 : 0; reverse ? x >= 0 : x < img.bitmap.width; reverse ? x-- : x++) {
            const index = (y * img.bitmap.width + x) << 2;
            const origin = img.bitmap.data[index];

            img.bitmap.data[index] = toBit(origin);
            const err = origin - img.bitmap.data[index];

            for (let i = 0; i < matrixWidth; i++) {
                for (let j = 0; j < matrixHeight; j++) {
                    if (matrix[j][i] > 0) {
                        const neighborX = reverse ? x - (i - startingOffset) : x + (i - startingOffset);
                        const neighborY = y + j;
                        if (neighborX >= 0 && neighborX < img.bitmap.width && neighborY < img.bitmap.height) {
                            const neighborIndex = index + (neighborX - x) * 4 + (neighborY - y) * img.bitmap.width * 4;
                            img.bitmap.data[neighborIndex] = normalize(img.bitmap.data[neighborIndex] + matrix[j][i] * err);
                        }
                    }
                }
            }
        }
    }

    return img;
};

const img2toolPathStrGs = (img, settings) => {
    const bw = settingsNumber(settings, 'config.bw', 168);
    const density = settingsNumber(settings, 'config.density', 4);

    const work_speed_placeholder = settingsPlaceholder(settings, 'working_parameters.work_speed', '');
    const dwell_time_placeholder = settingsPlaceholder(settings, 'working_parameters.dwell_time', '');
    const engrave_time_placeholder = settingsPlaceholder(settings, 'working_parameters.engrave_time', '');
    const power_placeholder = settingsPlaceholder(settings, 'working_parameters.power', '');

    img.flip({horizontal: false, vertical: true});

    const width = img.bitmap.width;
    const height = img.bitmap.height;

    const normalizer = new Normalizer('Center', 0, width, 0, height, {
        x: 1 / density,
        y: 1 / density
    });

    let toolPathLines = [];
    toolPathLines.push('G0 F1000'); // G0 default speed
    toolPathLines.push(`G1 F${work_speed_placeholder}`);
    for (let i = 0; i < width; ++i) {
        const isReverse = (i % 2 === 0);
        for (let j = (isReverse ? height : 0); isReverse ? j >= 0 : j < height; isReverse ? j-- : j++) {
            const idx = j * width * 4 + i * 4;
            if (img.bitmap.data[idx] < bw) {
                toolPathLines.push(`G1 X${normalizer.x(i)} Y${normalizer.y(j)}`);
                toolPathLines.push(`G4 P${dwell_time_placeholder}`);
                toolPathLines.push(`M3 S${power_placeholder}`);
                toolPathLines.push(`G4 P${engrave_time_placeholder}`);
                toolPathLines.push('M5');
            }
        }
    }
    toolPathLines.push('G0 X0 Y0');
    return toolPathLines.join('\n');
};

const rasterGreyscale = async (url, settings) => {
    const img = await file2img(url, settings);
    const movement_mode = settingsString(settings, 'config.movement_mode', 'greyscale-line');
    if (movement_mode === "greyscale-line") {
        img.flip({horizontal: false, vertical: true});
        return img2toolPathStrBw(img, settings);
    }
    return img2toolPathStrGs(img, settings);
};

export default rasterGreyscale;
