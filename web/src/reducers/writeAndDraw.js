import _ from 'lodash';
import messageI18n from "../utils/messageI18n";
import {computeBoundary} from "../containers/_2d/lib/toolPathUtils";
import {uploadImage} from "../api";
import Model2D from "../containers/writeAndDraw/lib/Model2D";
import {textFile} from '../containers/_2d/lib/textFile';
import write_and_draw from '../containers/writeAndDraw/lib/settings/write_and_draw.json'
import {estimateModelsTime, formatDuration} from '../utils/estimatePlotTime.js';
import {removeAllModels, removeModel} from '../containers/_2d/lib/removeModels.js';
import {actions as plotProgressActions} from './plotProgress';
import {execOrdinalOfToolPathLine, executableLines, modelLineRanges} from '../utils/plotProgress.js';

const ACTION_MODEL_ADDED = 'writeAndDraw/modelAdded';
const ACTION_MODEL_SELECTED = 'writeAndDraw/modelSelected';
const ACTION_MODEL_REMOVED = 'writeAndDraw/modelRemoved';
const ACTION_PREVIEW_STATE_CHANGED = 'writeAndDraw/previewStateChanged';
const ACTION_TRANSFORMATION_CHANGED = 'writeAndDraw/transformationChanged';
const ACTION_CONFIG_CHANGED = 'writeAndDraw/configChanged';
const ACTION_CONFIG_TEXT_CHANGED = 'writeAndDraw/configTextChanged';
const ACTION_WORKING_PARAMETERS_CHANGED = 'writeAndDraw/workingParametersChanged';
const ACTION_WRITE_AND_DRAW_PARAMETERS_CHANGED = 'writeAndDraw/writeAndDrawParametersChanged';
const ACTION_GCODE_GENERATED = 'writeAndDraw/gcodeGenerated';
const ACTION_IS_LOCK_SCALE_TOGGLED = 'writeAndDraw/isLockScaleToggled';


const INITIAL_STATE = {
    model: null,
    transformation: null,
    config: null,
    config_text: null,
    working_parameters: null,
    modelCount: 0,
    isAllPreviewed: false,
    gcode: null,
    write_and_draw: _.cloneDeep(write_and_draw),
    
    isLockScale: true
};

let rendererParent = null;

/**
 * Call only after every model is previewed
 * @returns {Array}
 */
const getGcode4runBoundary = () => {
    const min = -Number.MAX_VALUE;
    const max = Number.MAX_VALUE;
    let _minX = max, _minY = max;
    let _maxX = min, _maxY = min;
    for (let i = 0; i < rendererParent.children.length; i++) {
        const model = rendererParent.children[i];
        const {toolPathLines, settings} = model;
        const {minX, maxX, minY, maxY} = computeBoundary(toolPathLines, settings);
        _minX = Math.min(minX, _minX);
        _maxX = Math.max(maxX, _maxX);
        _minY = Math.min(minY, _minY);
        _maxY = Math.max(maxY, _maxY);
    }

    const p1 = {x: _minX.toFixed(1), y: _minY.toFixed(1)};
    const p2 = {x: _maxX.toFixed(1), y: _minY.toFixed(1)};
    const p3 = {x: _maxX.toFixed(1), y: _maxY.toFixed(1)};
    const p4 = {x: _minX.toFixed(1), y: _maxY.toFixed(1)};
    const gcodeArr = [];
    const jogHeightPen = 10;
    gcodeArr.push('M2000')
    gcodeArr.push(`G1 X${p1.x} Y${p1.y} Z${jogHeightPen} F2000`);
    gcodeArr.push(`G1 X${p1.x} Y${p1.y}`);
    gcodeArr.push(`G1 X${p2.x} Y${p2.y}`);
    gcodeArr.push(`G1 X${p3.x} Y${p3.y}`);
    gcodeArr.push(`G1 X${p4.x} Y${p4.y}`);
    gcodeArr.push(`G1 X${p1.x} Y${p1.y}`);
    const gcode = gcodeArr.join("\n") + "\n";
    return gcode;
};

const actions = {
    setRendererParent: (object3d) => {
        rendererParent = object3d;
        return {type: '@@arm-studio/NOOP'};
    },
    addModel: (fileType, file) => async (dispatch, getState) => {
        // SVG is plotted as-is; raster goes through the centerline tracer in the
        // PlotterHelper engine (see server/src/toolPath/plotterHelperBridge.js). Text is rendered
        // to an SVG here first, then goes down the SVG path. An image is handed to the engine as a
        // tone, so the fill decides where the ink goes instead of the picture being traced.
        if (fileType !== "svg" && fileType !== "trace" && fileType !== "text" && fileType !== "image") {
            return {type: '@@arm-studio/NOOP'};
        }

        const isExampleAndInit = fileType === 'svg'

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

        model.loadImg(url, width, height, isExampleAndInit);

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
                    const model = rendererParent.children[i];
                    if (!model.isPreviewed) {
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
        const selected = getState().writeAndDraw.model;
        if (model === selected) {
            return {type: '@@arm-studio/NOOP'};
        }

        for (const child of rendererParent.children) {
            child.setSelected(false);
        }
        model.setSelected(true);

        const {transformation, config, working_parameters} = model.settings;
        dispatch(actions.modelSelected({
            model,
            transformation,
            config,
            workingParameters: working_parameters,
        }));
    },
    // Removing the drawing the user is looking at: out of the scene first, then freed. A dispose that throws
    // must not leave the drawing on the canvas and the panel still listing it.
    removeSelected: () => (dispatch, getState) => {
        const selected = getState().writeAndDraw.model;
        if (!selected) {
            return {type: '@@arm-studio/NOOP'};
        }

        removeModel(rendererParent, selected);
        dispatch(actions.modelRemoved({modelCount: rendererParent.children.length}));
    },
    removeAll: () => (dispatch) => {
        removeAllModels(rendererParent);

        // No early return when there was nothing in the scene: the state can hold a model the scene no longer
        // has (a canvas that was rebuilt, a drawing removed by its own event), and Clear is the button that is
        // supposed to put that right. Returning NOOP left the panel showing it.
        dispatch(actions.modelRemoved({modelCount: rendererParent ? rendererParent.children.length : 0}));
        // Nothing left to paint red, and whatever was plotted referred to these drawings.
        dispatch(plotProgressActions.cleared());
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
        const selected = getState().writeAndDraw.model;
        const {workHeightPen} = getState().persistentData
        const { isLockScale } = getState().writeAndDraw
        if (!selected) {
            return {type: '@@arm-studio/NOOP'};
        }
        selected.updateTransformation(key, value, preview, workHeightPen, isLockScale);
        dispatch(actions.transformationChanged({
            transformation: _.cloneDeep(selected.settings.transformation),
        }));
    },
    updateConfig: (key, value) => (dispatch, getState) => {
        const selected = getState().writeAndDraw.model;
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
        const selected = getState().writeAndDraw.model;
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
        const selected = getState().writeAndDraw.model;
        if (!selected) {
            return {type: '@@arm-studio/NOOP'};
        }
        selected.updateWorkingParameters(key, value);
        dispatch(actions.workingParametersChanged({
            workingParameters: _.cloneDeep(selected.settings.working_parameters),
        }));
    },
    updateWriteAndDrawParameters: (key, value) => (dispatch, getState) => {
        const write_and_draw = getState().writeAndDraw.write_and_draw;
        write_and_draw[key].default_value = value;
        dispatch(actions.writeAndDrawParametersChanged({writeAndDraw: _.cloneDeep(write_and_draw)}));
    },
    generateGcode: (write_and_draw) => (dispatch, getState) => {
        const { advance } = getState().persistentData
        const gcodeArr = [];
        const models = [];
        for (let i = 0; i < rendererParent.children.length; i++) {
            const model = rendererParent.children[i];
            models.push(model);
            gcodeArr.push(model.generateGcode(write_and_draw, advance));
        }
        const gcode = gcodeArr.join("\n");

        // Where each model sits in the assembled job, and how its toolpath lines map onto gcode lines. The
        // canvas needs both to paint the plotted part: `sent` counts from the top of the job, and a model
        // only knows its own lines.
        const ranges = modelLineRanges(gcodeArr);
        ranges.forEach((range, i) => {
            models[i].setPlotLineMap({
                ...range,
                execOrdinal: execOrdinalOfToolPathLine(gcodeArr[i]),
            });
        });
        dispatch(plotProgressActions.started(executableLines(gcode).length, ranges));

        // How long the machine will take to draw what was just generated: every model's inked length at the work
        // speed plus its travelling length at the jog speed. Returned as well as stored so the button that
        // triggered this can say it in its own message without waiting for a re-render.
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
    modelSelected: ({model, transformation, config, workingParameters}) => ({
        type: ACTION_MODEL_SELECTED, model, transformation, config, workingParameters,
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
    writeAndDrawParametersChanged: ({writeAndDraw}) => ({
        type: ACTION_WRITE_AND_DRAW_PARAMETERS_CHANGED, writeAndDraw,
    }),
    gcodeGenerated: ({gcode, estimate}) => ({type: ACTION_GCODE_GENERATED, gcode, estimate}),
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
        case ACTION_WRITE_AND_DRAW_PARAMETERS_CHANGED:
            return {...state, write_and_draw: action.writeAndDraw};
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
