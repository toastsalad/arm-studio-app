import {toolPathLinesToGcode} from '../../_2d/lib/gcodeLines.js';

const toolPathLines2gcode = (toolPathLines, settings, advance) => {
    const working = settings.working_parameters.children;
    const work_speed = working.work_speed;
    const jog_speed = working.jog_speed;
    const dwell_time = working.dwell_time;
    const engrave_time = working.engrave_time;
    const power = working.power;

    const {x, y} = settings.transformation.children;

    const gcodeStr = toolPathLinesToGcode(toolPathLines, {
        translateX: x.default_value,
        translateY: y.default_value,
        advance,
        resolveCommand: (key, value) => {
            switch (key) {
                case 'F':
                    if (value === work_speed.placeholder) value = work_speed.default_value;
                    else if (value === jog_speed.placeholder) value = jog_speed.default_value;
                    return [key + value];
                case 'P':
                    if (value === dwell_time.placeholder) value = dwell_time.default_value;
                    else if (value === engrave_time.placeholder) value = engrave_time.default_value;
                    return [key + value];
                case 'S':
                    if (value === power.placeholder) value = Math.floor(power.default_value * 255 / 100);
                    return [key + value];
                default:
                    return null;
            }
        }
    });

    return processGcodeMultiPass(gcodeStr, settings);
};

const processGcodeMultiPass = (gcodeStr, settings) => {
    const {multi_pass} = settings.working_parameters.children;
    const {passes, pass_depth} = multi_pass.children;
    if (multi_pass.default_value) {
        let result = '';
        for (let i = 0; i < passes.default_value; i++) {
            result += `; Laser multi-pass, pass ${i + 1} with Z = ${-i * pass_depth.default_value}\n`;
            const zOffset = -i * pass_depth.default_value;
            result += `G0 Z${zOffset} F150\n`;
            result += gcodeStr + '\n';
        }
        // move back to work origin
        result += 'G0 Z0\n';
        return result;
    }
    return `G0 Z0\n` + gcodeStr;
};

export default toolPathLines2gcode;
