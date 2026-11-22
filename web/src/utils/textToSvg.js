import opentype from 'opentype.js';

// Turn typed text into an SVG of its glyph outlines, ready to plot.
//
// Two kinds of font ship with the app. The Line* ones are SVG fonts: single-stroke Hershey
// outlines, which is what a pen wants. The rest are ordinary WOFF/TTF outline fonts, whose
// contours plot as hollow letters. SVG fonts are long gone from browsers, so both are reduced to
// path data here.
//
// Everything is expressed in em units (1.0 = the font size) with y running down, so one SVG
// transform places a glyph and there is no path rewriting to do - which is what the old
// implementation used svgpath for, and why it dragged in xml2js and five browser polyfills too.

const UNITS_PER_EM_FALLBACK = 1000;
const LINE_HEIGHT = 1.4;
// Room for descenders and overhang; the server crops an imported SVG to its ink anyway.
const PADDING = 0.25;

const fontCache = new Map();

const num = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed !== 0 ? parsed : fallback;
};

/**
 * An SVG font is an XML document with a <glyph> per character, its outline in font units with y
 * running up. The browser's own parser reads it, so no XML library is needed.
 */
const loadSvgFont = async (url) => {
    const xml = await (await fetch(url)).text();
    const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
    const font = doc.querySelector('font');
    if (!font) throw new Error('no <font> element');

    const face = font.querySelector('font-face');
    const unitsPerEm = num(face && face.getAttribute('units-per-em'), UNITS_PER_EM_FALLBACK);
    const defaultAdvance = num(font.getAttribute('horiz-adv-x'), unitsPerEm);
    const glyphs = new Map();
    for (const node of font.querySelectorAll('glyph')) {
        const unicode = node.getAttribute('unicode');
        if (!unicode) continue;
        glyphs.set(unicode.codePointAt(0), {
            d: node.getAttribute('d') || '',
            advance: num(node.getAttribute('horiz-adv-x'), defaultAdvance) / unitsPerEm,
        });
    }

    return {
        // The outline runs up the page, so the placement transform has to flip it.
        flipY: true,
        // Glyph outlines are in font units here, so they need dividing down to em: opentype hands
        // back em units already, but an SVG font does not.
        toEm: 1 / unitsPerEm,
        ascent: num(face && face.getAttribute('ascent'), unitsPerEm) / unitsPerEm,
        glyph: (code) => {
            const found = glyphs.get(code);
            return {d: found ? found.d : '', advance: found ? found.advance : defaultAdvance / unitsPerEm};
        },
    };
};

/**
 * opentype leaves the closing Z off its contours, relying on the last point landing back on the
 * first. The plotter only treats a contour as closed when it ends with Z, so a glyph drawn as one
 * contour (r, m) never filled at all, while a two-contour one (o, A) did. Put it back.
 */
const closeContours = (d) => {
    const parts = d.split('M').slice(1);
    if (!parts.length) return '';
    return 'M' + parts.map((part) => part.trim() + 'Z').join('M');
};

/**
 * A WOFF or TTF: opentype.js has already read the tables, and getPath wants a size up front, so
 * asking for size 1 returns the outline in em units, y down, baseline at the origin.
 */
const loadOutlineFont = async (url) => {
    const buffer = await (await fetch(url)).arrayBuffer();
    const font = opentype.parse(buffer);
    return {
        flipY: false,
        toEm: 1,
        ascent: font.ascender / font.unitsPerEm,
        glyph: (code) => {
            const glyph = font.charToGlyph(String.fromCodePoint(code));
            const advance = (glyph.advanceWidth || font.unitsPerEm) / font.unitsPerEm;
            // A code point the font does not carry comes back as .notdef; leave the gap blank.
            if (!glyph.index) return {d: '', advance};
            return {d: closeContours(glyph.getPath(0, 0, 1).toPathData(3)), advance};
        },
    };
};

/** Parsed fonts are cached by url: every keystroke rebuilds the SVG. */
const loadFont = (url) => {
    if (!fontCache.has(url)) {
        // Cache the promise, so a second call while the fetch is in flight shares it.
        fontCache.set(url, /\.svg$/i.test(url) ? loadSvgFont(url) : loadOutlineFont(url));
    }
    return fontCache.get(url);
};

/**
 * @param fontUrl  url of the .svg, .woff or .ttf the server lists
 * @param text     may contain newlines
 * @param maxWidth only used to size the canvas; the ink is cropped on upload
 * @returns {string} an SVG document
 */
export const textToSvg = async (fontUrl, text, fontSize) => {
    const font = await loadFont(fontUrl);
    const lines = String(text == null ? '' : text).split('\n');

    const paths = [];
    let widest = 0;
    lines.forEach((line, row) => {
        const baseline = font.ascent * fontSize + row * fontSize * LINE_HEIGHT;
        // Glyph outlines are drawn in font units; em units times the font size is the final size.
        const scale = fontSize * font.toEm;
        let pen = 0;
        for (const character of line) {
            const glyph = font.glyph(character.codePointAt(0));
            if (glyph.d) {
                const transform = font.flipY
                    ? `translate(${pen.toFixed(3)} ${baseline.toFixed(3)}) scale(${scale.toFixed(4)} ${(-scale).toFixed(4)})`
                    : `translate(${pen.toFixed(3)} ${baseline.toFixed(3)}) scale(${scale.toFixed(4)})`;
                // The stroke sits inside a transform, so without vector-effect it would shrink to
                // nothing. Keeping it at 1 also means the server reads the drawn width it should
                // when it crops the uploaded drawing to its ink.
                paths.push(`<path d="${glyph.d}" stroke-width="1" vector-effect="non-scaling-stroke" transform="${transform}"/>`);
            }
            pen += glyph.advance * fontSize;
        }
        widest = Math.max(widest, pen);
    });

    const width = Math.max(widest, fontSize) + fontSize * PADDING * 2;
    const height = font.ascent * fontSize + (lines.length - 1) * fontSize * LINE_HEIGHT
        + fontSize * (1 - font.ascent) + fontSize * PADDING * 2;

    // fill="none" so the preview shows what the pen will draw: single strokes for the Line fonts,
    // letter outlines for the rest.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}"`
        + ` width="${width.toFixed(2)}" height="${height.toFixed(2)}">`
        + `<g fill="none" stroke="#000000">${paths.join('')}</g>`
        + `</svg>`;
};

export default textToSvg;
