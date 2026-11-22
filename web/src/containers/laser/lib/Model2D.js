import _ from 'lodash';
import settingsBw from "./settings/bw.json";
import settingsGs from "./settings/greyscale.json";
import settingsSvg from "./settings/svg.json";
import config_text from "./settings/config_text.json";
import Model2DBase from '../../_2d/lib/Model2DBase.js';
import toolPathLines2gcode from "./toolPathLines2gcode";
import {TOOL_PATH_GENERATE_LASER} from "../../../constants.js";
import {FRONT_END} from "../../../utils/workAreaUtils";

class Model2D extends Model2DBase {
    constructor(fileType) {
        super(fileType, {
            previewEvent: TOOL_PATH_GENERATE_LASER,
            frontEnd: FRONT_END.LASER,
            trackPreviewing: true,
            travelColor: null,
            createSettings: (type) => {
                switch (type) {
                    case "bw":
                        return _.cloneDeep(settingsBw);
                    case "greyscale":
                        return _.cloneDeep(settingsGs);
                    case "svg":
                    case "text":
                        return _.cloneDeep(settingsSvg);
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

    generateGcode(advance) {
        return toolPathLines2gcode(this.toolPathLines, this.settings, advance);
    }
}

export default Model2D;
