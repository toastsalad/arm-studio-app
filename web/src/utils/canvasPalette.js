// The palette the three.js surfaces draw with: the work area grid and axes, the bed, the pen's
// toolpath and the transform handles.
//
// The colours live in theme.css as --app-canvas-* and are read from there, so a canvas colour is
// changed in the same place as the rest of the theme instead of in a second table here. They are
// read through canvasPalette() rather than passed down, because the drawing code sits in plain
// modules (PrintablePlate, CoordinateAxes, toolPathRenderer, handles) that the canvas components
// reach into from several places. AppTheme calls refreshCanvasPalette() whenever the theme
// changes, and the canvases then redraw from the new palette.

// The names the drawing code uses, and the variable behind each one.
const ROLES = {
    clear: '--app-canvas-clear',
    grid: '--app-canvas-grid',
    gridCenter: '--app-canvas-grid-centre',
    axisX: '--app-canvas-axis-x',
    axisY: '--app-canvas-axis-y',
    workArea: '--app-canvas-work-area',
    target: '--app-canvas-target',
    drawing: '--app-canvas-drawing',
    handle: '--app-canvas-handle',
};

// three.js takes colours as packed 0xrrggbb numbers, and the variables are written as #rrggbb.
// Anything else - rgb(), a colour name, an eight-digit hex - would reach three.js as NaN or as the
// wrong colour, and would show up only as a canvas that had gone black. Say so instead: the
// warning names the variable to fix.
const readRole = (styles, role) => {
    const value = styles.getPropertyValue(ROLES[role]).trim();
    if (!/^#[0-9a-f]{6}$/i.test(value)) {
        console.warn(`canvasPalette: ${ROLES[role]} is "${value}", not a #rrggbb colour`);
        return NaN;
    }
    return parseInt(value.slice(1), 16);
};

const readPalette = () => {
    const styles = getComputedStyle(document.documentElement);
    const palette = {};
    for (const role of Object.keys(ROLES)) {
        palette[role] = readRole(styles, role);
    }
    return palette;
};

// Reading the variables costs a style recalculation, so the palette is cached and refreshed when
// the theme changes rather than on every draw call; the first read fills it if nothing has.
let current = null;

export const refreshCanvasPalette = () => {
    current = readPalette();
};

export const canvasPalette = () => current || (current = readPalette());

// Mixes two packed 0xrrggbb colours. The canvases fade their clear colour over the theme change
// to match the CSS transition; everything else they rebuild once the fade has landed.
export const lerpColour = (from, to, t) => {
    const mix = (shift) => Math.round((((from >> shift) & 255) + (((to >> shift) & 255) - ((from >> shift) & 255)) * t));
    return (mix(16) << 16) | (mix(8) << 8) | mix(0);
};
