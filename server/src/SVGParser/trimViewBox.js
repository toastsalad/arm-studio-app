/**
 * Crop an SVG's viewBox down to the artwork it actually holds.
 *
 * Imported drawings usually declare a fixed canvas - a plotter bed, a sheet of paper - and the
 * artwork covers only part of it. Everything downstream followed that declared box: the texture,
 * the plane the model sits on, the drag handles around it, and the scale the plotter used. Crop
 * the viewBox to the ink and all of those follow the drawing instead.
 *
 * `parsed` is what SVGParser#parseFile returns: the visible shapes' bounding box plus the
 * document's width, height and viewBox, all in the parser's own scaled space.
 *
 * Returns {svg, width, height} in user units, or null when there is nothing worth cropping.
 */

const getAttr = (tag, name) => {
    const match = new RegExp(name + "\\s*=\\s*[\"']([^\"']*)[\"']", 'i').exec(tag);
    return match ? match[1] : null;
};

const setAttr = (tag, name, value) => {
    const re = new RegExp('\\s' + name + '\\s*=\\s*"[^"]*"');
    return re.test(tag) ? tag.replace(re, ` ${name}="${value}"`) : tag.replace(/<svg/i, `<svg ${name}="${value}"`);
};

// "180mm" -> 180 and "mm", so a rewritten attribute stays in the author's unit.
const splitUnit = (raw) => {
    const match = /^\s*(-?[\d.]+(?:e-?\d+)?)\s*([a-z%]*)\s*$/i.exec(raw || '');
    if (!match) return null;
    const value = parseFloat(match[1]);
    return isFinite(value) ? {value, unit: match[2]} : null;
};

const round = (value) => Math.round(value * 1000) / 1000;

// Half a stroke hangs outside the geometry the bounding box measures, so it has to stay in frame.
const widestStroke = (shapes) => {
    let widest = 0;
    for (const shape of shapes || []) {
        if (shape.visibility && isFinite(shape.strokeWidth)) widest = Math.max(widest, shape.strokeWidth);
    }
    return widest;
};

export const trimViewBoxToContent = (svg, parsed) => {
    const tagMatch = /<svg\b[^>]*>/i.exec(svg);
    if (!tagMatch) return null;
    const tag = tagMatch[0];

    const rawViewBox = getAttr(tag, 'viewBox');
    if (!rawViewBox) return null;
    const viewBox = rawViewBox.split(/[\s,]+/).map(Number);
    if (viewBox.length !== 4 || viewBox.some((value) => !isFinite(value)) || !viewBox[2] || !viewBox[3]) return null;

    // Undo the parser's scaling, so the crop is expressed in the document's own units.
    const scaleX = parsed.width / viewBox[2];
    const scaleY = parsed.height / viewBox[3];
    if (!isFinite(scaleX) || !isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) return null;

    const {minX, minY, maxX, maxY} = parsed.boundingBox || {};
    if (![minX, minY, maxX, maxY].every(isFinite) || maxX <= minX || maxY <= minY) return null;

    const pad = widestStroke(parsed.shapes) / 2;
    const x = minX / scaleX - pad;
    const y = minY / scaleY - pad;
    const width = (maxX - minX) / scaleX + pad * 2;
    const height = (maxY - minY) / scaleY + pad * 2;

    const unchanged = Math.abs(x - viewBox[0]) < 1e-6 && Math.abs(y - viewBox[1]) < 1e-6
        && Math.abs(width - viewBox[2]) < 1e-6 && Math.abs(height - viewBox[3]) < 1e-6;
    if (unchanged) return null;

    let cropped = setAttr(tag, 'viewBox', `${round(x)} ${round(y)} ${round(width)} ${round(height)}`);

    // Keep the declared units, scaled to the cropped box, so the document still measures the same
    // number of millimetres per unit as it did before.
    const widthAttr = splitUnit(getAttr(tag, 'width'));
    const heightAttr = splitUnit(getAttr(tag, 'height'));
    if (widthAttr) cropped = setAttr(cropped, 'width', `${round(width / viewBox[2] * widthAttr.value)}${widthAttr.unit}`);
    if (heightAttr) cropped = setAttr(cropped, 'height', `${round(height / viewBox[3] * heightAttr.value)}${heightAttr.unit}`);

    return {
        svg: svg.replace(tag, cropped),
        // Back in the parser's own space, which is what the client already expects for an image.
        width: width * scaleX,
        height: height * scaleY,
    };
};

export default trimViewBoxToContent;
