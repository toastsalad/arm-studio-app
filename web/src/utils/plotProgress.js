/**
 * How much of a generated drawing has actually been plotted.
 *
 * Everything here is pure: no three.js, no redux. The hard part of "turn the drawn part red" is not the
 * colour, it is agreeing with the sender about which line is which - so that arithmetic lives on its own
 * and is tested on its own.
 *
 * The sender drops blank lines and lines that begin with a comment before it counts `sent`
 * (server/src/gcode/gcodeSender.js), and the bridge counts a job's lines by the same rule, so every
 * conversion here uses that one definition of "executable".
 */

export const isExecutableLine = (line) => {
    const trimmed = String(line).trim();
    return trimmed.length > 0 && trimmed.indexOf(';') !== 0;
};

export const executableLines = (gcode) => String(gcode).split('\n').filter(isExecutableLine);

/**
 * For each toolpath line, how many executable G-code lines came before it.
 *
 * The emitter writes exactly one G-code line per toolpath line (a blank for a spacer, a `;` comment for a
 * comment), so the two indexes line up one for one and this is just a running count over the gcode text.
 * A toolpath line that emits a comment gets the same ordinal as the line after it: nothing executable
 * happened in between.
 */
export const execOrdinalOfToolPathLine = (gcode) => {
    const ordinals = [];
    let count = 0;
    for (const line of String(gcode).split('\n')) {
        ordinals.push(count);
        if (isExecutableLine(line)) count += 1;
    }
    return ordinals;
};

/**
 * How many segments of a rendered toolpath are on paper once `drawn` executable lines have gone out.
 *
 * `toolPathLineOfSegment` is non-decreasing (the renderer emits segments in path order) and `execOrdinal`
 * is non-decreasing by construction, so this is a binary search rather than a scan: it runs on every
 * progress event, on drawings with six figures of segments.
 */
export const drawnSegments = (toolPathLineOfSegment, execOrdinal, drawn) => {
    if (!toolPathLineOfSegment || !execOrdinal || !(drawn > 0)) return 0;
    let lo = 0;
    let hi = toolPathLineOfSegment.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const toolPathLine = toolPathLineOfSegment[mid];
        const ordinal = toolPathLine < execOrdinal.length ? execOrdinal[toolPathLine] : Number.MAX_SAFE_INTEGER;
        if (ordinal < drawn) lo = mid + 1;
        else hi = mid;
    }
    return lo;
};

/**
 * Each model's slice of the assembled job, in executable-line space.
 *
 * The job is the models' G-code joined together, and `sent` counts from the top of the job, so a model
 * needs its own offset before it can say how much of itself is drawn.
 */
export const modelLineRanges = (gcodePerModel) => {
    const ranges = [];
    let startLine = 0;
    for (const gcode of gcodePerModel) {
        const lineCount = executableLines(gcode).length;
        ranges.push({startLine, lineCount});
        startLine += lineCount;
    }
    return ranges;
};

/** How many of a model's own executable lines are drawn, given the job-wide count. */
export const drawnForModel = (sentGlobal, {startLine, lineCount}) => {
    const drawn = Math.floor(sentGlobal - startLine);
    if (!Number.isFinite(drawn) || drawn <= 0) return 0;
    return Math.min(drawn, lineCount);
};
