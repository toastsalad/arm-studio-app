import Normalizer from './Normalizer.js';
import {loadSource, readGeometry, fitImage} from './loadImage.js';
import {settingsBool, settingsNumber, settingsString, settingsPlaceholder} from '../settings.js';

// Settings: {transformation, config}; config: {invert, bw, density}
const file2img = async (url, settings) => {
    const bw = settingsNumber(settings, 'config.bw', 128);
    const invert = settingsBool(settings, 'config.invert', false);

    const img = (await loadSource(url)).greyscale();
    fitImage(img, readGeometry(settings));

    img.scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
        if (img.bitmap.data[idx + 3] === 0) {
            for (let channel = 0; channel < 3; ++channel) {
                img.bitmap.data[idx + channel] = 255;
            }
        } else {
            const value = img.bitmap.data[idx];
            if (invert) {
                if (value <= bw) {
                    for (let channel = 0; channel < 3; ++channel) {
                        img.bitmap.data[idx + channel] = 255;
                    }
                } else {
                    for (let channel = 0; channel < 3; ++channel) {
                        img.bitmap.data[idx + channel] = 0;
                    }
                }
            } else {
                if (value <= bw) {
                    for (let channel = 0; channel < 3; ++channel) {
                        img.bitmap.data[idx + channel] = 0;
                    }
                } else {
                    for (let channel = 0; channel < 3; ++channel) {
                        img.bitmap.data[idx + channel] = 255;
                    }
                }
            }
        }
    });

    img.flip({horizontal: false, vertical: true});
    img.background = 0xffffffff;
    return img;
};

// Settings: {config, working_parameters}; config: {bw, density, line_direction}
const img2toolPathStrBw = (img, settings) => {
    function extractSegment(data, start, box, direction, sign) {
        let len = 1;

        function idx(pos) {
            return pos.x * 4 + pos.y * box.width * 4;
        }

        for (; ;) {
            const current = {
                x: start.x + direction.x * len * sign,
                y: start.y + direction.y * len * sign
            };
            if (!bitEqual(data[idx(current)], data[idx(start)]) ||
                current.x < 0 || current.x >= box.width ||
                current.y < 0 || current.y >= box.height) {
                break;
            }
            len += 1;
        }
        return len;
    }

    function genMovements(normalizer, start, end, power_placeholder) {
        return [
            `G0 X${normalizer.x(start.x)} Y${normalizer.y(start.y)}`,
            `M3 S${power_placeholder}`,
            `G1 X${normalizer.x(end.x)} Y${normalizer.y(end.y)}`,
            'M5'
        ];
    }

    function bitEqual(first, second) {
        return (first <= bw && second <= bw) || (first > bw && second > bw);
    }

    const width = img.bitmap.width;
    const height = img.bitmap.height;

    const bw = settingsNumber(settings, 'config.bw', 140);
    const density = settingsNumber(settings, 'config.density', 4);
    const line_direction = settingsString(settings, 'config.line_direction', 'Horizontal');

    const work_speed_placeholder = settingsPlaceholder(settings, 'working_parameters.work_speed', '');
    const jog_speed_placeholder = settingsPlaceholder(settings, 'working_parameters.jog_speed', '');
    const power_placeholder = settingsPlaceholder(settings, 'working_parameters.power', '');

    const normalizer = new Normalizer('Center', 0, width, 0, height, {
        x: 1 / density,
        y: 1 / density
    });

    let toolPathLines = [];
    toolPathLines.push(`G0 F${jog_speed_placeholder}`);
    toolPathLines.push(`G1 F${work_speed_placeholder}`);
    if (!line_direction || line_direction === 'Horizontal') {
        const direction = {x: 1, y: 0};
        for (let j = 0; j < height; j++) {
            let len = 0;
            const isReverse = (j % 2 !== 0);
            const sign = isReverse ? -1 : 1;
            for (let i = (isReverse ? width - 1 : 0); isReverse ? i >= 0 : i < width; i += len * sign) {
                const idx = i * 4 + j * width * 4;
                if (img.bitmap.data[idx] <= bw) {
                    const start = {
                        x: i,
                        y: j
                    };
                    len = extractSegment(img.bitmap.data, start, img.bitmap, direction, sign);
                    const end = {
                        x: start.x + direction.x * len * sign,
                        y: start.y + direction.y * len * sign
                    };
                    toolPathLines = toolPathLines.concat(genMovements(normalizer, start, end, power_placeholder));
                } else {
                    len = 1;
                }
            }
        }
    } else if (line_direction === 'Vertical') {
        let direction = {x: 0, y: 1};
        for (let i = 0; i < width; ++i) {
            let len = 0;
            const isReverse = (i % 2 !== 0);
            const sign = isReverse ? -1 : 1;
            for (let j = (isReverse ? height - 1 : 0); isReverse ? j >= 0 : j < height; j += len * sign) {
                const idx = i * 4 + j * width * 4;
                if (img.bitmap.data[idx] <= bw) {
                    const start = {
                        x: i,
                        y: j
                    };
                    len = extractSegment(img.bitmap.data, start, img.bitmap, direction, sign);
                    const end = {
                        x: start.x + direction.x * len * sign,
                        y: start.y + direction.y * len * sign
                    };
                    toolPathLines = toolPathLines.concat(genMovements(normalizer, start, end, power_placeholder));
                } else {
                    len = 1;
                }
            }
        }
    } else if (line_direction === 'Diagonal') {
        const direction = {x: 1, y: -1};
        for (let diagonal = 0; diagonal < width + height - 1; diagonal++) {
            let len = 0;
            const isReverse = (diagonal % 2 !== 0);
            const sign = isReverse ? -1 : 1;
            for (let i = (isReverse ? width - 1 : 0); isReverse ? i >= 0 : i < width; i += len * sign) {
                const row = diagonal - i;
                if (row < 0 || row > height) {
                    len = 1; // FIXME: optimize
                } else {
                    const idx = i * 4 + row * width * 4;
                    if (img.bitmap.data[idx] <= bw) {
                        const start = {
                            x: i,
                            y: row
                        };
                        len = extractSegment(img.bitmap.data, start, img.bitmap, direction, sign);
                        const end = {
                            x: start.x + direction.x * len * sign,
                            y: start.y + direction.y * len * sign
                        };
                        toolPathLines = toolPathLines.concat(genMovements(normalizer, start, end, power_placeholder));
                    } else {
                        len = 1;
                    }
                }
            }
        }
    } else if (line_direction === 'Diagonal2') {
        const direction = {x: 1, y: 1};
        for (let diagonal = -height; diagonal <= width; diagonal++) {
            const isReverse = (diagonal % 2 !== 0);
            const sign = isReverse ? -1 : 1;
            let len = 0;
            for (let i = (isReverse ? width - 1 : 0); isReverse ? i >= 0 : i < width; i += len * sign) {
                const row = i - diagonal;
                if (row < 0 || row > height) {
                    len = 1;
                } else {
                    const idx = i * 4 + row * width * 4;
                    if (img.bitmap.data[idx] <= bw) {
                        let start = {
                            x: i,
                            y: row
                        };
                        len = extractSegment(img.bitmap.data, start, img.bitmap, direction, sign);
                        const end = {
                            x: start.x + direction.x * len * sign,
                            y: start.y + direction.y * len * sign
                        };
                        toolPathLines = toolPathLines.concat(genMovements(normalizer, start, end, power_placeholder));
                    } else {
                        len = 1;
                    }
                }
            }
        }
    }
    toolPathLines.push('G0 X0 Y0');
    return toolPathLines.join('\n');
};

const rasterBw = async (url, settings) => {
    const img = await file2img(url, settings);
    return img2toolPathStrBw(img, settings);
};

export {rasterBw, img2toolPathStrBw};
