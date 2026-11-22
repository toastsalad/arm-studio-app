import SVGParser, {flip, rotate, scale, sortShapes, translate} from '../SVGParser/index.js';
import {svgToSegments} from './SVGFill.js';
import Normalizer from './Normalizer.js';
import getFlipFlag from "./getFlipFlag.js";
import {degree2radian, fetchBuffer} from '../utils/index.js';
import {settingsBool, settingsNumber, settingsString, settingsPlaceholder} from '../settings.js';

function pointEqual(first, second) {
    return first[0] === second[0] && first[1] === second[1];
}

const svg2toolPathStr = async (url, settings) => {
    const work_speed_placeholder = settingsPlaceholder(settings, 'working_parameters.work_speed', '');
    const jog_speed_placeholder = settingsPlaceholder(settings, 'working_parameters.jog_speed', '');
    const power_placeholder = settingsPlaceholder(settings, 'working_parameters.power', '');

    const originWidth = settingsNumber(settings, 'transformation.img_width', 0);
    const originHeight = settingsNumber(settings, 'transformation.img_height', 0);
    const rotation = settingsNumber(settings, 'transformation.rotation', 0); // degrees, counter-clockwise
    const flip_model = settingsString(settings, 'transformation.flip_model', 'None');

    let flipFlag = getFlipFlag(flip_model);

    const targetWidth = settingsNumber(settings, 'transformation.width', 0);
    const targetHeight = settingsNumber(settings, 'transformation.height', 0);

    const fillEnabled = settingsBool(settings, 'config.fill', false);
    const fillDensity = settingsNumber(settings, 'config.fill.fill_density', 4);
    const optimizePath = settingsBool(settings, 'config.optimize_path', false);

    const svgStr = (await fetchBuffer(url)).toString('utf8');

    const svgParser = new SVGParser();
    const svg = await svgParser.parse(svgStr);

    flip(svg, 1);
    flip(svg, flipFlag);
    scale(svg, {
        x: targetWidth / originWidth,
        y: targetHeight / originHeight
    });
    if (optimizePath) {
        sortShapes(svg);
    }
    rotate(svg, degree2radian(rotation));
    translate(svg, -svg.viewBox[0], -svg.viewBox[1]);

    const normalizer = new Normalizer(
        'Center',
        svg.viewBox[0],
        svg.viewBox[0] + svg.viewBox[2],
        svg.viewBox[1],
        svg.viewBox[1] + svg.viewBox[3],
        {x: 1, y: 1}
    );

    const segments = svgToSegments(svg, {
        width: svg.viewBox[2],
        height: svg.viewBox[3],
        fillEnabled: fillEnabled,
        fillDensity: fillDensity
    });

    let toolPathLines = [];
    let current = null;

    // Write & draw: pen up, set speeds, then lower the pen at each stroke start.
    toolPathLines.push('M5');
    toolPathLines.push(`G0 F${jog_speed_placeholder}`);
    toolPathLines.push(`G1 F${work_speed_placeholder}`);

    for (const segment of segments) {
        if (!current || current && !(pointEqual(current, segment.start))) {
            if (current) {
                toolPathLines.push('M5');
            }
            toolPathLines.push(`G0 X${normalizer.x(segment.start[0])} Y${normalizer.y(segment.start[1])}`);
            toolPathLines.push(`M3 S${power_placeholder}`);
        }
        toolPathLines.push(`G1 X${normalizer.x(segment.end[0])} Y${normalizer.y(segment.end[1])}`);
        current = segment.end;
    }
    toolPathLines.push('M5');
    toolPathLines.push('G0 X0 Y0');
    return toolPathLines.join('\n');
};

const toolPathStr4svg = async (url, settings) => {
    return await svg2toolPathStr(url, settings);
};

export default toolPathStr4svg;
