/**
 * Parsers for the lines the arm's firmware writes back.
 *
 * The position reply -- `X:1.00 Y:2.00 Z:3.00 E:0.00`, spaces between the axes, E optional -- was
 * parsed twice, once on each side of the socket, with two different sets of guards. The server
 * checked that a Y and a Z were present; the browser did not, so a reply that carried X alone threw
 * a TypeError out of a reducer. One parser, so the guards cannot drift again.
 */

const AXIS = /^([XYZEF]):(-?(?:\d+(?:\.\d*)?|\.\d+))$/i;

/**
 * Read the axes out of a position reply.
 *
 * Returns `{x, y, z, e}` where `e` is undefined when the firmware does not report it, or `null`
 * when the line is not a position reply at all -- so a caller waiting for one can keep looking
 * instead of taking some other line for a coordinate.
 */
export const parsePositionReply = (line) => {
    if (typeof line !== 'string') return null;

    const axes = {};
    for (const part of line.trim().split(/\s+/)) {
        const match = AXIS.exec(part);
        if (!match) continue;
        const value = Number(match[2]);
        if (!Number.isFinite(value)) continue;
        axes[match[1].toUpperCase()] = value;
    }

    // A position reply carries all three axes. Anything less is a fragment, and taking it would
    // move the tracked position on no evidence.
    if (axes.X === undefined || axes.Y === undefined || axes.Z === undefined) return null;

    return {x: axes.X, y: axes.Y, z: axes.Z, e: axes.E};
};

export default parsePositionReply;
