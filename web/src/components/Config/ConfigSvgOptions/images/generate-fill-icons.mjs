// Generates the fill-style icons: a star outline with the hatching pattern clipped into it.
//
// The pattern is not drawn by hand -- it comes from the PlotterHelper engine, so each icon really
// shows the algorithm it labels. Point it at the built CLI (the sibling Drawing-Extension repo) and
// it rewrites fill_<style>.svg next to this script.
//
//   node generate-fill-icons.mjs [path-to-PlotterHelper(.exe)] [style...]
//
// Nothing else in the app reads this file; it exists so the icons can be regenerated when the hatch
// algorithms change, which is cheaper than rediscovering how they were made.

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// The star the existing icons use: ten points, tip at the top, in a viewBox of -47.8,-50 95.5,91.2.
const STAR = [
    [0.0, -46.0], [10.6, -14.6], [43.8, -14.2], [17.1, 5.6], [27.0, 37.2],
    [0.0, 18.0], [-27.0, 37.2], [-17.1, 5.6], [-43.8, -14.2], [-10.6, -14.6], [0.0, -46.0],
];

const VIEW_BOX = '-47.8 -50.0 95.5 91.2';
const VIEW_HEIGHT = 91.2;          // the engine flips y inside the viewBox; undo it on the way back
const HATCH_SPACING = 7;           // user units, chosen so the star takes about nine lines
const HATCH_ANGLE = 30;

const STAR_PATH = STAR.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');

const DEFAULT_STYLES = ['serpentine', 'fermat', 'moire', 'peano', 'engrave'];

// Per-style tuning for the icon, because a thumbnail is not a plot. The tone fills shade by the star's own
// boundary when no image is given, so the threshold still matters for the line fill that reads it. The
// generators ignore it -- without a raster they cover the whole shape -- and they set their own pitch, which
// at the plotting default is far too fine for a 95-unit star: the stipple came out with a handful of dots
// and the scribble with one continuous scrawl that read as a filled shape.
//
// Chosen by looking at the rendered swatches rather than by reading point counts: stipple at 4 spacings of
// the hatch grid, scribble at 10, which gives three wandering strokes.
const ICON_ARGS = {
    shade: ['--tone-threshold', '0.4'],
    stipple: ['--hatch-spacing', '4'],
    scribble: ['--hatch-spacing', '4'],
    // The fine-grained patterns need a coarser request at icon scale or the star comes out as a solid
    // shape: at seven spacings across 88 units there is room for only a few cells of the texture.
    truchet: ['--hatch-spacing', '4'],
    hexlattice: ['--hatch-spacing', '4'],
    fermat: ['--hatch-spacing', '3'],
};

const [, , cliArg, ...styleArgs] = process.argv;
const cli = cliArg ?? path.join(here, '../../../../../../Drawing-Extension/src/PlotterHelper.Cli/bin/Release/net10.0/PlotterHelper.exe');
const styles = styleArgs.length ? styleArgs : DEFAULT_STYLES;

if (!fs.existsSync(cli)) {
    console.error(`PlotterHelper CLI not found at ${cli}.`);
    console.error('Pass its path: node generate-fill-icons.mjs <path-to-PlotterHelper> [style...]');
    process.exit(1);
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'fill-icons-'));
const starSvg = path.join(scratch, 'star.svg');
fs.writeFileSync(starSvg,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}" width="95.5" height="91.2">` +
    `<path d="${STAR_PATH}Z" fill="none" stroke="black"/></svg>`);

const number = (value) => {
    const rounded = Math.round(value * 10) / 10;
    return (Object.is(rounded, -0) ? 0 : rounded).toFixed(1);
};

// Cutting strokes out of the G-code. The pen goes down with M3 and up with M5, and a stroke is the
// move that follows -- so the start point is wherever the pen already was, which the preceding travel
// move set. A stroke with one cut move is still a real two-point stroke, and most of the fills emit
// exactly that.
const strokesFrom = (gcode) => {
    const strokes = [];
    let position = null;
    let run = null;
    for (const raw of gcode.split('\n')) {
        const line = raw.trim();
        if (line.startsWith('M3')) { run = position ? [position] : []; continue; }
        if (line.startsWith('M5')) {
            if (run && run.length > 1) strokes.push(run);
            run = null;
            continue;
        }
        const move = /^G[01]\b[^X]*X(-?[\d.]+)\s+Y(-?[\d.]+)/.exec(line);
        if (!move) continue;
        position = [Number(move[1]), Number(move[2])];
        if (run !== null) run.push(position);
    }
    return strokes;
};

for (const style of styles) {
    const gcodePath = path.join(scratch, `${style}.gcode`);
    execFileSync(cli, [
        '--mode', 'hatch',
        '--input', starSvg,
        '--gcode', gcodePath,
        '--fill-style', style,
        '--hatch-spacing', String(HATCH_SPACING),
        '--hatch-angle', String(HATCH_ANGLE),
        // The star outline is drawn once, by hand, at the start of the path; the fill adds only ink.
        '--include-outlines', 'false',
        '--inset', 'false',
        '--connect-ends', 'false',
        ...(ICON_ARGS[style] ?? []),
    ], {stdio: 'ignore'});

    const gcode = fs.readFileSync(gcodePath, 'utf8');
    // The engine works in a y-up frame, so put the points back into the icon's y-down viewBox.
    const strokes = strokesFrom(gcode)
        .map((run) => run.map(([x, y]) => [x, VIEW_HEIGHT - y]));
    const pattern = strokes
        .map((run) => run.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${number(x)} ${number(y)}`).join(''))
        .join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}">` +
        `<path fill="none" stroke="#3f3f3f" stroke-width="2" stroke-linecap="round" ` +
        `stroke-linejoin="round" d="${STAR_PATH}${pattern}"/></svg>\n`;

    const target = path.join(here, `fill_${style}.svg`);
    fs.writeFileSync(target, svg);
    console.log(`${path.basename(target)}: ${strokes.length} strokes, ${pattern.length} chars`);
}

fs.rmSync(scratch, {recursive: true, force: true});
