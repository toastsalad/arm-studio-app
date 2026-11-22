import {describe, expect, it, vi} from 'vitest';

// The reducers are the only thing under test; everything the thunks reach for
// (models, uploads, text rendering, i18n) is mocked so importing the module does
// not pull in three.js or the DOM.
vi.mock('../src/containers/writeAndDraw/lib/Model2D', () => ({default: class {}}));
vi.mock('../src/containers/laser/lib/Model2D', () => ({default: class {}}));
vi.mock('../src/api', () => ({uploadImage: vi.fn(), uploadFile: vi.fn()}));
vi.mock('../src/containers/_2d/lib/toolPathUtils', () => ({computeBoundary: vi.fn()}));
vi.mock('../src/containers/_2d/lib/textFile', () => ({textFile: vi.fn()}));
vi.mock('../src/utils/messageI18n', () => ({default: {success: vi.fn(), warning: vi.fn()}}));

import writeAndDraw, {actions as writeAndDrawActions} from '../src/reducers/writeAndDraw';
import laser, {actions as laserActions} from '../src/reducers/laser';

const initial = (reducer) => reducer(undefined, {type: '@@INIT'});
const apply = (state, reducer, ...steps) => steps.reduce(reducer, state);

const cases = [
    ['writeAndDraw', writeAndDraw, writeAndDrawActions],
    ['laser', laser, laserActions],
];

describe.each(cases)('%s reducer', (_name, reducer, actions) => {
    it('adopts a new drawing and drops the previous preview', () => {
        const loaded = apply(initial(reducer), reducer,
            actions.gcodeGenerated({gcode: 'G1 X0'}),
            actions.previewStateChanged({isAllPreviewed: true}));

        const state = apply(loaded, reducer, actions.modelAdded({
            model: {id: 1},
            transformation: {x: 1},
            config: {depth: 2},
            workingParameters: {speed: 3},
            configText: {children: []},
            modelCount: 1,
        }));

        expect(state).toMatchObject({
            model: {id: 1},
            transformation: {x: 1},
            config: {depth: 2},
            working_parameters: {speed: 3},
            config_text: {children: []},
            modelCount: 1,
        });
        // The old drawing's preview g-code no longer describes this one.
        expect(state.gcode).toBeNull();
        expect(state.isAllPreviewed).toBe(false);
    });

    it('clears everything derived from a removed drawing', () => {
        const loaded = apply(initial(reducer), reducer,
            actions.modelAdded({
                model: {id: 1},
                transformation: {x: 1},
                config: {depth: 2},
                workingParameters: {speed: 3},
                configText: {children: []},
                modelCount: 1,
            }),
            actions.gcodeGenerated({gcode: 'G1 X0'}));

        const state = apply(loaded, reducer, actions.modelRemoved({modelCount: 0}));

        expect(state).toMatchObject({
            model: null,
            transformation: null,
            config: null,
            config_text: null,
            working_parameters: null,
            modelCount: 0,
            gcode: null,
        });
    });

    it('invalidates the preview g-code when the drawing moves', () => {
        const loaded = apply(initial(reducer), reducer, actions.gcodeGenerated({gcode: 'G1 X0'}));

        const state = apply(loaded, reducer, actions.transformationChanged({transformation: {x: 9}}));

        expect(state.transformation).toEqual({x: 9});
        expect(state.gcode).toBeNull();
    });

    it('invalidates the preview g-code when the config changes', () => {
        const loaded = apply(initial(reducer), reducer, actions.gcodeGenerated({gcode: 'G1 X0'}));

        const state = apply(loaded, reducer, actions.configChanged({config: {depth: 5}}));

        expect(state.config).toEqual({depth: 5});
        expect(state.gcode).toBeNull();
    });

    it('toggles the scale lock', () => {
        const state = apply(initial(reducer), reducer, actions.isLockScaleToggled());

        expect(state.isLockScale).toBe(false);
    });
});

describe('writeAndDraw reducer', () => {
    it('keeps the drawing-specific settings parameters apart from the shared ones', () => {
        const state = apply(initial(writeAndDraw), writeAndDraw,
            writeAndDrawActions.writeAndDrawParametersChanged({writeAndDraw: {pen: {default_value: 1}}}));

        expect(state.write_and_draw).toEqual({pen: {default_value: 1}});
        expect(state.config).toBeNull();
    });
});
