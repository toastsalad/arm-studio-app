const computeBoundary = (toolPathLines, settings) => {
    let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE;
    let maxX = -Number.MAX_VALUE, maxY = -Number.MAX_VALUE;

    for (let i = 0; i < toolPathLines.length; i++) {
        const line = toolPathLines[i];
        if (line.X !== undefined) {
            minX = Math.min(line.X, minX);
            maxX = Math.max(line.X, maxX);
        }
        if (line.Y !== undefined) {
            minY = Math.min(line.Y, minY);
            maxY = Math.max(line.Y, maxY);
        }
    }

    const {x, y} = settings.transformation.children;
    const translateX = x.default_value;
    const translateY = y.default_value;
    minX += translateX;
    maxX += translateX;
    minY += translateY;
    maxY += translateY;
    return {minX, maxX, minY, maxY};
};

export {computeBoundary};
