import {beforeEach, describe, expect, it} from 'vitest';
import toolPathRenderer, {applyTravelToModels, TRAVEL_OBJECT_NAME, TRAVEL_COLOR} from '../src/containers/_2d/lib/toolPathRenderer';
import Model2DBase from '../src/containers/_2d/lib/Model2DBase';
import reducer, {actions} from '../src/reducers/viewOptions';

// The toolbar's travel toggle, end to end: the model decides whether the pen-up moves are rendered at all, the
// canvas tells every model on it, and the choice survives a reload.
//
// An earlier version of this file tested a helper that hid an existing travel object by setting its visibility
// and opacity. That helper stopped being called when the toggle was changed to re-render with or without a travel
// colour -- the renderer builds the pen-up moves only when it is given one -- so the test went on passing while
// describing a mechanism nothing used. It would have passed with the feature deleted. These run the model.

// A toolpath with two strokes and one pen-up move between them: M3, draw, M5, travel, M3, draw.
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

const store = new Map();

// The model reads a CSS palette and subscribes to the preview event. Neither exists in a plain node test, so
// these are the two things that had to be supplied: a stub palette (refreshCanvasPalette's real job is reading
// theme.css) and a stub messaging channel in place of the app's socket singleton.
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

// The smallest model that can render a toolpath: the real class, with settings it does not need to read.
const makeModel = () => new Model2DBase('svg', {
    previewEvent: 'preview',
    frontEnd: 'PEN',
    trackPreviewing: false,
    travelColor: TRAVEL_COLOR,
    messaging: stubMessaging,
    createSettings: () => ({}),
});

// The toolpath group holds the drawing and, when they are shown, the pen-up moves.
const parts = (model) => (model.toolPathObj3d ? model.toolPathObj3d.children : []);
const names = (model) => parts(model).map((child) => child.name);
const travelOf = (model) => parts(model).find((child) => child.name === TRAVEL_OBJECT_NAME);

describe('travel lines', () => {
    it('draws the pen-up moves only when it is given a colour for them', () => {
        const withColour = toolPathRenderer.render(TOOL_PATH, TRAVEL_COLOR);
        expect(withColour.children.map((child) => child.name)).toContain(TRAVEL_OBJECT_NAME);

        const withoutColour = toolPathRenderer.render(TOOL_PATH, null);
        expect(withoutColour.children.map((child) => child.name)).not.toContain(TRAVEL_OBJECT_NAME);
        // The artwork is not affected either way.
        expect(withoutColour.children.map((child) => child.name)).toContain('drawing');
    });

    it('a drawing shows no pen-up moves until it is told to', () => {
        const model = makeModel();
        model.loadToolPath(TOOL_PATH);
        expect(names(model)).toContain('drawing');
        expect(travelOf(model)).toBeUndefined();
    });

    it('turning them on puts them in the scene, turning them off takes them out', () => {
        const model = makeModel();
        model.loadToolPath(TOOL_PATH);

        model.setTravelVisible(true);
        const travel = travelOf(model);
        expect(travel).toBeDefined();
        // The lines are really there, not an empty object: one segment, so six position values.
        expect(travel.geometry.attributes.position.count).toBeGreaterThan(0);
        // And the drawing did not go anywhere, which is what makes the toggle safe to press.
        expect(names(model)).toContain('drawing');

        model.setTravelVisible(false);
        expect(travelOf(model)).toBeUndefined();
        expect(names(model)).toContain('drawing');
        // Only one drawing object: the model rebuilds its toolpath rather than accumulating copies.
        expect(names(model).filter((name) => name === 'drawing')).toHaveLength(1);

        // And back again, because "show, hide, show" is what a person does.
        model.setTravelVisible(true);
        expect(travelOf(model)).toBeDefined();
    });

    it('has nothing to do when the flag has not changed', () => {
        const model = makeModel();
        model.loadToolPath(TOOL_PATH);
        const before = model.toolPathObj3d;
        model.setTravelVisible(false);   // already false
        expect(model.toolPathObj3d).toBe(before);
    });

    it('tells every drawing on the canvas, and only those that can be told', () => {
        const told = [];
        const models = [
            {setTravelVisible: (value) => told.push(['model', value])},
            {id: 'a plate or handle, with no opinion'},
            {setTravelVisible: (value) => told.push(['model', value])},
        ];

        expect(applyTravelToModels(models, true)).toBe(2);
        expect(told).toEqual([['model', true], ['model', true]]);

        // Anything that is not exactly true is false: the flag is a yes or no, and a stray undefined from a
        // store that has not been read yet should mean hidden rather than a coin toss.
        told.length = 0;
        applyTravelToModels(models, undefined);
        expect(told).toEqual([['model', false], ['model', false]]);

        expect(applyTravelToModels(undefined, true)).toBe(0);
        expect(applyTravelToModels([], true)).toBe(0);
    });

    it('starts hidden and remembers being turned on', () => {
        // Fresh module state reads the store; a missing key means "hidden", since a busy drawing's pen-up moves
        // are most of the lines on screen.
        let state = reducer(undefined, {type: '@@INIT'});
        expect(state.showTravel).toBe(false);

        // The thunk writes the preference before dispatching, which is what survives a reload.
        const dispatched = [];
        actions.toggleTravel()((action) => dispatched.push(action), () => ({viewOptions: state}));
        expect(store.get('VIEW_OPTIONS_SHOW_TRAVEL')).toBe('true');

        state = reducer(state, dispatched[0]);
        expect(state.showTravel).toBe(true);
        expect(reducer(state, {type: '@@INIT'}).showTravel).toBe(true);
    });
});
