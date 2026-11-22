/**
 * The region a tone fill is applied to, and its geometry.
 *
 * Kept in its own module because it is arithmetic and a string, and because the bridge that used to hold it
 * pulls in the Electron import chain: nothing that needs a running app should have to be loaded to answer a
 * question about a rectangle.
 */

/**
 * A rectangle covering the drawing: the region a tone fill is applied to.
 *
 * Built rather than derived from the image's own outlines, because the outline is what these fills
 * deliberately ignore. `readGeometry` in loadImage.js sizes a raster to `width x height` document units, so
 * the rectangle matches the image exactly and the engine's tone field maps onto it one to one.
 */
export const frameSvg = (width, height) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}"><path d="M0,0 L${width},0 L${width},${height} L0,${height} Z" ` +
    `fill="none" stroke="black"/></svg>`;

/**
 * The rectangle a turned picture needs, in document units.
 *
 * The engine samples a tone image through the element's axis-aligned bounding box, so a picture turned by the
 * drawing's own rotation is still sampled through a box. Turning the pixels keeps the ink with the picture;
 * the box has to grow to the turned picture's extent or its corners would be cut off. This is the standard
 * extent of a rotated rectangle: |w cos| + |h sin| by |w sin| + |h cos|.
 */
export const toneFrameSize = (width, height, rotationDegrees = 0) => {
    const degrees = ((Number(rotationDegrees) || 0) % 360 + 360) % 360;

    // Quarter turns are exact. They are the values people actually use, and cos(90 degrees) is not 0 in
    // floating point: a 200 by 100 picture would otherwise come back as 200.00000000000003 wide, and every
    // such frame is a different cache key for the turned tone image.
    let cos;
    let sin;
    if (degrees % 90 === 0) {
        const quarterTurns = degrees / 90;
        cos = quarterTurns % 2 === 0 ? 1 : 0;
        sin = quarterTurns % 2 === 0 ? 0 : 1;
    } else {
        const radians = degrees * Math.PI / 180;
        cos = Math.abs(Math.cos(radians));
        sin = Math.abs(Math.sin(radians));
    }

    return {
        width: Math.max(1, width * cos + height * sin),
        height: Math.max(1, width * sin + height * cos),
    };
};
