#!/usr/bin/env node
// Do the places that list fill styles agree with each other?
//
// A fill style has to be added in four places, and three of them are in this repo: the engine's enum, the
// Inkscape panel, the UI's settings for both the SVG and the trace tool, and a star icon for the picker.
// Forgetting one is silent -- the style simply never appears, or appears and draws nothing, or draws and
// has no swatch -- so this checks them against each other instead.
//
// Run from the arm-studio repo:  node scripts/check-fill-styles.mjs [path-to-Drawing-Extension]
// Exits non-zero on a mismatch. The engine repo is optional: without it, only the local lists are compared.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRepo = path.dirname(here);
const engineRepo = process.argv[2] ?? path.join(path.dirname(appRepo), 'Drawing-Extension');

const sorted = (list) => [...new Set(list)].sort();
const rows = [];
const report = (label, list) => rows.push([label, sorted(list)]);

// ---- this repo: the UI ---------------------------------------------------------
// The vector tabs (SVG, trace, text) plot shapes and offer the sixteen pattern fills. The Image tab takes a
// picture and offers the three fills that read a raster, because a vector file has no tone to read.
const TONE_STYLES = ['shade', 'stipple', 'scribble'];
const vectorSettings = ['svg', 'trace'];
const settings = [...vectorSettings, 'image'].map((name) => {
    const file = path.join(appRepo, 'web/src/containers/writeAndDraw/lib/settings', `${name}.json`);
    const tree = JSON.parse(fs.readFileSync(file, 'utf8'));
    const fillStyle = (tree.children ?? tree).config.children.fill.children.fill_style;
    return {name, options: Object.keys(fillStyle.options), groups: fillStyle.groups.flatMap((g) => g.styles)};
});

const icons = fs
    .readdirSync(path.join(appRepo, 'web/src/components/Config/ConfigSvgOptions/images'))
    .filter((file) => file.startsWith('fill_') && file.endsWith('.svg'))
    .map((file) => file.slice('fill_'.length, -'.svg'.length));

for (const s of settings) {
    report(`${s.name}.json options`, s.options);
    report(`${s.name}.json groups`, s.groups);
}
report('icon files', icons);

// ---- the engine repo, when it is checked out beside this one -------------------
const engineDir = path.join(engineRepo, 'src/PlotterHelper.Core/Hatch/HatchOptions.cs');
const panelFile = path.join(engineRepo, 'inkscape/plotter-helper.inx');
const haveEngine = fs.existsSync(engineDir);

if (haveEngine) {
    const source = fs.readFileSync(engineDir, 'utf8');
    const body = /enum FillStyle\s*\{([\s\S]*?)\n\}/.exec(source)[1];
    // Enum members are the only lines that are just an identifier and a comma.
    report('engine FillStyle', [...body.matchAll(/^\s{4}([A-Z][A-Za-z]*),?\s*$/gm)].map((m) => m[1].toLowerCase()));

    if (fs.existsSync(panelFile)) {
        const inx = fs.readFileSync(panelFile, 'utf8');
        const param = /<param name="fill_style"[\s\S]*?<\/param>/.exec(inx);
        if (param) report('inkscape panel', [...param[0].matchAll(/<option value="([a-z]+)">/g)].map((m) => m[1]));
    }
} else {
    console.log(`(no engine repo at ${engineRepo}: comparing this repo's lists only)\n`);
}

const width = Math.max(...rows.map(([label]) => label.length));
for (const [label, list] of rows) console.log(`${label.padEnd(width)} ${String(list.length).padStart(2)}  ${list.join(' ')}`);

// ---- compare -------------------------------------------------------------------
let problems = 0;
const compare = (a, b, what) => {
    const missing = sorted(a).filter((x) => !sorted(b).includes(x));
    const extra = sorted(b).filter((x) => !sorted(a).includes(x));
    if (!missing.length && !extra.length) return;
    problems++;
    console.log(`\nMISMATCH: ${what}`);
    if (missing.length) console.log(`  missing: ${missing.join(', ')}`);
    if (extra.length) console.log(`  extra:   ${extra.join(', ')}`);
};

const [first, second, image] = settings;
const patternIcons = icons.filter((style) => !TONE_STYLES.includes(style));

// Every style needs a tooltip, and only a style can have one: the swatches are the only place a reader learns
// what a pattern does, and a missing description is invisible until someone hovers.
const descriptions = (await import(
    pathToFileURL(path.join(appRepo, 'web/src/components/Config/ConfigSvgOptions/fillDescriptions.js')).href)).default;
const described = Object.keys(descriptions);
for (const [style, text] of Object.entries(descriptions)) {
    if (!text || text.length > 110) {
        problems++;
        console.log(`\nMISMATCH: tooltip for ${style} is ${text ? text.length + ' characters, too long to hover' : 'empty'}`);
    }
}
compare(sorted([...patternIcons, ...TONE_STYLES]), described, 'style list vs tooltips');

// Within each tab: the options and the picker groups have to agree.
for (const s of settings) compare(s.options, s.groups, `${s.name}.json options vs its picker groups`);

// Across the tabs: the vector ones plot shapes and share a list; the Image tab owns the tone fills and
// nothing else, because a vector file has no tone to read.
compare(first.options, second.options, 'svg.json vs trace.json options');
compare(TONE_STYLES, image.options, 'tone styles vs image.json options');
compare(patternIcons, first.options, 'pattern icon files vs svg.json options');

// Every style the engine knows has to land on exactly one of the two tabs.
if (haveEngine) {
    const engine = rows.find(([label]) => label === 'engine FillStyle')?.[1];
    const panel = rows.find(([label]) => label === 'inkscape panel')?.[1];
    if (engine) {
        compare(engine.filter((s) => !TONE_STYLES.includes(s)), first.options,
            'engine patterns vs svg.json options');
        compare(engine.filter((s) => TONE_STYLES.includes(s)), image.options,
            'engine tone styles vs image.json options');
        compare(engine, icons, 'engine enum vs icon files');
        if (panel) compare(engine, panel, 'engine enum vs inkscape panel');
    }
}

console.log(`\n${problems === 0 ? 'all lists agree' : `${problems} mismatch${problems === 1 ? '' : 'es'}`}`);
process.exit(problems ? 1 : 0);
