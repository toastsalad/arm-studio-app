// Turn parsed toolpath lines into G-code text. Shared by the laser and write & draw emitters,
// which differ only in how they resolve the command values (power, dwell, pen up/down).
//
// `resolveCommand(key, value)` returns the replacement command strings, an empty array to drop
// the command, or null to emit `key + value` unchanged.
export const toolPathLinesToGcode = (toolPathLines, {translateX, translateY, advance, resolveCommand}) => {
    const gcodeLines = [];

    for (let i = 0; i < toolPathLines.length; i++) {
        const lineObj = toolPathLines[i];
        let line = '';
        const cmds = [];
        let comment = null;
        let isEmptyLine = false;

        // lineObj: {G, X, Y, C, F}; comments go last, X/Y are re-based and placeholders resolved.
        Object.keys(lineObj).forEach((key) => {
            let value = lineObj[key];
            switch (key) {
                case 'C':
                    comment = value;
                    break;
                case 'N':
                    isEmptyLine = true;
                    break;
                case 'X':
                    value = (value + translateX).toFixed(2);
                    // Advance mode replaces X with E.
                    cmds.push(`${advance ? 'E' : key}` + value);
                    break;
                case 'Y':
                    value = (value + translateY).toFixed(2);
                    cmds.push(key + value);
                    break;
                default: {
                    const resolved = resolveCommand(key, value);
                    if (resolved === null) cmds.push(key + value);
                    else cmds.push(...resolved);
                }
            }
        });

        if (isEmptyLine) {
            gcodeLines.push("\n");
            continue;
        }

        cmds.length > 0 && (line = cmds.join(' '));
        comment && (line += comment);
        gcodeLines.push(line);
    }

    return gcodeLines.join('\n') + '\n';
};
