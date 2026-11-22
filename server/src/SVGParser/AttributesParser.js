import {parseFloats, cssColor2Hex, xformMultiply} from './Utils.js';

const log = {
    log: console.log,
    warn: console.warn
};

function parseDAttribute(value) {
    const items = [];
    const pattern = /([A-Za-z]|(-?\.?[0-9]+\.?[0-9]*(e-?[0-9]*)?))/g;
    let match = pattern.exec(value);
    while (match) {
        const number = parseFloat(match[1]);
        if (Number.isNaN(number)) {
            items.push(match[1]);
        } else {
            items.push(number);
        }
        match = pattern.exec(value);
    }
    return items;
}

function parseCoordinate(value) {
    const pattern = /(-?[0-9]+\.?[0-9]*(e-?[0-9]*)?)(px|pt|pc|mm|cm|in|%|em|ex)?/;
    const match = pattern.exec(value);
    if (match) {
        const number = parseFloat(match[1]);
        const unit = match[3];
        const DPI = 72;
        switch (unit) {
            case 'px':
                return number;
            case 'pt':
                return number / 72 * DPI;
            case 'pc':
                return number / 6 * DPI;

            case 'mm':
                return number;
            case 'cm':
                return number * 10;
            case 'in':
                return number * 25.4;

            // em and ex need the font size, which the parser does not track.
            case 'em':
            case 'ex':
                return number;
            case '%':
                // Handled by the caller, which knows the parent value.
                return number / 100.0;
            default:
                return number;
        }
    }

    return 0;
}

// https://developer.mozilla.org/en-US/docs/Web/SVG/Content_type#Color
function parseColor(value) {
    value = value.trim();

    if (value[0] === '#') {
        if (value.length === 4) {
            let hexColor = '#';
            for (let i = 1; i < 4; i++) {
                hexColor += value[i] + value[i];
            }
            return hexColor;
        } else {
            return value;
        }
    }

    if (value.startsWith('rgb(')) {
        value = value.slice(4);
        const floats = parseFloats(value);
        if (value.indexOf('%') === -1) {
            if (floats.length === 3) {
                const hexValue = 0x1000000 + 0x10000 * floats[0] + 0x100 * floats[1] + floats[2];
                return `#${Number(hexValue).toString(16).slice(1)}`;
            }
        } else if (floats.length === 3) {
            const hexValue = 0x1000000 + 0x10000 * (floats[0] / 100) * 255 + 0x100 * (floats[1] / 100) * 255 + (floats[2] / 100) * 255;
            return `#${Number(hexValue).toString(16).slice(1)}`;
        }
    }

    const cssColor = cssColor2Hex(value);
    if (cssColor) {
        return cssColor;
    }

    return null;
}

// https://www.w3.org/TR/SVG/painting.html#SpecifyingPaint
function parsePaint(value) {
    if (value === 'none') {
        return null;
    }

    if (value.startsWith('url')) {
        return null;
    }

    const color = parseColor(value);
    if (color) {
        return color;
    }

    return '#000000';
}

// https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform
function parseTransform(value) {
    const pattern = /([a-z]+)\s*\(([^)]*)\)/gi;

    const xform = [1, 0, 0, 1, 0, 0];

    let match = pattern.exec(value);
    while (match) {
        const func = match[1].toLowerCase();
        const params = parseFloats(match[2]);

        switch (func) {
            case 'matrix': {
                if (params.length === 6) {
                    xformMultiply(xform, params);
                }
                break;
            }
            case 'translate': {
                if (params.length === 1) {
                    params[1] = 0;
                }
                xformMultiply(xform, [1, 0, 0, 1, params[0], params[1]]);
                break;
            }
            case 'scale': {
                if (params.length === 1) {
                    params[1] = params[0];
                }
                xformMultiply(xform, [params[0], 0, 0, params[1], 0, 0]);
                break;
            }
            case 'rotate': {
                if (params.length === 1) {
                    params[1] = 0;
                    params[2] = 0;
                }
                const angle = params[0] * Math.PI / 180;
                xformMultiply(xform, [1, 0, 0, 1, params[1], params[2]]);
                xformMultiply(xform, [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]);
                xformMultiply(xform, [1, 0, 0, 1, -params[1], -params[2]]);
                break;
            }
            case 'skewx': {
                const angle = params[0] * Math.PI / 180;
                xformMultiply(xform, [1, 0, Math.tan(angle), 1, 0, 0]);
                break;
            }
            case 'skewy': {
                const angle = params[0] * Math.PI / 180;
                xformMultiply(xform, [1, Math.tan(angle), 0, 1, 0, 0]);
                break;
            }
            default: {
                break;
            }
        }

        match = pattern.exec(value);
    }

    return xform;
}

class AttributesParser {
    constructor(parser) {
        this.parser = parser;
    }

    parse(node, parentAttributes) {
        const attributes = {};
        for (const key of ['fill', 'stroke', 'strokeWidth', 'visibility', 'width', 'height']) {
            attributes[key] = parentAttributes[key];
        }
        attributes.xform = [1, 0, 0, 1, 0, 0];

        if (!node.$) {
            return attributes;
        }

        xformMultiply(attributes.xform, parentAttributes.xform);

        Object.keys(node.$).forEach((key) => {
            const value = node.$[key];
            this.parseAttribute(attributes, parentAttributes, key, value);
        });

        return attributes;
    }

    parseAttribute(attributes, parentAttributes, key, value) {
        switch (key) {
            case 'width':
            case 'height':
            case 'cx':
            case 'cy':
            case 'r':
            case 'rx':
            case 'ry':
            case 'x':
            case 'y':
            case 'x1':
            case 'y1':
            case 'x2':
            case 'y2': {
                attributes[key] = parseCoordinate(value);
                if (value.endsWith('%')) {
                    // Percentage of the parent's value.
                    attributes[key] *= parentAttributes[key];
                }
                break;
            }
            case 'stroke-width': {
                attributes.strokeWidth = parseCoordinate(value);
                break;
            }
            case 'd': {
                attributes.d = parseDAttribute(value);
                break;
            }
            case 'color': {
                const color = parseColor(value);
                if (color && color !== 'inherit') {
                    attributes.color = color;
                }
                break;
            }
            case 'fill':
            case 'stroke': {
                const color = parsePaint(value);
                attributes[key] = color;
                break;
            }
            case 'transform': {
                const xform = parseTransform(value);
                xformMultiply(attributes.xform, xform);
                break;
            }
            case 'style': {
                const segments = value.split(';');
                for (const segment of segments) {
                    const pair = segment.split(':');
                    if (pair.length === 2) {
                        const name = pair[0].trim();
                        const rawValue = pair[1].trim();
                        this.parseAttribute(attributes, parentAttributes, name, rawValue);
                    }
                }
                break;
            }
            case 'display': {
                if (value === 'none') {
                    attributes.visible = false;
                }
                break;
            }
            case 'visibility': {
                if (value !== 'inherit') {
                    attributes.visibility = (value === 'visible');
                }
                break;
            }
            case 'points': {
                attributes.points = parseFloats(value);
                break;
            }
            case 'viewBox': {
                attributes.viewBox = parseFloats(value);
                break;
            }
            case 'fill-rule': {
                attributes[key] = value;
                break;
            }
            default:
                break;
        }
    }
}

export default AttributesParser;
