import {beforeEach, describe, expect, it} from 'vitest';
import Model2DBase from '../src/containers/_2d/lib/Model2DBase';
import {TRAVEL_COLOR} from '../src/containers/_2d/lib/toolPathRenderer';
import {execOrdinalOfToolPathLine} from '../src/utils/plotProgress.js';

// The plotted part of a drawing turning red (and the travel already crossed turning grey), through the model
// rather than through a helper: the model owns the overlay, and an overlay that is never given a draw range is
// exactly the failure that would look like "the feature does nothing".

// M3, draw, draw, M5, pen-up move, M3, draw, draw - one toolpath line each.
const TOOL_PATH = [
    {M: 3},
    {G: 1, X: 0, Y: 0},
    {G: 1, X: 10, Y: 0},
    {M: 5},
    {G: 1, X: 40, Y: 30},
    {M: 3},
    {G: 1, X: 50, Y: 30},
    {G: 1, X: 50, Y: 40},
];

// This gcode is one line per toolpath line, which is what the emitter produces.
const GCODE = 'G1 Z0\nG1 X0 Y0\nG1 X10 Y0\nG0 Z2\nG1 X40 Y30\nG1 Z0\nG1 X50 Y30\nG1 X50 Y40\n';

const store = new Map();
const stubMessaging = {addServerListener: () => ({}), removeServerListener: () => {}};

beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
    };
    globalThis.document = {documentElement: {}};
    globalThis.getComputedStyle = () => ({getPropertyValue: () => '#3b6ea5'});
});

const makeModel = () => {
    const model = new Model2DBase('svg', {
        previewEvent: 'preview',
        frontEnd: 'PEN',
        trackPreviewing: false,
        travelColor: TRAVEL_COLOR,
        messaging: stubMessaging,
        createSettings: () => ({}),
    });
    model.travelVisible = true;      // so the travel overlay exists to be greyed
    model.loadToolPath(TOOL_PATH);
    model.setPlotLineMap({startLine: 0, lineCount: 8, execOrdinal: execOrdinalOfToolPathLine(GCODE)});
    return model;
};

const overlayOf = (model, index = 0) =>
    (model._plotOverlays || [])[index];

const drawnOf = (model, index = 0) => {
    const overlay = overlayOf(model, index);
    return overlay ? overlay.geometry.drawRange.count : null;
};

describe('plot progress', () => {
    it('paints nothing before the job starts', () => {
        const model = makeModel();
        model.setPlotProgress(0);
        expect(overlayOf(model)).toBeDefined();
        expect(drawnOf(model)).toBe(0);
    });

    it('grows the red with the lines sent', () => {
        const model = makeModel();
        model.setPlotProgress(3);
        const atThree = drawnOf(model);
        expect(atThree).toBeGreaterThan(0);
        model.setPlotProgress(8);
        expect(drawnOf(model)).toBeGreaterThan(atThree);
    });

    it('covers the whole drawing when the job is done', () => {
        const model = makeModel();
        model.setPlotProgress(8);
        const overlay = overlayOf(model);
        const segments = overlay.geometry.getAttribute('position').count / 2;
        expect(overlay.geometry.drawRange.count).toBe(segments * 2);
    });

    it('greys only the travel that has been crossed', () => {
        const model = makeModel();
        // Line 4 is the only pen-up move (the G0 Z2 is line 3, the move itself is line 4).
        model.setPlotProgress(3);
        expect(drawnOf(model, 1)).toBe(0);
        model.setPlotProgress(5);
        expect(drawnOf(model, 1)).toBeGreaterThan(0);
    });

    it('clears back to nothing, which is what a new job and Clear do', () => {
        const model = makeModel();
        model.setPlotProgress(8);
        expect(drawnOf(model)).toBeGreaterThan(0);
        model.clearPlotProgress();
        expect(drawnOf(model)).toBe(0);
    });

    it('says nothing about a model the job has not reached', () => {
        const model = makeModel();
        // The second drawing in a job: the first five lines belong to someone else.
        model.setPlotLineMap({startLine: 100, lineCount: 8, execOrdinal: execOrdinalOfToolPathLine(GCODE)});
        model.setPlotProgress(50);
        expect(drawnOf(model)).toBe(0);
    });

    it('does not paint a model with no line map', () => {
        const model = makeModel();
        model.setPlotLineMap({startLine: 0, lineCount: 8, execOrdinal: null});
        model.setPlotProgress(8);
        expect(drawnOf(model)).toBe(0);
    });
});
