const TOKEN_COMMENT = 'C';
const TOKEN_EMPTY_LINE = 'N';

// Parses a toolpath string into one object per G-code line, keeping comments and blank lines:
//   "G0 X1 Y2 Z3 ;move"  ->  {G: 0, X: 1, Y: 2, Z: 3, C: ";move"}
const toolPathStr2toolPathLines = (toolPathStr) => {
    const objLines = [];
    const strLines = toolPathStr.split('\n');
    for (let i = 0; i < strLines.length; i++) {
        const strLine = strLines[i].trim().replace(/\s+/g, " ");
        if (strLine.length === 0) {
            objLines.push({[TOKEN_EMPTY_LINE]: ""});
            continue;
        }
        const objLine = {};
        let comment = null;
        let cmdData = null;

        // Cannot split on ';': comments may contain it.
        const commentIndex = strLine.indexOf(';');
        if (commentIndex !== -1) {
            cmdData = strLine.substring(0, commentIndex);
            comment = strLine.substring(commentIndex);
        } else {
            cmdData = strLine;
        }

        comment && (objLine[TOKEN_COMMENT] = comment);
        if (cmdData) {
            const tokens = cmdData.trim().split(' ');
            for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
                const token = tokens[tokenIndex];
                const cmdType = token.substring(0, 1);
                let value = parseFloat(token.substring(1, token.length));

                // The value may be a placeholder string, e.g. F#jog_speed#.
                if (Number.isNaN(value)) {
                    value = token.substring(1, token.length);
                }

                objLine[cmdType] = value;
            }
        }

        objLines.push(objLine);
    }
    return objLines;
};

export default toolPathStr2toolPathLines;
