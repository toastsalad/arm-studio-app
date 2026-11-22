import {describe, expect, it} from 'vitest';
import {
    describePlotTime,
    estimateModelsTime,
    estimatePlotTime,
    formatDuration,
    measureToolPath,
    speedsForModel,
} from '../src/utils/estimatePlotTime.js';

// The drawing-time estimate: inked length at the work speed, travelling length at the jog speed. The lines are
// the same ones the G-code is generated from, with M3/M5 marking pen down and pen up.

const DOWN = {M: 3};
const UP = {M: 5};
const to = (x, y) => ({G: 1, X: x, Y: y});
const travelTo = (x, y) => ({G: 0, X: x, Y: y});

const settings = (work, jog) => ({
    working_parameters: {
        children: {
            work_speed: {default_value: work},
            jog_speed: {default_value: jog},
        },
    },
});

describe('measureToolPath', () => {
    it('separates inked length from travelled length', () => {
        const path = [
            DOWN, to(0, 0), to(10, 0),        // 10 mm drawn
            UP, travelTo(40, 0),              // 30 mm travelled
            DOWN, to(40, 5),                  // 5 mm drawn
        ];
        const {cutMm, travelMm} = measureToolPath(path);
        expect(cutMm).toBeCloseTo(15, 6);
        expect(travelMm).toBeCloseTo(30, 6);
    });

    it('counts the move that lifts the pen as travel, not as ink', () => {
        // M5 arrives before the move to the next stroke: that move is travel.
        const path = [DOWN, to(0, 0), to(10, 0), UP, to(10, 20)];
        expect(measureToolPath(path).cutMm).toBeCloseTo(10, 6);
        expect(measureToolPath(path).travelMm).toBeCloseTo(20, 6);
    });

    it('ignores markers, comments and anything without a position', () => {
        const path = [{C: ';comment'}, {N: ''}, DOWN, {F: 2000}, to(0, 0), {M: 2000}, to(0, 10)];
        const {cutMm, travelMm} = measureToolPath(path);
        expect(cutMm).toBeCloseTo(10, 6);
        expect(travelMm).toBe(0);
    });

    it('a first point alone is no distance at all', () => {
        expect(measureToolPath([DOWN, to(50, 50)])).toEqual({cutMm: 0, travelMm: 0});
        expect(measureToolPath([])).toEqual({cutMm: 0, travelMm: 0});
        expect(measureToolPath(null)).toEqual({cutMm: 0, travelMm: 0});
    });
});

describe('estimatePlotTime', () => {
    it('divides each length by its own speed, in mm per minute', () => {
        // 60 mm at 60 mm/min is one minute; 120 mm at 240 mm/min is half a minute.
        const path = [DOWN, to(0, 0), to(60, 0), UP, travelTo(180, 0)];
        const estimate = estimatePlotTime(path, {workSpeed: 60, jogSpeed: 240});
        expect(estimate.cutMs).toBeCloseTo(60000, 3);
        expect(estimate.travelMs).toBeCloseTo(30000, 3);
        expect(estimate.totalMs).toBeCloseTo(90000, 3);
    });

    it('a zero speed is unknown rather than instant', () => {
        const estimate = estimatePlotTime([DOWN, to(0, 0), to(10, 0)], {workSpeed: 0, jogSpeed: 2000});
        expect(estimate.cutMs).toBe(Infinity);
        expect(formatDuration(estimate.totalMs)).toBe('unknown');
    });

    it('speed comes from the drawing it belongs to', () => {
        const model = {settings: settings(1000, 3000)};
        expect(speedsForModel(model)).toEqual({workSpeed: 1000, jogSpeed: 3000});
        // A model with no working parameters falls back to the settings' own defaults instead of dividing by
        // zero or by nothing.
        expect(speedsForModel({settings: {}})).toEqual({workSpeed: 2000, jogSpeed: 2000});
        expect(speedsForModel(undefined)).toEqual({workSpeed: 2000, jogSpeed: 2000});
    });
});

describe('estimateModelsTime', () => {
    it('adds up every drawing, and skips ones with no toolpath yet', () => {
        const straight = (x0, x1, work) => ({
            settings: settings(work, work),
            toolPathLines: [DOWN, to(x0, 0), to(x1, 0)],
        });
        const models = [
            straight(0, 60, 60),        // 60 mm at 60 mm/min = 1 min
            straight(0, 120, 120),      // 120 mm at 120 mm/min = 1 min
            {settings: settings(60, 60)},   // not previewed yet
            null,
        ];
        const estimate = estimateModelsTime(models);
        expect(estimate.cutMm).toBeCloseTo(180, 6);
        expect(estimate.totalMs).toBeCloseTo(120000, 3);
    });
});

describe('describePlotTime', () => {
    it('states the total and what it is made of', () => {
        const text = describePlotTime({
            cutMm: 600, travelMm: 200, cutMs: 60000, travelMs: 5000, totalMs: 65000,
        });
        expect(text).toBe('Generate G-code success \u00b7 about 1.1 min to draw, 1.0 min pen down, 5.0 s travelling');
    });

    it('leaves out a part that contributes nothing', () => {
        const text = describePlotTime({cutMm: 600, travelMm: 0, cutMs: 60000, travelMs: 0, totalMs: 60000});
        expect(text).toBe('Generate G-code success \u00b7 about 1.0 min to draw, 1.0 min pen down');
    });

    it('falls back to the plain confirmation when there is no estimate', () => {
        expect(describePlotTime(null)).toBe('Generate G-code success');
        expect(describePlotTime({totalMs: Infinity})).toBe('Generate G-code success');
    });
});

describe('formatDuration', () => {
    it('reads as a person would say it', () => {
        expect(formatDuration(0)).toBe('0 ms');
        expect(formatDuration(820)).toBe('820 ms');
        expect(formatDuration(8249)).toBe('8.2 s');
        expect(formatDuration(41000)).toBe('41 s');
        expect(formatDuration(4 * 60000)).toBe('4.0 min');
        expect(formatDuration(12 * 60000)).toBe('12 min');
        expect(formatDuration(75 * 60000)).toBe('1 h 15 min');
        expect(formatDuration(120 * 60000)).toBe('2 h');
    });

    it('never shows a negative time', () => {
        expect(formatDuration(-5)).toBe('0 ms');
    });
});
