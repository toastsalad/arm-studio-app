import {describe, expect, it, vi} from 'vitest';

// The reducer is what is under test; the three.js scene objects, the workers and
// the socket are only touched by the thunks.
vi.mock('../src/containers/p3d/lib/Model3D', () => ({default: class {}}));
vi.mock('../src/containers/p3d/lib/ModelExporter', () => ({default: class {}}));
vi.mock('../src/containers/p3d/lib/GcodeToBufferGeometry/gcodeBufferGeometryToObj3d', () => ({default: vi.fn()}));
vi.mock('../src/api', () => ({uploadImage: vi.fn(), uploadFile: vi.fn()}));
vi.mock('../src/utils', () => ({getUuid: () => 'job-1'}));
vi.mock('../src/socket/socketClientManager', () => ({
    default: {addServerListener: vi.fn(), removeAllServerListener: vi.fn(), emitToServer: vi.fn()},
}));
vi.mock('../src/utils/notificationI18n', () => ({default: {error: vi.fn(), success: vi.fn()}}));

import reducer, {actions} from '../src/reducers/p3dModel';

const initial = () => reducer(undefined, {type: '@@INIT'});
const apply = (state, ...steps) => steps.reduce(reducer, state);

describe('p3dModel reducer', () => {
    it('drops the previous preview when a model is loaded', () => {
        const sliced = apply(initial(),
            actions.sliceCompleted({result: {gcodeName: 'a.gcode'}}),
            actions.previewReady({gcodeObj3d: {id: 'old'}, layerCount: 7, bounds: {}, lineTypeVisibility: {}}));

        const state = apply(sliced, actions.modelLoaded({
            model: {id: 'm1'},
            modelCount: 1,
            transformation: {x: 0},
        }));

        expect(state).toMatchObject({
            model: {id: 'm1'},
            modelCount: 1,
            transformation: {x: 0},
            gcodeObj3d: null,
            result: null,
            layerCount: 0,
            layerCountVisible: 0,
            lineTypeVisibility: null,
            bounds: null,
            progress: 1,
            progressTitle: '',
        });
    });

    it('reports load failures without keeping the old progress', () => {
        const state = apply(initial(), actions.loadFailed());

        expect(state).toMatchObject({progress: 0, progressTitle: 'Failed to load model'});
    });

    it('marks the slice as running and drops the preview it replaces', () => {
        const previewed = apply(initial(),
            actions.previewReady({gcodeObj3d: {id: 'old'}, layerCount: 3, bounds: {}, lineTypeVisibility: {}}));

        const state = apply(previewed, actions.sliceStarted());

        expect(state.slicing).toBe(true);
        expect(state.gcodeObj3d).toBeNull();
    });

    it('labels slice progress and clears the previous result', () => {
        const state = apply(initial(),
            actions.sliceCompleted({result: {gcodeName: 'old.gcode'}}),
            actions.sliceProgress({progress: 0.4}));

        expect(state).toMatchObject({progress: 0.4, progressTitle: 'Slicing', result: null});
    });

    it('ends a failed slice', () => {
        const state = apply(initial(), actions.sliceStarted(), actions.sliceFailed());

        expect(state).toMatchObject({progress: 0, progressTitle: 'Slicing failed', slicing: false});
    });

    it('ends the slice when the preview is ready and shows every layer', () => {
        const state = apply(initial(),
            actions.sliceStarted(),
            actions.previewReady({
                gcodeObj3d: {id: 'g'},
                layerCount: 42,
                bounds: {min: 0},
                lineTypeVisibility: {'FILL': {visible: true}},
            }));

        expect(state).toMatchObject({
            gcodeObj3d: {id: 'g'},
            layerCount: 42,
            layerCountVisible: 42,
            bounds: {min: 0},
            lineTypeVisibility: {'FILL': {visible: true}},
            progress: 1,
            progressTitle: 'Slicing complete',
            slicing: false,
        });
    });

    it('shows a slice failure from the preview worker as a preview failure', () => {
        const state = apply(initial(), actions.sliceStarted(), actions.previewFailed());

        expect(state).toMatchObject({progress: 0, progressTitle: 'Preview failed', slicing: false});
    });

    it('drops the preview object when the model moves but keeps the slice result', () => {
        const previewed = apply(initial(),
            actions.sliceCompleted({result: {gcodeName: 'a.gcode'}}),
            actions.previewReady({gcodeObj3d: {id: 'g'}, layerCount: 9, bounds: {}, lineTypeVisibility: {}}));

        const state = apply(previewed, actions.transformationChanged({transformation: {x: 5}}));

        expect(state.transformation).toEqual({x: 5});
        expect(state.gcodeObj3d).toBeNull();
        expect(state.result).toBeNull();
        // Unchanged behaviour: the layer data from the previous slice is kept.
        expect(state.layerCount).toBe(9);
    });

    it('clears everything about the removed model', () => {
        const loaded = apply(initial(),
            actions.modelLoaded({model: {id: 'm1'}, modelCount: 1, transformation: {x: 1}}),
            actions.previewReady({gcodeObj3d: {id: 'g'}, layerCount: 2, bounds: {}, lineTypeVisibility: {}}));

        const state = apply(loaded, actions.modelRemoved({modelCount: 0}));

        expect(state).toMatchObject({
            model: null,
            transformation: null,
            modelCount: 0,
            gcodeObj3d: null,
            layerCount: 0,
            bounds: null,
        });
    });

    it('keeps the selected model when it is duplicated', () => {
        const loaded = apply(initial(),
            actions.modelLoaded({model: {id: 'm1'}, modelCount: 1, transformation: {x: 1}}));

        const state = apply(loaded, actions.modelDuplicated({modelCount: 2}));

        expect(state).toMatchObject({model: {id: 'm1'}, transformation: {x: 1}, modelCount: 2});
    });

    it('toggles uniform scaling and visibility independently', () => {
        const state = apply(initial(),
            actions.isUniformScalingToggled(),
            actions.layerCountVisibleChanged({value: 4}),
            actions.lineTypeVisibilityChanged({visibility: {'SKIN': {visible: false}}}));

        expect(state.isUniformScaling).toBe(false);
        expect(state.layerCountVisible).toBe(4);
        expect(state.lineTypeVisibility).toEqual({'SKIN': {visible: false}});
    });
});
