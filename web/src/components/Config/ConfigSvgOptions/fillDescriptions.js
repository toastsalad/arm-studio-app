// One line per fill style: what the pattern actually is, for the tooltip on its swatch.
//
// Kept as a module rather than in the settings JSON because the same list is shown on three tabs (SVG, trace,
// image) whose settings files would each have to carry a copy, and because the text is about the algorithms
// rather than about any one panel's configuration. scripts/check-fill-styles.mjs checks that this map and the
// engine's style list agree, so a new fill cannot ship without a tooltip.
const FILL_DESCRIPTIONS = {
    parallel: 'Straight lines across the shape, at the hatch angle.',
    wave: 'Sine-wave lines, so the hatching reads as a soft texture.',
    concentric: 'Nested rings inset from the outline, following every corner and hole.',
    contourspiral: 'One continuous spiral wound inward from the outline, one pen lift per shape.',
    spiral: 'A single Archimedean spiral growing out from the centre.',
    squarespiral: 'A right-angle coil winding in towards the middle.',
    serpentine: 'One zig-zag stroke swept across the shape, joined at the ends so the pen stays down.',
    fermat: 'A Fermat spiral: turns spread apart as they go out, so spacing stays even.',
    moire: 'Two line families overlaid at slightly different angles, for their interference pattern.',
    hexlattice: 'Three line families on a hexagonal grid, giving a woven look.',
    engrave: 'Cross-hatched grid, adding passes where the drawing is dark, so the tone comes from the grid.',
    hilbert: 'One Hilbert curve: a single line that fills the shape without crossing itself.',
    peano: 'One Peano curve: like Hilbert, but dividing each step into nine instead of four.',
    gosper: 'The Gosper flowsnake: a single hexagonal space-filling curve.',
    dragon: 'The dragon curve tiled: mirror-image copies cover the shape, so the corners fill.',
    truchet: 'Quarter-circle tiles at random rotations, making arcs that flow across the shape.',
    shade: 'A hatch grid thinned by an image: where the picture is dark, more of the grid is inked.',
    stipple: 'Dots scattered in proportion to an image, so darker areas get more of them.',
    scribble: 'A short wandering stroke in each cell, longer and more frequent where the image is dark.',
};

export default FILL_DESCRIPTIONS;

/** The tooltip for a style: its description, else its label. */
export const fillDescription = (key, labels) => FILL_DESCRIPTIONS[key] ?? (labels ? labels[key] : key);
