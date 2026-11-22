import * as THREE from 'three';
import _ from 'lodash';
import Model3D from "../containers/p3d/lib/Model3D";
import ModelExporter from "../containers/p3d/lib/ModelExporter";
import {uploadFile} from "../api";
import {getUuid} from "../utils";
import socketClientManager from "../socket/socketClientManager";
import {P3D_SLICE_START, P3D_SLICE_STATUS} from "../constants";
import notificationI18n from "../utils/notificationI18n";
import gcodeBufferGeometryToObj3d from "../containers/p3d/lib/GcodeToBufferGeometry/gcodeBufferGeometryToObj3d";

const ACTION_MODEL_LOADED = 'p3dModel/modelLoaded';
const ACTION_LOAD_PROGRESS = 'p3dModel/loadProgress';
const ACTION_LOAD_FAILED = 'p3dModel/loadFailed';
const ACTION_MODEL_SELECTED = 'p3dModel/modelSelected';
const ACTION_MODEL_REMOVED = 'p3dModel/modelRemoved';
const ACTION_MODELS_REMOVED = 'p3dModel/modelsRemoved';
const ACTION_MODEL_DUPLICATED = 'p3dModel/modelDuplicated';
const ACTION_LAY_FLAT_APPLIED = 'p3dModel/layFlatApplied';
const ACTION_TRANSFORMATION_CHANGED = 'p3dModel/transformationChanged';
const ACTION_SLICE_STARTED = 'p3dModel/sliceStarted';
const ACTION_SLICE_PROGRESS = 'p3dModel/sliceProgress';
const ACTION_SLICE_FAILED = 'p3dModel/sliceFailed';
const ACTION_SLICE_COMPLETED = 'p3dModel/sliceCompleted';
const ACTION_PREVIEW_STARTED = 'p3dModel/previewStarted';
const ACTION_PREVIEW_PROGRESS = 'p3dModel/previewProgress';
const ACTION_PREVIEW_FAILED = 'p3dModel/previewFailed';
const ACTION_PREVIEW_READY = 'p3dModel/previewReady';
const ACTION_LAYER_COUNT_VISIBLE_CHANGED = 'p3dModel/layerCountVisibleChanged';
const ACTION_LINE_TYPE_VISIBILITY_CHANGED = 'p3dModel/lineTypeVisibilityChanged';
const ACTION_IS_UNIFORM_SCALING_TOGGLED = 'p3dModel/isUniformScalingToggled';

const INITIAL_STATE = {
    model: null,
    modelCount: 0,
    transformation: null,
    gcodeObj3d: null,
    result: null, // slice result
    layerCount: 0,
    layerCountVisible: 0,
    lineTypeVisibility: null,
    bounds: null,
    progress: 0,
    progressTitle: "",
    slicing: false,
    isUniformScaling: true
};

// Created on first use: a Worker at module scope makes the reducer impossible to
// import outside a browser (and so impossible to test).
let gcodeRenderingWorker = null;
const getGcodeRenderingWorker = () => {
    if (!gcodeRenderingWorker) {
        gcodeRenderingWorker = new Worker(new URL('../containers/p3d/lib/GcodeToBufferGeometry.worker.js', import.meta.url));
    }
    return gcodeRenderingWorker;
};

let rendererParent4model = null;
let rendererParent4gcode = null;

const _computeAvailableXZ = (modelParent, model) => {
    const _isBox3IntersectOthers = (box3, box3Arr) => {
        for (const otherBox3 of box3Arr) {
            if (box3.intersectsBox(otherBox3)) {
                return true;
            }
        }
        return false;
    };

    const _getPositionBetween = (from, to, step) => {
        const positions = [];
        if (from.x !== to.x) {
            const z = from.z;
            const minX = Math.min(from.x, to.x) + step;
            const maxX = Math.max(from.x, to.x);
            for (let x = minX; x < maxX; x += step) {
                positions.push(new THREE.Vector3(x, 1, z));
            }
        } else if (from.z !== to.z) {
            const x = from.x;
            const minZ = Math.min(from.z, to.z) + step;
            const maxZ = Math.max(from.z, to.z);
            for (let z = minZ; z < maxZ; z += step) {
                positions.push(new THREE.Vector3(x, 1, z));
            }
        }
        return positions;
    };

    const _getCheckPositions = (first, second, third, fourth, step) => {
        const arr1 = _getPositionBetween(first, second, step);
        const arr2 = _getPositionBetween(second, third, step);
        const arr3 = _getPositionBetween(third, fourth, step);
        const arr4 = _getPositionBetween(fourth, first, step);
        return [first].concat(arr1, [second], arr2, [third], arr3, arr4, [fourth]);
    };

    if (modelParent.children.length === 0) {
        return {x: 0, z: -300/* default z */};
    }
    model.computeBoundingBox();
    const modelBox3 = model.boundingBox;
    const box3Arr = [];
    for (const other of modelParent.children) {
        other.computeBoundingBox();
        box3Arr.push(other.boundingBox);
    }

    const extent = 40;
    const step = 10; // minimum distance between models
    const y = 1;
    for (let stepCount = 1; stepCount < extent / step; stepCount++) {
        // the 4 positions on the x and z axes first
        const positionsOnAxis = [
            new THREE.Vector3(0, y, stepCount * step),
            new THREE.Vector3(0, y, -stepCount * step),
            new THREE.Vector3(stepCount * step, y, 0),
            new THREE.Vector3(-stepCount * step, y, 0)
        ];
        const corner1 = new THREE.Vector3(stepCount * step, y, stepCount * step);
        const corner2 = new THREE.Vector3(stepCount * step, y, -stepCount * step);
        const corner3 = new THREE.Vector3(-stepCount * step, y, -stepCount * step);
        const corner4 = new THREE.Vector3(-stepCount * step, y, stepCount * step);
        const positionsOnSquare = _getCheckPositions(corner1, corner2, corner3, corner4, step);
        const checkPositions = [].concat(positionsOnAxis);
        for (const item of positionsOnSquare) {
            if (!(item.x === 0 || item.z === 0)) {
                checkPositions.push(item);
            }
        }
        for (const position of checkPositions) {
            const modelBox3Clone = modelBox3.clone();
            modelBox3Clone.translate(new THREE.Vector3(position.x, 0, position.z));
            if (!_isBox3IntersectOthers(modelBox3Clone, box3Arr)) {
                return {x: position.x, z: position.z - 300/* default z */};
            }
        }
    }
    return {x: 0, z: 0};
};

const actions = {
    setRendererParent4model: (object3d) => {
        rendererParent4model = object3d;
        return {type: '@@arm-studio/NOOP'};
    },
    setRendererParent4gcode: (object3d) => {
        rendererParent4gcode = object3d;
        return {type: '@@arm-studio/NOOP'};
    },
    loadModel: (url) => (dispatch, getState) => {
        const worker = new Worker(new URL('../containers/p3d/lib/File3dToBufferGeometry.worker.js', import.meta.url));
        // A throw inside the worker leaves onmessage silent; terminate it so the
        // next load starts from a clean worker.
        worker.onerror = (err) => {
            console.error('load model worker error:', err);
            worker.terminate();
            dispatch(actions.loadFailed());
        };
        worker.postMessage({url});
        worker.onmessage = (event) => {
            const data = event.data;
            const {status, value} = data;
            switch (status) {
                case 'succeed': {
                    worker.terminate();
                    destroyGcodeObj3d();

                    const {modelPositions, modelConvexPositions} = value;

                    const bufferGeometry = new THREE.BufferGeometry();
                    const convexBufferGeometry = new THREE.BufferGeometry();

                    const modelPositionAttribute = new THREE.BufferAttribute(modelPositions, 3);
                    const modelConvexPositionAttribute = new THREE.BufferAttribute(modelConvexPositions, 3);

                    bufferGeometry.setAttribute('position', modelPositionAttribute);
                    bufferGeometry.computeVertexNormals();
                    convexBufferGeometry.setAttribute('position', modelConvexPositionAttribute);
                    const model = new Model3D(bufferGeometry, convexBufferGeometry, url, url);
                    model.computeBoundingBox()
                    const xz = _computeAvailableXZ(rendererParent4model, model);
                    model.position.x = xz.x;
                    model.position.z = xz.z /*- 300*/;
                    model.transformation.x = model.position.x;
                    model.transformation.y = -model.position.z;
                    rendererParent4model.add(model);

                    const { boundingBox } = model;

                    model.transformation.ogScaleWidth = Number(Number.parseFloat(boundingBox.max.x - boundingBox.min.x).toFixed(2)),
                    model.transformation.ogScaleHeight = Number(Number.parseFloat(boundingBox.max.z - boundingBox.min.z).toFixed(2)),
                    model.transformation.ogScaleDepth = Number(Number.parseFloat(boundingBox.max.y - boundingBox.min.y).toFixed(2))

                    model.transformation.scaleWidth = Number(Number.parseFloat(boundingBox.max.x - boundingBox.min.x).toFixed(2)),
                    model.transformation.scaleHeight = Number(Number.parseFloat(boundingBox.max.z - boundingBox.min.z).toFixed(2)),
                    model.transformation.scaleDepth = Number(Number.parseFloat(boundingBox.max.y - boundingBox.min.y).toFixed(2))

                    model.transformation.isUniformScaling = true

                    for (const child of rendererParent4model.children) {
                        child.setSelected(false);
                        child.setMode('prepare');
                    }
                    model.setSelected(true);

                    const transformation = model.transformation;
                    const modelCount = rendererParent4model.children.length;


                    dispatch(actions.modelLoaded({
                        model,
                        modelCount,
                        transformation,
                    }));
                    break;
                }
                case 'progress':
                    dispatch(actions.loadProgress({progress: value}));
                    break;
                case 'err':
                    worker.terminate();
                    console.error(value);
                    dispatch(actions.loadFailed());
                    break;
                default:
                    break;
            }
        };
    },
    selectModel: (model) => (dispatch, getState) => {
        for (const child of rendererParent4model.children) {
            child.setSelected(false);
        }
        model.setSelected(true);
        const transformation = model.transformation;
        dispatch(actions.modelSelected({
            model,
            transformation
        }));
    },
    removeSelected: () => (dispatch, getState) => {
        destroyGcodeObj3d();
        const {model} = getState().p3dModel;
        if (model) model.dispose();
        rendererParent4model.remove(model);
        const modelCount = rendererParent4model.children.length;
        dispatch(actions.modelRemoved({modelCount}));
    },
    removeAll: () => (dispatch, getState) => {
        destroyGcodeObj3d();
        rendererParent4model.children.slice().forEach((child) => child.dispose());
        rendererParent4model.remove(...rendererParent4model.children);
        dispatch(actions.modelsRemoved());
    },
    duplicateSelected: () => (dispatch, getState) => {
        destroyGcodeObj3d();
        const {model} = getState().p3dModel;
        const newModel = model.clone();
        newModel.position.x = 0;
        newModel.position.z = -300;
        const xz = _computeAvailableXZ(rendererParent4model, newModel);
        newModel.position.x = xz.x;
        newModel.position.z = xz.z;
        newModel.transformation.x = newModel.position.x;
        newModel.transformation.y = -newModel.position.z;

        rendererParent4model.add(newModel);

        for (const child of rendererParent4model.children) {
            child.setMode('prepare');
        }
        const modelCount = rendererParent4model.children.length;
        dispatch(actions.modelDuplicated({modelCount}));
    },
    undo: () => {
        return {type: '@@arm-studio/NOOP'};
    },
    redo: () => {
        return {type: '@@arm-studio/NOOP'};
    },
    layFlat: () => (dispatch, getState) => {
        destroyGcodeObj3d();
        const {model} = getState().p3dModel;
        model.layFlat();
        const transformation = _.cloneDeep(model.transformation);
        for (const child of rendererParent4model.children) {
            child.setMode('prepare');
        }
        dispatch(actions.layFlatApplied({transformation}));
    },
    updateTransformation: (key, value) => (dispatch, getState) => {
        destroyGcodeObj3d();
        const {model} = getState().p3dModel;
        model.updateTransformation(key, value);
        for (const child of rendererParent4model.children) {
            child.setMode('prepare');
        }
        const transformation = _.cloneDeep(model.transformation);
        dispatch(actions.transformationChanged({transformation}));
    },
    afterUpdateTransformation: (key, value) => (dispatch, getState) => {
        destroyGcodeObj3d();
        const {model} = getState().p3dModel;
        model.updateTransformation(key, value);
        model.stickToPlate();
        for (const child of rendererParent4model.children) {
            child.setMode('prepare');
        }
        const transformation = _.cloneDeep(model.transformation);
        dispatch(actions.transformationChanged({transformation}));
    },
    startSlice: () => async (dispatch, getState) => {
        destroyGcodeObj3d();

        dispatch(actions.sliceStarted());

        let stlUrl;
        try {
            const file = exportModelsToFile();
            const response = await uploadFile(file);
            stlUrl = response.url;
        } catch (e) {
            console.error('failed to upload model for slicing:', e);
            dispatch(actions.sliceFailed());
            return;
        }

        dispatch(actions.sliceProgress({progress: 0}));

        const materialSettingFilename = getState().p3dMaterialSettings.selected.filename;
        const printSettingFilename = getState().p3dPrintSettings.selected.filename;
        const id = getUuid();
        socketClientManager.removeAllServerListener(P3D_SLICE_STATUS);
        socketClientManager.addServerListener(P3D_SLICE_STATUS, (data) => {
            if (data.id !== id) {
                return;
            }
            const {progress, result} = data;
            // the server reports failures as `err`
            const error = data.error || data.err;
            if (error) {
                console.error("slice error:", error);
                notificationI18n.error({
                    message: "Slicing failed",
                    description: String(error),
                    duration: 8
                });
                dispatch(actions.sliceFailed());
            } else if (progress) {
                dispatch(actions.sliceProgress({progress}));
            } else if (result) {
                //result: {gcodeName, printTime, filamentLength, filamentWeight, gcodePath}
                const gcodeUrl = window.serverCacheAddress + result.gcodeName;
                result.gcodeUrl = gcodeUrl;
                dispatch(actions.sliceCompleted({result}));
                dispatch(actions._renderGcode(gcodeUrl));
            }
        });

        socketClientManager.emitToServer(P3D_SLICE_START, {stlUrl, materialSettingFilename, printSettingFilename, id})
    },
    _renderGcode: (gcodeUrl) => (dispatch) => {
        dispatch(actions.previewStarted());

        const worker = getGcodeRenderingWorker();
        worker.onerror = (err) => {
            console.error('g-code preview worker error:', err);
            dispatch(actions.previewFailed());
        };
        worker.postMessage({fileUrl: gcodeUrl});
        worker.onmessage = (event) => {
            const data = event.data;
            const {status, value} = data;
            switch (status) {
                case 'succeed': {
                    const {positions, colors, layerIndices, typeCodes, layerCount, bounds} = value;
                    const bufferGeometry = new THREE.BufferGeometry();
                    const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
                    const colorAttribute = new THREE.Uint8BufferAttribute(colors, 3);
                    // this will map the buffer values to 0.0f - +1.0f in the shader
                    colorAttribute.normalized = true;
                    const layerIndexAttribute = new THREE.Float32BufferAttribute(layerIndices, 1);
                    const typeCodeAttribute = new THREE.Float32BufferAttribute(typeCodes, 1);

                    bufferGeometry.setAttribute('position', positionAttribute);
                    bufferGeometry.setAttribute('a_color', colorAttribute);
                    bufferGeometry.setAttribute('a_layer_index', layerIndexAttribute);
                    bufferGeometry.setAttribute('a_type_code', typeCodeAttribute);

                    const gcodeObj3d = gcodeBufferGeometryToObj3d(bufferGeometry);

                    const layerCountVisible = layerCount;
                    gcodeObj3d.material.uniforms.u_visible_layer_count.value = layerCountVisible;

                    addGcodeObj3d(gcodeObj3d)

                    const lineTypeVisibility = {
                        'WALL-INNER': {
                            rgb: [0, 255, 0],
                            visible: true
                        },
                        'WALL-OUTER': {
                            rgb: [255, 33, 33],
                            visible: true
                        },
                        'SKIN': {
                            rgb: [255, 255, 0],
                            visible: true
                        },
                        'SKIRT': {
                            rgb: [250, 140, 53],
                            visible: true
                        },
                        'SUPPORT': {
                            rgb: [75, 0, 130],
                            visible: true
                        },
                        'FILL': {
                            rgb: [141, 75, 187],
                            visible: true
                        },
                        'TRAVEL': {
                            rgb: [68, 206, 246],
                            visible: false
                        },
                        'UNKNOWN': {
                            rgb: [75, 0, 130],
                            visible: true
                        }
                    };

                    for (const child of rendererParent4model.children) {
                        child.setMode('preview');
                    }

                    dispatch(actions.previewReady({
                        gcodeObj3d,
                        layerCount,
                        bounds,
                        lineTypeVisibility,
                    }));
                    break;
                }
                case 'progress': {
                    dispatch(actions.previewProgress({progress: value}));
                    break;
                }
                case 'err': {
                    console.error("g-code preview error:", value);
                    notificationI18n.error({
                        message: "G-code preview failed",
                        description: String(value),
                        duration: 8
                    });
                    dispatch(actions.previewFailed());
                    break;
                }
            }
        };
    },
    setLayerCountVisible: (value) => (dispatch, getState) => {
        const {gcodeObj3d} = getState().p3dModel;
        gcodeObj3d.material.uniforms.u_visible_layer_count.value = value;
        dispatch(actions.layerCountVisibleChanged({value}));
    },
    updateLineTypeVisibility: (key, value) => (dispatch, getState) => {
        const visibility = _.cloneDeep(getState().p3dModel.lineTypeVisibility);
        visibility[key].visible = value;

        const {gcodeObj3d} = getState().p3dModel;
        const uniforms = gcodeObj3d.material.uniforms;
        uniforms.u_wall_inner_visible.value = visibility['WALL-INNER'].visible ? 1 : 0;
        uniforms.u_wall_outer_visible.value = visibility['WALL-OUTER'].visible ? 1 : 0;
        uniforms.u_skin_visible.value = visibility['SKIN'].visible ? 1 : 0;
        uniforms.u_skirt_visible.value = visibility['SKIRT'].visible ? 1 : 0;
        uniforms.u_support_visible.value = visibility['SUPPORT'].visible ? 1 : 0;
        uniforms.u_fill_visible.value = visibility['FILL'].visible ? 1 : 0;
        uniforms.u_travel_visible.value = visibility['TRAVEL'].visible ? 1 : 0;
        uniforms.u_unknown_visible.value = visibility['UNKNOWN'].visible ? 1 : 0;

        dispatch(actions.lineTypeVisibilityChanged({visibility}));
    },

    toggleIsUniformScaling: () => (dispatch) => {
        dispatch(actions.isUniformScalingToggled());
    },

    // Named actions: one per rule. A slice/preview lifecycle and "a new model drops
    // the old preview" used to be field bundles repeated at every call site.
    modelLoaded: ({model, modelCount, transformation}) => ({
        type: ACTION_MODEL_LOADED, model, modelCount, transformation,
    }),
    loadProgress: ({progress}) => ({type: ACTION_LOAD_PROGRESS, progress}),
    loadFailed: () => ({type: ACTION_LOAD_FAILED}),
    modelSelected: ({model, transformation}) => ({type: ACTION_MODEL_SELECTED, model, transformation}),
    modelRemoved: ({modelCount}) => ({type: ACTION_MODEL_REMOVED, modelCount}),
    modelsRemoved: () => ({type: ACTION_MODELS_REMOVED}),
    modelDuplicated: ({modelCount}) => ({type: ACTION_MODEL_DUPLICATED, modelCount}),
    layFlatApplied: ({transformation}) => ({type: ACTION_LAY_FLAT_APPLIED, transformation}),
    transformationChanged: ({transformation}) => ({type: ACTION_TRANSFORMATION_CHANGED, transformation}),
    sliceStarted: () => ({type: ACTION_SLICE_STARTED}),
    sliceProgress: ({progress}) => ({type: ACTION_SLICE_PROGRESS, progress}),
    sliceFailed: () => ({type: ACTION_SLICE_FAILED}),
    sliceCompleted: ({result}) => ({type: ACTION_SLICE_COMPLETED, result}),
    previewStarted: () => ({type: ACTION_PREVIEW_STARTED}),
    previewProgress: ({progress}) => ({type: ACTION_PREVIEW_PROGRESS, progress}),
    previewFailed: () => ({type: ACTION_PREVIEW_FAILED}),
    previewReady: ({gcodeObj3d, layerCount, bounds, lineTypeVisibility}) => ({
        type: ACTION_PREVIEW_READY, gcodeObj3d, layerCount, bounds, lineTypeVisibility,
    }),
    layerCountVisibleChanged: ({value}) => ({type: ACTION_LAYER_COUNT_VISIBLE_CHANGED, value}),
    lineTypeVisibilityChanged: ({visibility}) => ({type: ACTION_LINE_TYPE_VISIBILITY_CHANGED, visibility}),
    isUniformScalingToggled: () => ({type: ACTION_IS_UNIFORM_SCALING_TOGGLED}),
};

const destroyGcodeObj3d = () => {
    for (const child of rendererParent4gcode.children) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }
    rendererParent4gcode.remove(...rendererParent4gcode.children);
};

const addGcodeObj3d = (object3d) => {
    destroyGcodeObj3d();
    rendererParent4gcode.add(object3d);
};

const exportModelsToFile = () => {
    const blob = exportModelsToBlob();
    const fileName = "output.stl";
    const file = new File([blob], fileName);
    return file;
};

const exportModelsToBlob = () => {
    // Models have to sit on the plate before export: the slicer drops the leading
    // empty layers, so a model floating above the plate would come back as g-code
    // that no longer lines up with where the model is shown.
    for (const child of rendererParent4model.children) {
        if (typeof child.stickToPlate === 'function') {
            child.stickToPlate();
        }
    }
    rendererParent4model.updateMatrixWorld(true);
    const output = new ModelExporter().parseToBinaryStl(rendererParent4model);
    const blob = new Blob([output], {type: 'text/plain'});
    return blob;
};

// No slice preview to show: used whenever the model or the slice it belongs to
// changes shape. Keeps `slicing`/`progress` alone -- those describe an operation.
const withoutPreview = (state) => ({
    ...state,
    gcodeObj3d: null,
    result: null,
    layerCount: 0,
    layerCountVisible: 0,
    lineTypeVisibility: null,
    bounds: null,
});

const reducer = (state = INITIAL_STATE, action) => {
    switch (action.type) {
        case ACTION_MODEL_LOADED:
            return {
                ...withoutPreview(state),
                model: action.model,
                modelCount: action.modelCount,
                transformation: action.transformation,
                progress: 1,
                progressTitle: '',
            };
        case ACTION_LOAD_PROGRESS:
            return {...state, progress: action.progress, progressTitle: 'Loading model'};
        case ACTION_LOAD_FAILED:
            return {...state, progress: 0, progressTitle: 'Failed to load model'};
        case ACTION_MODEL_SELECTED:
            return {...state, model: action.model, transformation: action.transformation};
        case ACTION_MODEL_REMOVED:
            return {
                ...withoutPreview(state),
                model: null,
                modelCount: action.modelCount,
                transformation: null,
            };
        case ACTION_MODELS_REMOVED:
            return {
                ...withoutPreview(state),
                model: null,
                modelCount: 0,
                transformation: null,
            };
        case ACTION_MODEL_DUPLICATED:
            // The duplicate becomes a sibling; the selected model is unchanged.
            return {...withoutPreview(state), modelCount: action.modelCount};
        case ACTION_LAY_FLAT_APPLIED:
            return {...withoutPreview(state), transformation: action.transformation};
        case ACTION_TRANSFORMATION_CHANGED:
            // Moving the model invalidates the slice preview, but the slice result it
            // came from (and its layer data) is left alone -- unchanged behaviour.
            return {...state, transformation: action.transformation, gcodeObj3d: null, result: null};
        case ACTION_SLICE_STARTED:
            return {...state, gcodeObj3d: null, slicing: true};
        case ACTION_SLICE_PROGRESS:
            return {...state, progress: action.progress, progressTitle: 'Slicing', result: null};
        case ACTION_SLICE_FAILED:
            return {...state, progress: 0, progressTitle: 'Slicing failed', slicing: false};
        case ACTION_SLICE_COMPLETED:
            return {...state, progress: 1, progressTitle: 'Slicing complete', result: action.result};
        case ACTION_PREVIEW_STARTED:
            return {...state, progress: 0, progressTitle: 'Rendering preview'};
        case ACTION_PREVIEW_PROGRESS:
            return {...state, progress: action.progress, progressTitle: 'Rendering preview'};
        case ACTION_PREVIEW_FAILED:
            return {...state, progress: 0, progressTitle: 'Preview failed', slicing: false};
        case ACTION_PREVIEW_READY:
            return {
                ...state,
                gcodeObj3d: action.gcodeObj3d,
                layerCount: action.layerCount,
                layerCountVisible: action.layerCount,
                bounds: action.bounds,
                lineTypeVisibility: action.lineTypeVisibility,
                progress: 1,
                progressTitle: 'Slicing complete',
                slicing: false,
            };
        case ACTION_LAYER_COUNT_VISIBLE_CHANGED:
            return {...state, layerCountVisible: action.value};
        case ACTION_LINE_TYPE_VISIBILITY_CHANGED:
            return {...state, lineTypeVisibility: action.visibility};
        case ACTION_IS_UNIFORM_SCALING_TOGGLED:
            return {...state, isUniformScaling: !state.isUniformScaling};
        default:
            return state;
    }
};

export {actions, exportModelsToFile, exportModelsToBlob};
export default reducer;
