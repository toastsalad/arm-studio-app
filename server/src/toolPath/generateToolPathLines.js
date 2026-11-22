import toolPathStr4svg from './toolPathStr4svg.js';
import {plotterHelperSvg2toolPathStr, plotterHelperRaster2toolPathStr, plotterHelperRasterShade, isToneStyle} from './plotterHelperBridge.js';
import toolPathStr2toolPathLines from "./toolPathStr2toolPathLines.js";
import {runRasterWorker} from './rasterWorkerClient.js';
import {TOOL_PATH_RENDER_METHOD_POINT, TOOL_PATH_RENDER_METHOD_LINE} from "../constants.js"
import {hasSetting, settingsString} from '../settings.js';

const generateToolPathLines = async (fileType, url, settings, usePlotterHelper) => {
    let toolPathStr = null;
    // The tone fills read an image's luminance across the whole picture, so a raster upload goes to them
    // as a tone source instead of being toned or traced first. On a vector file the same fills fall back
    // to the shape's own boundary tone, which is what the engine does without --tone.
    const shadesByTone = isToneStyle(settings);
    switch (fileType) {
        case "bw":
            toolPathStr = shadesByTone
                ? await plotterHelperRasterShade(url, settings)
                : await runRasterWorker('bw', url, settings);
            break;
        case "greyscale":
            toolPathStr = shadesByTone
                ? await plotterHelperRasterShade(url, settings)
                : await runRasterWorker('greyscale', url, settings);
            break;
        case "svg":
        // Text is rendered to an SVG before upload, so it plots down the same path.
        case "text":
            toolPathStr = usePlotterHelper
                ? await plotterHelperSvg2toolPathStr(url, settings)
                : await toolPathStr4svg(url, settings);
            break;
        // Raster line art traced by centerline; there is no built-in fallback.
        case "trace":
            toolPathStr = shadesByTone
                ? await plotterHelperRasterShade(url, settings)
                : await plotterHelperRaster2toolPathStr(url, settings);
            break;
        // A picture shaded by its own tone. The Image tab only offers the tone fills, so this always goes
        // through the engine, and there is no built-in converter to fall back to.
        case "image":
            toolPathStr = shadesByTone
                ? await plotterHelperRasterShade(url, settings)
                : await plotterHelperRaster2toolPathStr(url, settings);
            break;
    }
    toolPathStr = preHandle(toolPathStr, settings);
    const toolPathLines = toolPathStr2toolPathLines(toolPathStr);
    return toolPathLines;
};

// Add start_gcode, end_gcode and render mode
const preHandle = (toolPathStr, settings) => {
    // Greyscale has line/dot modes with different rendering
    // Render mode must live in the G-code so exported files render correctly
    let toolPathRenderMethod = TOOL_PATH_RENDER_METHOD_LINE;
    if (hasSetting(settings, 'config.movement_mode')) {
        const movement_mode = settingsString(settings, 'config.movement_mode', '');
        if (movement_mode === "greyscale-dot") {
            toolPathRenderMethod = TOOL_PATH_RENDER_METHOD_POINT;
        }
    }
    const start_gcode = settingsString(settings, 'start_gcode', '');
    const end_gcode = settingsString(settings, 'end_gcode', '');

    return [toolPathRenderMethod, start_gcode, toolPathStr, end_gcode].join("\n")
};

export default generateToolPathLines;
