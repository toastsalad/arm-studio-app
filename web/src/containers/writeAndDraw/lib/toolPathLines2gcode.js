import {toolPathLinesToGcode} from '../../_2d/lib/gcodeLines.js';

const toolPathLines2gcode = (toolPathLines, settings, write_and_draw, advance) => {
    const working = settings.working_parameters.children;
    const work_speed = working.work_speed;
    const jog_speed = working.jog_speed;

    const jog_pen_offset = write_and_draw.jog_pen_offset.default_value;

    const {x, y} = settings.transformation.children;

    return toolPathLinesToGcode(toolPathLines, {
        translateX: x.default_value,
        translateY: y.default_value,
        advance,
        resolveCommand: (key, value) => {
            switch (key) {
                case 'F':
                    if (value === work_speed.placeholder) value = work_speed.default_value;
                    else if (value === jog_speed.placeholder) value = jog_speed.default_value;
                    return [key + value];
                case 'M':
                    if (value === 3) return ['G1 Z0'];
                    if (value === 5) return [`G0 Z${jog_pen_offset}`];
                    return [key + value];
                case 'S':
                    // M3 S#power#, only for the laser.
                    return [];
                default:
                    return null;
            }
        }
    });
};

export default toolPathLines2gcode;
