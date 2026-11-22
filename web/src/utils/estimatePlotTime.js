// How long the machine will take to draw a toolpath: the length of everything it inks plus the length of
// everything it travels while the pen is up, each divided by its own speed.
//
// This is the estimate shown once a toolpath exists, so it is computed from the same lines the G-code is made
// from. It deliberately says nothing about:
//
//   * pen up and pen down. Each stroke costs a servo move and a dwell that this model has no number for, and
//     guessing it would make a many-stroke fill look faster than it is. A drawing with thousands of short
//     strokes really does take longer than this says.
//   * acceleration. The arm does not reach its commanded speed instantly, so short segments take
//     proportionally longer than long ones. On a fill made of 2 mm strokes that is most of the time.
//
// Both of those push the real time up, never down, so read the result as a floor.

import {settingsNumber} from './settings.js';

// The settings' own defaults, used when a drawing has no working parameters of its own.
const DEFAULT_WORK_SPEED = 2000;   // mm/min
const DEFAULT_JOG_SPEED = 2000;    // mm/min

/** Length in mm of the segment between two parsed toolpath points. */
const distance = (from, to) => Math.hypot(to.X - from.X, to.Y - from.Y);

/**
 * Walk a toolpath and add up the distance drawn and the distance travelled.
 *
 * Pen state comes from the M3/M5 markers the engine emits, because that is what decides which feed rate the
 * emitted G-code uses: M5 makes the following moves G0 at the jog speed, M3 makes them G1 at the work speed.
 */
export const measureToolPath = (toolPathLines) => {
    let cutMm = 0;
    let travelMm = 0;
    let penDown = false;
    let previous = null;

    for (const lineObj of toolPathLines || []) {
        if (!lineObj) continue;
        if (lineObj.M === 3) penDown = true;
        if (lineObj.M === 5) penDown = false;
        if (lineObj.X === undefined || lineObj.Y === undefined) continue;

        const point = {X: lineObj.X, Y: lineObj.Y};
        if (previous) {
            const length = distance(previous, point);
            if (penDown) cutMm += length;
            else travelMm += length;
        }
        previous = point;
    }

    return {cutMm, travelMm};
};

/** Milliseconds to cover `mm` at `mmPerMinute`. A speed of zero would be an infinite wait, so it is refused. */
const milliseconds = (mm, mmPerMinute) => {
    const speed = Number(mmPerMinute);
    if (!(speed > 0)) return Number.POSITIVE_INFINITY;
    return (mm / speed) * 60000;
};

/**
 * Estimate the drawing time of parsed toolpath lines, in milliseconds.
 *
 * `workSpeed` and `jogSpeed` are in mm per minute, which is the unit the settings use and the unit the engine
 * writes into its F commands.
 */
export const estimatePlotTime = (toolPathLines, {workSpeed, jogSpeed}) => {
    const {cutMm, travelMm} = measureToolPath(toolPathLines);
    const cutMs = milliseconds(cutMm, workSpeed);
    const travelMs = milliseconds(travelMm, jogSpeed);
    return {cutMm, travelMm, cutMs, travelMs, totalMs: cutMs + travelMs};
};

/** The same estimate for several drawings, which is what the canvas holds and what one G-code covers. */
export const estimateSceneTime = (models, speedsFor) => {
    const totals = {cutMm: 0, travelMm: 0, cutMs: 0, travelMs: 0, totalMs: 0};
    for (const model of models || []) {
        if (!model || !model.toolPathLines) continue;
        const estimate = estimatePlotTime(model.toolPathLines, speedsFor(model));
        totals.cutMm += estimate.cutMm;
        totals.travelMm += estimate.travelMm;
        totals.cutMs += estimate.cutMs;
        totals.travelMs += estimate.travelMs;
        totals.totalMs += estimate.totalMs;
    }
    return totals;
};

/**
 * The two speeds a model draws at, in mm per minute.
 *
 * Read from the model's own settings rather than from one shared settings tree: each drawing carries its own,
 * and the G-code emitter reads them the same way, so the estimate and the emitted F commands agree.
 */
export const speedsForModel = (model) => ({
    workSpeed: settingsNumber(model && model.settings, 'working_parameters.work_speed', DEFAULT_WORK_SPEED),
    jogSpeed: settingsNumber(model && model.settings, 'working_parameters.jog_speed', DEFAULT_JOG_SPEED),
});

/** The estimate for every drawing a G-code would include. */
export const estimateModelsTime = (models) => estimateSceneTime(models, speedsForModel);

/**
 * The confirmation line for a generated G-code: the drawing time, and what it is made of.
 *
 * The two halves are named because they answer different questions -- "is this fill slow because there is a lot
 * of ink, or because it travels a lot?" -- and because a single number that omits pen moves is easier to trust
 * when it says what it counted.
 */
export const describePlotTime = (estimate) => {
    const success = 'Generate G-code success';
    if (!estimate || !isFinite(estimate.totalMs)) return success;

    const parts = [`about ${formatDuration(estimate.totalMs)} to draw`];
    if (estimate.cutMm > 0) parts.push(`${formatDuration(estimate.cutMs)} pen down`);
    if (estimate.travelMm > 0) parts.push(`${formatDuration(estimate.travelMs)} travelling`);
    return `${success} \u00b7 ${parts.join(', ')}`;
};

/**
 * A duration as a person reads it: "8.2 s", "4 min", "1 h 12 min".
 *
 * Rounded to two significant steps of whatever the magnitude is, because the number underneath is a floor with
 * acceleration and pen moves missing: "4 min" is honest, "3 min 52 s" is not.
 */
export const formatDuration = (millisecondsValue) => {
    if (!isFinite(millisecondsValue)) return 'unknown';
    const ms = Math.max(0, millisecondsValue);
    if (ms < 1000) return `${Math.round(ms)} ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`;
    const minutes = seconds / 60;
    if (minutes < 60) return `${minutes < 10 ? minutes.toFixed(1) : Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const rest = Math.round(minutes - hours * 60);
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};
