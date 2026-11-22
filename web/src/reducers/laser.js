import _ from 'lodash';
import messageI18n from "../utils/messageI18n";
import {computeBoundary} from "../containers/_2d/lib/toolPathUtils";
import {uploadImage} from "../api";
import Model2D from "../containers/laser/lib/Model2D";
import {textFile} from '../containers/_2d/lib/textFile';
import {estimateModelsTime} from '../utils/estimatePlotTime.js';
import {removeAllModels, removeModel} from '../containers/_2d/lib/removeModels.js';

const ACTION_MODEL_ADDED = 'laser/modelAdded';
const ACTION_MODEL_SELECTED = 'laser/modelSelected';
const ACTION_MODEL_REMOVED = 'laser/modelRemoved';
const ACTION_PREVIEW_STATE_CHANGED = 'laser/previewStateChanged';
const ACTION_TRANSFORMATION_CHANGED = 'laser/transformationChanged';
const ACTION_CONFIG_CHANGED = 'laser/configChanged';
const ACTION_CONFIG_TEXT_CHANGED = 'laser/configTextChanged';
const ACTION_WORKING_PARAMETERS_CHANGED = 'laser/workingParametersChanged';
const ACTION_GCODE_GENERATED = 'laser/gcodeGenerated';
const ACTION_IS_LOCK_SCALE_TOGGLED = 'laser/isLockScaleToggled';

const INITIAL_STATE = {
    model: null,
    transformation: null,
    config: null,
    config_text: null,
    working_parameters: null,
    modelCount: 0,
    isAllPreviewed: false,
    gcode: null,

    isLockScale: true
};

let rendererParent = null;

// Call only after every model is previewed.
const getGcode4runBoundary = () => {
    const negInfinity = -Number.MAX_VALUE;
    const infinity = Number.MAX_VALUE;
    let minX = infinity, minY = infinity;
    let maxX = negInfinity, maxY = negInfinity;
    for (let i = 0; i < rendererParent.children.length; i++) {
        const model = rendererParent.children[i];
        const {toolPathLines, settings} = model;
        const {minX: modelMinX, maxX: modelMaxX, minY: modelMinY, maxY: modelMaxY} = computeBoundary(toolPathLines, settings);
        minX = Math.min(modelMinX, minX);
        maxX = Math.max(modelMaxX, maxX);
        minY = Math.min(modelMinY, minY);
        maxY = Math.max(modelMaxY, maxY);
    }
    const corner1 = {x: minX.toFixed(1), y: minY.toFixed(1)};
    const corner2 = {x: maxX.toFixed(1), y: minY.toFixed(1)};
    const corner3 = {x: maxX.toFixed(1), y: maxY.toFixed(1)};
    const corner4 = {x: minX.toFixed(1), y: maxY.toFixed(1)};
    const gcodeArr = [];
    gcodeArr.push("M2000");
    gcodeArr.push("G0 F2000");
    gcodeArr.push(`G0 X${corner1.x} Y${corner1.y}`);
    gcodeArr.push(`G0 X${corner2.x} Y${corner2.y}`);
    gcodeArr.push(`G0 X${corner3.x} Y${corner3.y}`);
    gcodeArr.push(`G0 X${corner4.x} Y${corner4.y}`);
    gcodeArr.push(`G0 X${corner1.x} Y${corner1.y}`);
    const gcode = gcodeArr.join("\n") + "\n";
    return gcode;
};

const actions = {
    setRendererParent: (object3d) => {
        rendererParent = object3d;
        return {type: '@@arm-studio/NOOP'};
    },
    addModel: (fileType, file) => async (dispatch, getState) => {
        if (!["bw", "greyscale", "svg", "text"].includes(fileType)) {
            return {type: '@@arm-studio/NOOP'};
        }

        const model = new Model2D(fileType);

        if (fileType === "text") {
            try {
                file = await textFile(model.config_text);
            } catch (e) {
                console.error('text render failed:', e);
                messageI18n.warning('Could not draw that font. Choose another one.');
                return {type: '@@arm-studio/NOOP'};
            }
        }

        const response = await uploadImage(file);
        const {url, width, height} = response;
        model.loadImg(url, width, height);

        for (const child of rendererParent.children) {
            child.setSelected(false);
        }
        rendererParent.add(model);
        model.setSelected(true);

        const {transformation, config, working_parameters} = model.settings;
        dispatch(actions.modelAdded({
            model,
            transformation,
            config,
            workingParameters: working_parameters,
            configText: model.config_text,
            modelCount: rendererParent.children.length,
        }));

        model.addEventListener('preview', (event) => {
            const {isPreviewed} = event.data;
            if (!isPreviewed) {
                dispatch(actions.previewStateChanged({isAllPreviewed: false}));
            } else {
                let isAllPreviewed = true;
                for (let i = 0; i < rendererParent.children.length; i++) {
                    const other = rendererParent.children[i];
                    if (!other.isPreviewed) {
                        isAllPreviewed = false;
                        break;
                    }
                }
                dispatch(actions.previewStateChanged({isAllPreviewed}));
            }
        });
        model.preview();
    },
    selectModel: (model) => (dispatch, getState) => {
        // The caller passes whatever the canvas picked. Deselecting every model before finding out
        // the target is not one would strip the handles off all of them and leave nothing focused.
        if (!model || typeof model.setSelected !== 'function') {
            return {type: '@@arm-studio/NOOP'};
        }
        const selected = getState().laser.model;
        if (model === selected) {
            return {type: '@@arm-studio/NOOP'};
        }

        for (const child of rendererParent.children) {
            child.setSelected(false);
        }
        model.setSelected(true);

        const {transformation, config, working_parameters} = model.settings;
        // A drawing may be selected before its text has been rendered; the caller
        // only needs config_text when it comes with the model.
        dispatch(actions.modelSelected({
            model,
            transformation,
            config,
            workingParameters: working_parameters,
            configText: model.config_text,
        }));
    },
    removeSelected: () => (dispatch, getState) => {
        const selected = getState().laser.model;
        if (!selected) {
            return {type: '@@arm-studio/NOOP'};
        }

        removeModel(rendererParent, selected);
        dispatch(actions.modelRemoved({modelCount: rendererParent.children.length}));
    },
    removeAll: () => (dispatch) => {
        removeAllModels(rendererParent);
        dispatch(actions.modelRemoved({modelCount: rendererParent ? rendererParent.children.length : 0}));
    },
    duplicateSelected: () => {
        return {type: '@@arm-studio/NOOP'};
    },
    undo: () => {
        return {type: '@@arm-studio/NOOP'};
    },
    redo: () => {
        return {type: '@@arm-studio/NOOP'};
    },
    updateTransformation: (key, value, preview) => (dispatch, getState) => {
        const selected = getState().laser.model;
        const {workHeightLaser} = getState().persistentData
        const { isLockScale } = getState().laser
        if (!selected) {
            return {type: '@@arm-studio/NOOP'};
        }
        selected.updateTransformation(key, value, preview, workHeightLaser, isLockScale);
        dispatch(actions.transformationChanged({
            transformation: _.cloneDeep(selected.settings.transformation),
        }));
    },
    updateConfig: (key, value) => (dispatch, getState) => {
        const selected = getState().laser.model;
        if (!selected) {
            return {type: '@@arm-studio/NOOP'};
        }
        selected.updateConfig(key, value);
        dispatch(actions.configChanged({
            config: _.cloneDeep(selected.settings.config),
        }));
    },
    // Typing changes the drawing itself, so re-render it and load the result like a fresh import.
    updateConfigText: (key, value) => async (dispatch, getState) => {
        const selected = getState().laser.model;
        if (!selected || selected.fileType !== "text") {
            return {type: '@@arm-studio/NOOP'};
        }

        // Render first, and only keep the change if it worked. A font the browser cannot read -
        // a corrupt upload, or one deleted while it was selected - used to reject here and take
        // the whole action down with it, leaving the panel typing into nothing with no message.
        const setting = selected.config_text.children[key];
        const previous = setting.default_value;
        setting.default_value = value;

        let file;
        try {
            file = await textFile(selected.config_text);
        } catch (e) {
            setting.default_value = previous;
            console.error('text render failed:', e);
            messageI18n.warning('Could not draw that font. Choose another one.');
            return {type: '@@arm-studio/NOOP'};
        }

        const {url, width, height} = await uploadImage(file);
        selected.loadImg(url, width, height);
        selected.preview();

        dispatch(actions.configTextChanged({
            configText: _.cloneDeep(selected.config_text),
            transformation: _.cloneDeep(selected.settings.transformation),
        }));
    },
    updateWorkingParameters: (key, value) => (dispatch, getState) => {
        const selected = getState().laser.model;
        if (!selected) {
            return {type: '@@arm-studio/NOOP'};
        }
        selected.updateWorkingParameters(key, value);
        dispatch(actions.workingParametersChanged({
            workingParameters: _.cloneDeep(selected.settings.working_parameters),
        }));
    },
    generateGcode: () => (dispatch, getState) => {
        const { advance } = getState().persistentData
        const gcodeArr = [];
        const models = [];
        for (let i = 0; i < rendererParent.children.length; i++) {
            const model = rendererParent.children[i];
            models.push(model);
            gcodeArr.push(model.generateGcode(advance));
        }
        const gcode = gcodeArr.join("\n");

        // How long the machine will take: inked length at the laser speed plus travelling length at the jog
        // speed. Returned as well as stored so the button can put it in its own confirmation.
        const estimate = estimateModelsTime(models);
        dispatch(actions.gcodeGenerated({gcode, estimate}));
        return estimate;
    },

    toggleIsLockScale: () => (dispatch) => {
        dispatch(actions.isLockScaleToggled());
    },

    // Named actions: one per rule. The fields each transition touches live in the
    // reducer, so rules like "removing a drawing also drops its preview g-code" are
    // written once instead of repeated at every call site.
    modelAdded: ({model, transformation, config, workingParameters, configText, modelCount}) => ({
        type: ACTION_MODEL_ADDED, model, transformation, config, workingParameters, configText, modelCount,
    }),
    modelSelected: ({model, transformation, config, workingParameters, configText}) => ({
        type: ACTION_MODEL_SELECTED, model, transformation, config, workingParameters, configText,
    }),
    modelRemoved: ({modelCount}) => ({type: ACTION_MODEL_REMOVED, modelCount}),
    previewStateChanged: ({isAllPreviewed}) => ({type: ACTION_PREVIEW_STATE_CHANGED, isAllPreviewed}),
    transformationChanged: ({transformation}) => ({type: ACTION_TRANSFORMATION_CHANGED, transformation}),
    configChanged: ({config}) => ({type: ACTION_CONFIG_CHANGED, config}),
    configTextChanged: ({configText, transformation}) => ({
        type: ACTION_CONFIG_TEXT_CHANGED, configText, transformation,
    }),
    workingParametersChanged: ({workingParameters}) => ({
        type: ACTION_WORKING_PARAMETERS_CHANGED, workingParameters,
    }),
    gcodeGenerated: ({gcode}) => ({type: ACTION_GCODE_GENERATED, gcode}),
    isLockScaleToggled: () => ({type: ACTION_IS_LOCK_SCALE_TOGGLED}),
};

const reducer = (state = INITIAL_STATE, action) => {
    switch (action.type) {
        case ACTION_MODEL_ADDED:
            return {
                ...state,
                model: action.model,
                transformation: action.transformation,
                config: action.config,
                working_parameters: action.workingParameters,
                config_text: action.configText,
                modelCount: action.modelCount,
                // A new drawing has nothing previewed under the new g-code yet.
                isAllPreviewed: false,
                gcode: null,
            };
        case ACTION_MODEL_SELECTED:
            return {
                ...state,
                model: action.model,
                transformation: action.transformation,
                config: action.config,
                working_parameters: action.workingParameters,
                config_text: action.configText,
            };
        case ACTION_MODEL_REMOVED:
            // Removing a drawing also drops everything derived from it.
            return {
                ...state,
                model: null,
                transformation: null,
                config: null,
                config_text: null,
                working_parameters: null,
                modelCount: action.modelCount,
                gcode: null,
            };
        case ACTION_PREVIEW_STATE_CHANGED:
            return {...state, isAllPreviewed: action.isAllPreviewed};
        case ACTION_TRANSFORMATION_CHANGED:
            // Moving the drawing invalidates the preview g-code.
            return {...state, transformation: action.transformation, gcode: null};
        case ACTION_CONFIG_CHANGED:
            return {...state, config: action.config, gcode: null};
        case ACTION_CONFIG_TEXT_CHANGED:
            return {...state, config_text: action.configText, transformation: action.transformation};
        case ACTION_WORKING_PARAMETERS_CHANGED:
            return {...state, working_parameters: action.workingParameters, gcode: null};
        case ACTION_GCODE_GENERATED:
            return {...state, gcode: action.gcode, estimate: action.estimate};
        case ACTION_IS_LOCK_SCALE_TOGGLED:
            return {...state, isLockScale: !state.isLockScale};
        default:
            return state;
    }
};

export {actions, getGcode4runBoundary};
export default reducer;
