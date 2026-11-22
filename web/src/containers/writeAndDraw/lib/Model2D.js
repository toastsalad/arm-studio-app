import _ from 'lodash';
import settingsSvg from "./settings/svg.json";
import settingsTrace from "./settings/trace.json";
import settingsImage from "./settings/image.json";
import config_text from "./settings/config_text.json";
import {getIsAdvance} from '../../../utils/index.js';
import Model2DBase from '../../_2d/lib/Model2DBase.js';
import {TRAVEL_COLOR} from '../../_2d/lib/toolPathRenderer';
import toolPathLines2gcode from "./toolPathLines2gcode";
import {TOOL_PATH_GENERATE_WRITE_AND_DRAW} from "../../../constants.js";
import {FRONT_END} from "../../../utils/workAreaUtils";
import {setSetting} from "../../../utils/settings.js";

// Every model needs its own settings copy, otherwise editing one drawing changes the rest.
const getSettingSvg = () => {
    const settings = _.cloneDeep(settingsSvg);
    if (getIsAdvance()) {
        setSetting(settings, 'transformation.y', 0);
    }
    return settings;
}

const getSettingTrace = () => {
    const settings = _.cloneDeep(settingsTrace);
    if (getIsAdvance()) {
        setSetting(settings, 'transformation.y', 0);
    }
    return settings;
}

// A picture shaded by its own tone. Separate from trace: tracing turns a bitmap into lines and then plots
// them, while this hands the picture to the engine as a tone and lets the fill decide where the ink goes.
const getSettingImage = () => {
    const settings = _.cloneDeep(settingsImage);
    if (getIsAdvance()) {
        setSetting(settings, 'transformation.y', 0);
    }
    return settings;
}

class Model2D extends Model2DBase {
    constructor(fileType) {
        super(fileType, {
            previewEvent: TOOL_PATH_GENERATE_WRITE_AND_DRAW,
            frontEnd: FRONT_END.PEN,
            trackPreviewing: true,
            travelColor: TRAVEL_COLOR,
            createSettings: (type) => {
                switch (type) {
                    case "svg":
                    case "text":
                        return getSettingSvg();
                    case "trace":
                        return getSettingTrace();
                    case "image":
                        return getSettingImage();
                    default:
                        return null;
                }
            }
        });
        // Text is typed, not loaded, so it carries its own settings alongside the SVG ones it plots with.
        if (fileType === "text") {
            this.config_text = _.cloneDeep(config_text);
        }
    }

    resolveSize(size, img_width, img_height, isExampleAndInit) {
        if (isExampleAndInit) {
            const width = 80;
            return {width, height: Number.parseInt(img_height / img_width * width)};
        }
        return size;
    }

    afterImageLoaded(width, height, img_width, img_height, isExampleAndInit) {
        // `width` and `height` are the size the image was fitted to and the ones loadImg already wrote into
        // the transformation. Passing the pixel dimensions through instead is what made a photograph load
        // metres across: a 4000-pixel-wide picture asked for a 4000mm drawing. The call stays because it also
        // pushes the values into the panel.
        this.updateTransformation('width', width);
        this.updateTransformation('height', height);
    }

    generateGcode(write_and_draw, advance) {
        return toolPathLines2gcode(this.toolPathLines, this.settings, write_and_draw, advance);
    }
}

export default Model2D;
