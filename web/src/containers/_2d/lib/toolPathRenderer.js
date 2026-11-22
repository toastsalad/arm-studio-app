import * as THREE from 'three';
import {TOOL_PATH_RENDER_METHOD_POINT} from "../../../constants.js"
import {canvasPalette} from '../../../utils/canvasPalette';

// Pen-up moves, drawn green so the drawing stays the artwork and the travel reads as secondary. They are hidden
// by default: on a busy drawing they are most of the lines on screen and only matter when you are working out why
// a plot takes as long as it does. The toolbar's eye shows them.
const TRAVEL_COLOR = new THREE.Color(0x90ee90);
// The part of a drawing that has been plotted: red for artwork, grey for travel already crossed. Kept
// here with the other toolpath colours rather than in the theme palette, which is about the canvas
// chrome; these two say something about a running job.
export const PLOT_PROGRESS_COLOR = 0xd00000;
export const PLOT_TRAVEL_DONE_COLOR = 0x777777;

// Read per render rather than fixed at import: black is right on the light canvas, but on the
// dark one the drawing has to become the light element and the canvas behind it is dark.
const drawingColor = () => new THREE.Color(canvasPalette().drawing);

const motionColor = () => ({
    'G0': TRAVEL_COLOR,
    'G1': drawingColor(),
    'unknown': drawingColor()
});

const lineSegments = (positions, color, name) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true
    });
    const lines = new THREE.LineSegments(geometry, material);
    // Named so a theme change can recolour the two of them instead of building them again.
    lines.name = name;
    return lines;
};

class ToolPathRenderer {
    constructor() {
        this.data = [];
    }

    /**
     * @param toolPathLines parsed toolpath, one object per G-code line
     * @param travelColor   colour for pen-up (G0) moves; pass nothing to leave them out
     */
    render(toolPathLines, travelColor = null) {
        if (toolPathLines.length === 1) {
            return null;
        }

        // The first G-code line marks the render mode.
        if (toolPathLines[0].C === TOOL_PATH_RENDER_METHOD_POINT) {
            return this._parseToPoints(toolPathLines, travelColor);
        } else {
            return this._parseToLine(toolPathLines, travelColor);
        }
    }

    _parseToLine(toolPathLines, travelColor) {
        const positions = [];
        // Per vertex: was the pen up on the way to it? Travel is read from the pen, because the
        // engine writes EVERY move as G1 - travel included, at the travel feed rate - and brackets
        // each stroke with M3 and M5. There is no G0 in the G-code this app plots, so keying on it,
        // as this did, left every segment drawn as artwork and nothing ever came out green. A G0
        // from some other source still counts as travel.
        const penWasUp = [];
        // Per vertex: the toolpath line that put it there. A segment takes the line of the vertex it
        // ends at, which is the move that drew it - that is what progress counts.
        const lineOfVertex = [];

        let state = {
            G: 0,
            X: 0,
            Y: 0,
            Z: 0
        };
        let penIsDown = false;
        for (let i = 0; i < toolPathLines.length; i++) {
            const lineObj = toolPathLines[i];
            if (lineObj.M === 3) penIsDown = true;
            else if (lineObj.M === 5) penIsDown = false;

            const newState = {...state};
            lineObj.G !== undefined && (newState.G = lineObj.G);
            lineObj.X !== undefined && (newState.X = lineObj.X);
            lineObj.Y !== undefined && (newState.Y = lineObj.Y);
            lineObj.Z !== undefined && (newState.Z = lineObj.Z);

            if (state.G !== newState.G ||
                state.X !== newState.X ||
                state.Y !== newState.Y ||
                state.Z !== newState.Z) {
                state = newState;
                positions.push(state.X);
                positions.push(state.Y);
                positions.push(state.Z);
                penWasUp.push(!penIsDown || state.G === 0);
                lineOfVertex.push(i);
            }
        }

        // The colour has to be decided per SEGMENT: a per-vertex attribute is interpolated along
        // the segment, so travel could never be told apart from the artwork. Segment i -> i+1 is
        // travelled by the move that ended at vertex i+1, so it takes that vertex's state.
        const drawing = [];
        const travel = [];
        const drawingLines = [];
        const travelLines = [];
        const vertexCount = positions.length / 3;
        for (let i = 0; i + 1 < vertexCount; i++) {
            const isTravel = penWasUp[i + 1];
            if (isTravel && !travelColor) continue;
            const target = isTravel ? travel : drawing;
            target.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
            target.push(positions[(i + 1) * 3], positions[(i + 1) * 3 + 1], positions[(i + 1) * 3 + 2]);
            (isTravel ? travelLines : drawingLines).push(lineOfVertex[i + 1]);
        }

        const group = new THREE.Group();
        group.name = 'toolPath';
        if (drawing.length) group.add(lineSegments(drawing, drawingColor(), 'drawing'));
        if (travel.length) group.add(lineSegments(travel, travelColor, 'travel'));
        // Which toolpath line each segment belongs to, so the model can cut the drawing at the line the
        // arm has reached. Kept on the group rather than in the geometry: it is data, not a buffer.
        group.userData.progress = {
            drawing: Int32Array.from(drawingLines),
            travel: Int32Array.from(travelLines),
        };
        return group;
    }

    _parseToPoints(toolPathLines, travelColor = null) {
        const colors4motion = motionColor();
        const positions = [];
        const colors = [];
        const pointLines = [];
        const material = new THREE.PointsMaterial({
            size: 0.4,
            vertexColors: true,
            opacity: 0.9,
            transparent: true
        });
        let state = {
            G: 0,
            X: 0,
            Y: 0,
            Z: 0
        };
        // Point mode draws travel as green vertices inside the same object as the artwork, so there is no
        // separate object to hide: the pen-up points are left out of the geometry instead, which is the same
        // rule line mode follows when it is given no colour for them.
        const skipTravel = !travelColor;
        for (let i = 0; i < toolPathLines.length; i++) {
            const item = toolPathLines[i];
            const newState = {...state};
            item.G !== undefined && (newState.G = item.G);
            item.X !== undefined && (newState.X = item.X);
            item.Y !== undefined && (newState.Y = item.Y);
            item.Z !== undefined && (newState.Z = item.Z);

            if (state.G !== newState.G ||
                state.X !== newState.X ||
                state.Y !== newState.Y ||
                state.Z !== newState.Z) {
                state = newState;
                if (skipTravel && state.G === 0) continue;
                positions.push(state.X, state.Y, state.Z);
                pointLines.push(i);
                if (state.G === 0) {
                    colors.push(colors4motion.G0.r, colors4motion.G0.g, colors4motion.G0.b);
                } else if (state.G === 1) {
                    colors.push(colors4motion.G1.r, colors4motion.G1.g, colors4motion.G1.b);
                } else {
                    colors.push(colors4motion.unknown.r, colors4motion.unknown.g, colors4motion.unknown.b);
                }
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const points = new THREE.Points(geometry, material);
        // Point mode has no segments: progress is a prefix of the vertices, in path order.
        points.userData.progress = { points: Int32Array.from(pointLines) };
        return points;
    }
}

const toolPathRenderer = new ToolPathRenderer();

/**
 * Show or hide the green pen-up moves in one rendered toolpath, or in a whole scene.
 *
 * The travel lines are a named child of the group the renderer returns, so this is a visibility flag: nothing
 * about the drawing changes and no preview has to be recomputed, which matters because a preview costs a round
 * trip to the engine.
 *
 * Returns how many travel objects it touched, so a caller (or a test) can tell "there were none" from "it
 * worked".
 */
const TRAVEL_OBJECT_NAME = 'travel';

/**
 * Tell every drawing on the canvas whether to show its pen-up moves.
 *
 * Kept here rather than inline in the canvas so the wiring is testable without a scene: the canvas holds a list
 * of models, and this is the rule about which of them get told.
 */
const applyTravelToModels = (models, show) => {
    let touched = 0;
    for (const model of models ?? []) {
        if (typeof model.setTravelVisible !== 'function') continue;
        model.setTravelVisible(show === true);
        touched++;
    }
    return touched;
};

export {TRAVEL_COLOR, drawingColor, applyTravelToModels, TRAVEL_OBJECT_NAME};
export default toolPathRenderer;
