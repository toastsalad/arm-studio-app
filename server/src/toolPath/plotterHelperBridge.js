import fs from 'fs';
import path from 'path';
import {execFile} from 'child_process';
import {CACHE_DIR} from '../init.js';
import {fetchBuffer} from '../utils/index.js';
import {frameSvg, toneFrameSize} from './toneFrame.js';
import {runRasterToPng, runRasterToTonePng} from './rasterWorkerClient.js';
import toolPathStr4svg from './toolPathStr4svg.js';
import {settingsBool, settingsNode, settingsNumber, settingsString} from '../settings.js';
import {log} from '../../../shared/log.mjs';

// Bridge from the "Write & Draw" toolpath to the local PlotterHelper engine. PlotterHelper emits
// M3/M5 (servo) tool commands; the front-end turns those into the DexArm's Z lift, so no Z
// handling is needed here.
//
// SVG input is rescaled by rewriting the root element (see buildSvg). Raster input is traced to
// SVG by the engine itself (--trace), so nothing is rewritten there. On failure the SVG path
// falls back to the built-in converter; the raster path cannot, and reports an error instead.

// The engine is found once. Probing three paths with existsSync on every preview was pure
// overhead on a path that runs on each settings change. A miss is not cached: in development the
// engine can appear when scripts/build-plotter-helper.sh finishes.
let enginePath = null;
const engineExe = () => {
    if (enginePath) return enginePath;
    // Windows ships PlotterHelper.exe; Linux/macOS ship an extensionless binary.
    const exe = process.platform === 'win32' ? 'PlotterHelper.exe' : 'PlotterHelper';
    // Packaged builds put the engine beside the bundle; dev.sh symlinks electron/build-server ->
    // server/build-server, so the engine also sits two levels up. Probe instead of trusting the
    // caller's layout, or the engine is silently never found in development.
    const candidates = [
        path.join(__dirname, '..', 'PlotterHelper', exe),
        path.join(__dirname, '..', '..', 'electron', 'PlotterHelper', exe),
        path.join(__dirname, '..', '..', 'server', 'PlotterHelper', exe),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            enginePath = candidate;
            break;
        }
    }
    return enginePath || candidates[0];
};
const cacheDir = () => CACHE_DIR;

const getAttr = (tag, name) => {
    const match = new RegExp(name + "\\s*=\\s*[\"']([^\"']*)[\"']", 'i').exec(tag);
    return match ? match[1] : null;
};

const truthy = (o, d) => ((o && o.default_value !== undefined) ? !!o.default_value : d);
const dec = (o, d) => ((o && o.default_value !== undefined && isFinite(Number(o.default_value))) ? Number(o.default_value) : d);


const stamp = () => Date.now() + '_' + Math.random().toString(36).slice(2);

// A preview is requested on every settings change, so on a slow trace the engine runs pile up and
// fight each other for the machine. Superseding a request for the same image kills the one it
// replaces.
//
// Each run is one of four things, and the state is a field rather than something the reader has
// to infer from a map entry and `child.killed`:
//
//   running -- in flight, owns the machine
//   superseded -- killed by a newer preview of the same image; its failure is not an error
//   done -- wrote its G-code and was read
//   failed -- the engine failed on its own
const RUNNING = 'running';
const SUPERSEDED = 'superseded';
const DONE = 'done';
const FAILED = 'failed';

/** url -> {state, child} for the most recent run of that image. */
const runByUrl = new Map();

const supersede = (key) => {
    const run = runByUrl.get(key);
    if (!run || run.state !== RUNNING) return;
    run.state = SUPERSEDED;
    runByUrl.delete(key);
    try { run.child.kill('SIGKILL'); } catch (e) { /* already gone */ }
};

// The SVG the tracer produced for the most recent preview of each upload, so the app can save it;
// keyed by upload url, which is stable for the life of the model.
//
// Bounded like the decoded PNGs below: an upload is a url, so without a cap a long session keeps
// one traced SVG per image it ever saw. Each one is megabytes on disk, and nothing else deletes
// them. Evicting costs the "export traced SVG" for that upload, which is recoverable by previewing
// it again; an unbounded cache is not.
const MAX_TRACED_SVGS = 8;
const tracedSvgByUrl = new Map();

/** Absolute path of the traced SVG for an upload, or null if it has not been traced yet. */
export const tracedSvgPathFor = (url) => tracedSvgByUrl.get(url) || null;

/** True while an engine run is in flight for this upload. */
export const isTracing = (url) => {
    const run = runByUrl.get(url);
    return !!run && run.state === RUNNING;
};

const forgetTracedSvg = (url) => {
    const existing = tracedSvgByUrl.get(url);
    tracedSvgByUrl.delete(url);
    if (existing) {
        try { fs.unlinkSync(existing); } catch (e) { /* already gone */ }
    }
};

/** Keep only the newest traced SVG for an upload: the engine writes one per preview. */
const rememberTracedSvg = (url, path) => {
    if (tracedSvgByUrl.get(url) === path) return;
    forgetTracedSvg(url);
    while (tracedSvgByUrl.size >= MAX_TRACED_SVGS) {
        const [oldestUrl] = tracedSvgByUrl.keys();
        forgetTracedSvg(oldestUrl);
    }
    tracedSvgByUrl.set(url, path);
};

// Decoded PNG per upload; the bytes behind a url never change, so transcode once.
const pngByUrl = new Map();
const MAX_CACHED_PNGS = 8;

const pngFor = async (url) => {
    const cached = pngByUrl.get(url);
    if (cached && fs.existsSync(cached)) return cached;

    const png = path.join(cacheDir(), 'src_' + stamp() + '.png');
    await runRasterToPng(url, png);

    // Bound it: each decoded image is tens of megabytes and the app may run for days.
    while (pngByUrl.size >= MAX_CACHED_PNGS) {
        const [oldestUrl, oldestPath] = pngByUrl.entries().next().value;
        pngByUrl.delete(oldestUrl);
        try { fs.unlinkSync(oldestPath); } catch (e) { /* already gone */ }
    }
    pngByUrl.set(url, png);
    return png;
};

// Mirror of the original converter's coordinate mapping: scale the SVG to the
// requested mm size, then centre it at the origin (via --machine-origin center).
const buildSvg = (svg, settings) => {
    const tagMatch = /<svg\b[^>]*>/i.exec(svg);
    if (!tagMatch) return null;
    const tag = tagMatch[0];
    const attr = (name) => getAttr(tag, name);

    let vbX = 0, vbY = 0, vbW = 0, vbH = 0;
    const vb = attr('viewBox');
    if (vb) {
        const parts = vb.split(/[\s,]+/).map(Number);
        if (parts.length === 4 && isFinite(parts[2]) && isFinite(parts[3]) && parts[2] && parts[3]) {
            vbX = parts[0]; vbY = parts[1]; vbW = parts[2]; vbH = parts[3];
        }
    }
    const numAttr = (name, def) => {
        const rawValue = attr(name);
        if (rawValue == null || rawValue.indexOf('%') >= 0) return def;
        const number = parseFloat(rawValue);
        return isFinite(number) ? number : def;
    };
    const imgW = numAttr('width', vbW || 1);
    const imgH = numAttr('height', vbH || 1);
    if (!vbW) vbW = imgW;
    if (!vbH) vbH = imgH;

    const desW = settingsNumber(settings, 'transformation.width', imgW) || imgW;
    const desH = settingsNumber(settings, 'transformation.height', imgH) || imgH;
    const rot = settingsNumber(settings, 'transformation.rotation', 0);
    const flip = settingsString(settings, 'transformation.flip_model', 'None');

    // SVG coordinates are relative to the viewBox origin, but PlotterHelper only
    // centres a zero-origin viewBox. Move the content to 0,0 and give the viewBox
    // a zero origin, so artwork placed away from (0,0) still lands on the origin.
    const cx = vbW / 2, cy = vbH / 2;
    const transforms = [];
    if (flip === 'Horizontal' || flip === 'Both') transforms.push(`translate(${vbW} 0) scale(-1 1)`);
    if (flip === 'Vertical' || flip === 'Both') transforms.push(`translate(0 ${vbH}) scale(1 -1)`);
    if (rot) transforms.push(`rotate(${-rot} ${cx} ${cy})`);
    transforms.push(`translate(${-vbX} ${-vbY})`);

    const inner = svg.slice(svg.indexOf(tag) + tag.length).replace(/<\/svg>\s*$/i, '');
    const open = `<g transform="${transforms.join(' ')}">`;
    const close = '</g>';
    // Reuse the original <svg> tag so its namespace declarations (sodipodi,
    // inkscape, xlink, ...) stay intact. Rebuilding the tag drops them and the
    // strict parser then rejects the namespaced children, silently falling back
    // to the built-in converter (which clips content outside the viewBox).
    const setAttr = (t, name, value) => {
        const re = new RegExp('\\s' + name + '\\s*=\\s*"[^"]*"');
        return re.test(t) ? t.replace(re, ` ${name}="${value}"`) : t.replace(/<svg/i, `<svg ${name}="${value}"`);
    };
    let openTag = setAttr(tag, 'width', desW);
    openTag = setAttr(openTag, 'height', desH);
    openTag = setAttr(openTag, 'viewBox', `0 0 ${vbW} ${vbH}`);
    return `${openTag}${open}${inner}${close}</svg>`;
};

/**
 * Speed, fill/hatch, travel-optimization and multi-colour flags, shared by both inputs. Every
 * setting is read defensively: a settings file that does not carry a key leaves the engine's own
 * default in place.
 */
const pathArgs = (settings, input, gcode) => {
    const fillNode = settingsNode(settings, 'config.fill');
    const fill = !!(fillNode && fillNode.default_value) && !!fillNode.children;

    const args = ['--input', input, '--gcode', gcode, '--unit', 'mm', '--handle-viewbox', 'true', '--machine-origin', 'center',
        '--travel-speed', String(Math.round(Math.max(1, settingsNumber(settings, 'working_parameters.jog_speed', 2000)))),
        '--cutting-speed', String(Math.round(Math.max(1, settingsNumber(settings, 'working_parameters.work_speed', 2000))))];

    if (fill) {
        const dens = Math.max(1, settingsNumber(settings, 'config.fill.fill_density', 4));
        const fillStyle = settingsString(settings, 'config.fill.fill_style', '');
        // Deliberately no --auto-close. It bridges every open subpath shut, so turning it on
        // hatched open strokes as if they were outlines: the robot-arm example went from 35k to
        // 90k pen moves, and a single arc in line art became a solid half-disc. Anything that
        // should fill already ends where it started - a closed path, or a traced region, which
        // the tracer emits with coincident endpoints and no Z.
        args.push('--mode', 'hatchcut', '--hatch-spacing', (5 / dens).toFixed(3), '--hatch-units', 'mm');
        if (fillStyle) args.push('--fill-style', fillStyle);
        args.push('--cross-hatch', settingsBool(settings, 'config.fill.cross_hatch', false) ? 'true' : 'false');
        args.push('--hatch-angle', String(Math.round(settingsNumber(settings, 'config.fill.hatch_angle', 45))));
        args.push('--inset', settingsBool(settings, 'config.fill.inset', true) ? 'true' : 'false');
        args.push('--inset-dist', String(settingsNumber(settings, 'config.fill.inset_dist', 0.5)));
        args.push('--connect-ends', settingsBool(settings, 'config.fill.connect_ends', true) ? 'true' : 'false');
        args.push('--hatch-scope', String(Math.round(settingsNumber(settings, 'config.fill.hatch_scope', 3))));
        args.push('--wave-amplitude', String(settingsNumber(settings, 'config.fill.wave_amplitude', 1)));
        args.push('--wave-wavelength', String(settingsNumber(settings, 'config.fill.wave_wavelength', 0)));
        if (settingsBool(settings, 'config.fill.jitter', false)) {
            args.push('--jitter', 'true', '--jitter-amount', String(settingsNumber(settings, 'config.fill.jitter_amount', 0.3)));
        }
    } else {
        args.push('--mode', 'cut');
    }

    // Stroke reordering to cut pen-up travel; --connect-outlines and
    // --optimize-travel-reverse only take effect alongside --optimize-travel.
    if (settingsBool(settings, 'config.optimize_path', false)) {
        args.push('--optimize-travel', 'true');
        if (settingsBool(settings, 'config.preserve_direction', false)) args.push('--optimize-travel-reverse', 'false');
        if (settingsBool(settings, 'config.connect_outlines', false)) args.push('--connect-outlines', 'true');
    }
    if (settingsBool(settings, 'config.group_by_color', false)) {
        args.push('--group-by-color', 'true', '--color-announce', 'false');
        if (settingsBool(settings, 'config.pause_between_colors', false)) args.push('--pause-between-colors', 'true', '--pause-command', 'M0');
    }
    return args;
};

/** Run the engine and return its G-code; supersedeKey names the request this one replaces. */
const runEngine = (args, gcodePath, temps, supersedeKey) => new Promise((resolve, reject) => {
    if (supersedeKey) supersede(supersedeKey);
    const run = {state: RUNNING, child: null};
    const child = execFile(engineExe(), args, {maxBuffer: 256 * 1024 * 1024, timeout: 600000}, (err, stdout, stderr) => {
        // Only the newest run for an image owns the map entry; an older one finishing late must
        // not evict its replacement.
        if (supersedeKey && runByUrl.get(supersedeKey) === run) runByUrl.delete(supersedeKey);
        let text = '';
        try { text = fs.readFileSync(gcodePath, 'utf8'); } catch (e) { /* ignore */ }
        for (const t of temps) {
            try { fs.unlinkSync(t); } catch (e) { /* ignore */ }
        }
        if (!err) {
            run.state = DONE;
            resolve(text);
            return;
        }
        if (run.state === SUPERSEDED) {
            // Killed by a newer preview, which the caller should not report as a failure.
            const gone = new Error('superseded by a newer preview');
            gone.superseded = true;
            reject(gone);
            return;
        }
        run.state = FAILED;
        log.error('PlotterHelper failed:', err, stderr);
        reject(err);
    });
    run.child = child;
    if (supersedeKey) runByUrl.set(supersedeKey, run);
});

// Drop PlotterHelper's own absolute/unit preamble; the caller adds the start/end gcode and the
// app dialect expects no G90/G21.
const trimPreamble = (raw) => raw.split('\n').filter((line) => {
    const value = line.trim();
    return value && value !== 'G90;' && value !== 'G21;' && value !== 'G20;';
}).join('\n');

/**
 * Whether the requested drawing needs the engine at all.
 *
 * The built-in converter is a fallback for when the engine is missing, and it draws a plain fill: it
 * has no notion of a fill style, no travel optimisation and no colour grouping. Falling back when one
 * of those was asked for returns a drawing the user did not request, and the panel has no way to look
 * any different -- which is exactly how a stale engine presented as "the fill style does nothing".
 */
const needsEngine = (settings) =>
    settingsString(settings, 'config.fill.fill_style', 'parallel') !== 'parallel'
    || settingsBool(settings, 'config.optimize_path', false)
    || settingsBool(settings, 'config.connect_outlines', false)
    || settingsBool(settings, 'config.group_by_color', false)
    || settingsBool(settings, 'config.preserve_direction', false);

export const plotterHelperSvg2toolPathStr = async (url, settings) => {
    try {
        const svg = (await fetchBuffer(url)).toString('utf8');
        const out = buildSvg(svg, settings);
        if (!out) throw new Error('no <svg> element in uploaded file');

        const id = stamp();
        const tmp = path.join(cacheDir(), 'ph_' + id + '.svg');
        const tmpG = path.join(cacheDir(), 'ph_' + id + '.gcode');
        fs.writeFileSync(tmp, out);

        const raw = await runEngine(pathArgs(settings, tmp, tmpG), tmpG, [tmp, tmpG], url);
        return trimPreamble(raw);
    } catch (e) {
        if (e && e.superseded) throw e;
        log.error('PlotterHelper bridge failed:', e);
        if (needsEngine(settings)) {
            // Say so instead of drawing something else quietly. The server forwards this to the
            // panel, which shows it as "Generate toolpath failed".
            throw new Error(
                'the fill style and travel optimisation need the PlotterHelper engine, which failed: '
                + (e && e.message || e)
                + '. Rebuild it with scripts/build-plotter-helper.sh (and check that the staged '
                + 'binary matches this platform).');
        }
        return await toolPathStr4svg(url, settings);
    }
};

/**
 * True when the fill style shades by tone, so a raster upload should be passed to it as a tone source
 * rather than traced.
 *
 * The tone fills ask a different question of an image than the other raster paths do. `bw` and
 * `greyscale` tone the image themselves and trace its edges; `trace` extracts centre lines. Shading wants
 * the image's luminance across the whole area, so the region is the picture's rectangle and the picture is
 * the tone.
 */
export const isToneStyle = (settings) => {
    const style = settingsString(settings, 'config.fill.fill_style', 'parallel');
    return style === 'shade' || style === 'stipple' || style === 'scribble';
};

// Turned tone images, keyed by source, rotation and flip, so dragging the rotation slider back to a value it
// passed through does not respawn the raster worker. Bounded like the other raster caches.
const toneByKey = new Map();
const MAX_CACHED_TONES = 8;

/** The tone image for a raster: the picture itself, turned and flipped as the drawing is. */
const toneImageFor = async (url, png, rotation, flip) => {
    // Nothing turned: the decoded picture is already the tone.
    if (!rotation && (flip === 'None' || !flip)) return png;

    const key = `${url}|${Number(rotation).toFixed(3)}|${flip}`;
    const cached = toneByKey.get(key);
    if (cached && fs.existsSync(cached)) return cached;

    const out = path.join(cacheDir(), 'tn_' + stamp() + '.png');
    await runRasterToTonePng(png, out, rotation, flip);

    while (toneByKey.size >= MAX_CACHED_TONES) {
        const [oldestKey, oldestPath] = toneByKey.entries().next().value;
        toneByKey.delete(oldestKey);
        try { fs.unlinkSync(oldestPath); } catch (e) { /* already gone */ }
    }
    toneByKey.set(key, out);
    return out;
};

/**
 * Shade a raster: the image supplies the tone, a rectangle supplies the region.
 */
export const plotterHelperRasterShade = async (url, settings) => {
    const width = Math.max(1, settingsNumber(settings, 'transformation.width', 200));
    const height = Math.max(1, settingsNumber(settings, 'transformation.height', 200));
    const rotation = settingsNumber(settings, 'transformation.rotation', 0);
    const flip = settingsString(settings, 'transformation.flip_model', 'None');

    // The decoded PNG, shared with the tracing path: the bytes behind a url never change.
    const png = await pngFor(url);

    const id = stamp();
    const tmp = path.join(cacheDir(), 'sh_' + id + '.svg');
    const tmpG = path.join(cacheDir(), 'sh_' + id + '.gcode');

    // The picture is turned before it reaches the engine, and the frame grows to hold it. Without this the
    // ink of a shaded, stippled or scribbled picture was always upright, whatever the transformation said.
    const frame = toneFrameSize(width, height, rotation);
    const tone = await toneImageFor(url, png, rotation, flip);
    fs.writeFileSync(tmp, frameSvg(frame.width, frame.height));

    const args = pathArgs(settings, tmp, tmpG).concat(['--tone', tone]);

    // No --tone-invert here. The engine has the flag, but no settings tree pairs an invert switch with a
    // fill style: `config.invert` exists only in the laser container's bw and greyscale configs, which have
    // no fill section, so a shaded fill can never reach this path with it set. Passing it would be a branch
    // nothing can take; the flag stays available to the command line.

    const raw = await runEngine(args, tmpG, [tmp, tmpG], url);
    return trimPreamble(raw);
};

/**
 * Raster input: transcode to PNG in the raster worker, then let PlotterHelper trace it by
 * centerline. There is no SVG to rewrite here -- the engine generates the traced document
 * itself -- so this skips buildSvg entirely.
 */
export const plotterHelperRaster2toolPathStr = async (url, settings) => {
    const traceNode = settingsNode(settings, 'config.trace');
    const trace = traceNode && traceNode.children ? traceNode.children : null;

    const id = stamp();
    const tmpG = path.join(cacheDir(), 'tr_' + id + '.gcode');
    // Kept rather than deleted: the traced SVG is the thing to open when a plot comes out wrong.
    const tmpTraced = path.join(cacheDir(), 'traced_' + id + '.svg');

    let tmpPng;
    try {
        tmpPng = await pngFor(url);
    } catch (e) {
        log.error('raster transcode failed:', e);
        throw new Error('Could not read that image: ' + (e && e.message || e));
    }

    const width = Math.max(1, settingsNumber(settings, 'transformation.width', 200));
    const height = settingsNumber(settings, 'transformation.height', 0);
    const args = pathArgs(settings, tmpPng, tmpG).concat([
        '--trace', 'true',
        '--trace-svg', tmpTraced,
        '--trace-width', String(width),
        '--trace-height', String(height > 0 ? height : 0),
        '--trace-units', 'mm',
    ]);
    if (trace) {
        // The four knobs the app exposes; everything else keeps the engine default.
        args.push('--trace-upscale', String(Math.round(settingsNumber(settings, 'config.trace.upscale', 3))));
        args.push('--trace-window', String(Math.round(settingsNumber(settings, 'config.trace.window', 21))));
        args.push('--trace-thick-width', String(settingsNumber(settings, 'config.trace.thick_width', 5)));
        args.push('--trace-join-gap', String(settingsNumber(settings, 'config.trace.join_gap', 2)));
    }

    if (!fs.existsSync(engineExe())) {
        throw new Error('Raster tracing needs the PlotterHelper engine, which was not found at '
            + engineExe() + '. Build it with scripts/build-plotter-helper.sh.');
    }
    try {
        const raw = await runEngine(args, tmpG, [tmpG], url);
        rememberTracedSvg(url, tmpTraced);
        return trimPreamble(raw);
    } catch (e) {
        if (e && e.superseded) throw e;
        // No fallback available: the built-in converter only understands SVG.
        throw new Error('Raster tracing needs the PlotterHelper engine. ' + (e && e.message || e));
    }
};

export default plotterHelperSvg2toolPathStr;
