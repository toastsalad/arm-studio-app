import THREE from 'three-math';
import { dist2 } from './Utils.js';

function updateShapeBoundingBox(shape) {
    const boundingBox = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
    };

    for (const path of shape.paths) {
        for (const point of path.points) {
            boundingBox.minX = Math.min(boundingBox.minX, point[0]);
            boundingBox.maxX = Math.max(boundingBox.maxX, point[0]);
            boundingBox.minY = Math.min(boundingBox.minY, point[1]);
            boundingBox.maxY = Math.max(boundingBox.maxY, point[1]);
        }
    }

    shape.boundingBox = boundingBox;
}

function updateSvgBoundingBox(svg) {
    const boundingBox = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
    };

    for (const shape of svg.shapes) {
        updateShapeBoundingBox(shape);
        if (shape.visibility) {
            boundingBox.minX = Math.min(boundingBox.minX, shape.boundingBox.minX);
            boundingBox.maxX = Math.max(boundingBox.maxX, shape.boundingBox.maxX);
            boundingBox.minY = Math.min(boundingBox.minY, shape.boundingBox.minY);
            boundingBox.maxY = Math.max(boundingBox.maxY, shape.boundingBox.maxY);
        }
    }

    svg.boundingBox = boundingBox;
    svg.width = svg.boundingBox.maxX - svg.boundingBox.minX;
    svg.height = svg.boundingBox.maxY - svg.boundingBox.minY;
    return svg;
}

export function sortShapes(svg) {
    const shapes = svg.shapes;
    const newShapes = [];

    const used = new Set();
    let from = [0, 0];
    for (let step = 0; step < shapes.length; step++) {
        let closestDistance = Infinity;
        let closest = -1;
        let reverse = false;

        for (let i = 0; i < shapes.length; ++i) {
            const shape = shapes[i];
            if (used.has(i)) {
                continue;
            }

            for (const path of shape.paths) {
                let distance = dist2(path.points[0], from);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    reverse = false;
                    closest = i;
                }

                distance = dist2(path.points[path.points.length - 1], from);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    reverse = true;
                    closest = i;
                }
            }
        }

        const shape = shapes[closest];
        if (reverse) {
            for (let i = 0; i < shape.paths.length; i++) {
                shape.paths[i].points = shape.paths[i].points.reverse();
            }
        }
        from = shape.paths[shape.paths.length - 1].points[0];
        newShapes.push(shape);
        used.add(closest);
    }

    svg.shapes = newShapes;
}

// Flip SVG upside down, in place. flipFlag: 1 vertical, 2 horizontal, 3 both.
export function flip(svg, flipFlag) {
    const y0 = svg.viewBox[1];
    const y1 = svg.viewBox[1] + svg.viewBox[3];
    const x0 = svg.viewBox[0];
    const x1 = svg.viewBox[0] + svg.viewBox[2];
    const { minX, maxX, minY, maxY } = svg.boundingBox;
    for (const shape of svg.shapes) {
        for (const path of shape.paths) {
            for (const point of path.points) {
                switch (flipFlag) {
                    case 1:
                        point[1] = y0 + (y1 - point[1]);
                        break;
                    case 2:
                        point[0] = x0 + (x1 - point[0]);
                        break;
                    case 3:
                        point[0] = x0 + (x1 - point[0]);
                        point[1] = y0 + (y1 - point[1]);
                        break;
                    default:
                        break;
                }
            }
        }
    }

    switch (flipFlag) {
        case 1:
            svg.boundingBox.minY = y0 + (y1 - maxY);
            svg.boundingBox.maxY = y0 + (y1 - minY);
            break;
        case 2:
            svg.boundingBox.minX = x0 + (x1 - maxX);
            svg.boundingBox.maxX = x0 + (x1 - minX);
            break;
        case 3:
            svg.boundingBox.minX = x0 + (x1 - maxX);
            svg.boundingBox.maxX = x0 + (x1 - minX);
            svg.boundingBox.minY = y0 + (y1 - maxY);
            svg.boundingBox.maxY = y0 + (y1 - minY);
            break;
        default:
            break;
    }
    return svg;
}

export function scale(svg, factor) {
    for (const shape of svg.shapes) {
        for (const path of shape.paths) {
            for (const point of path.points) {
                point[0] *= factor.x;
                point[1] *= factor.y;
            }
        }
    }

    svg.viewBox[0] *= factor.x;
    svg.viewBox[1] *= factor.y;
    svg.viewBox[2] *= factor.x;
    svg.viewBox[3] *= factor.y;

    return updateSvgBoundingBox(svg);
}

export function clip(svg) {
    for (const shape of svg.shapes) {
        for (const path of shape.paths) {
            for (const point of path.points) {
                point[0] -= svg.boundingBox.minX;
                point[1] -= svg.boundingBox.minY;
            }
        }
    }
    svg.viewBox[0] = 0;
    svg.viewBox[1] = 0;
    svg.viewBox[2] = svg.boundingBox.maxX - svg.boundingBox.minX;
    svg.viewBox[3] = svg.boundingBox.maxY - svg.boundingBox.minY;

    return updateSvgBoundingBox(svg);
}

// Assumes the upper 3x3 of the matrix is a pure translation/rotation (no scale).
export function applyMatrix4(svg, matrix) {
    const elements = matrix.elements;

    for (const shape of svg.shapes) {
        for (const path of shape.paths) {
            for (const point of path.points) {
                const x = point[0];
                const y = point[1];
                point[0] = elements[0] * x + elements[4] * y + elements[12];
                point[1] = elements[1] * x + elements[5] * y + elements[13];
            }
        }
    }

    const x0 = svg.viewBox[0];
    const x1 = svg.viewBox[0] + svg.viewBox[2];
    const y0 = svg.viewBox[1];
    const y1 = svg.viewBox[1] + svg.viewBox[3];
    const corners = [[x0, y0], [x0, y1], [x1, y0], [x1, y1]];
    for (let i = 0; i < 4; i++) {
        const x = corners[i][0], y = corners[i][1];
        corners[i][0] = elements[0] * x + elements[4] * y + elements[12];
        corners[i][1] = elements[1] * x + elements[5] * y + elements[13];
    }

    svg.viewBox[0] = Math.min(...corners.map(corner => corner[0]));
    svg.viewBox[1] = Math.min(...corners.map(corner => corner[1]));
    svg.viewBox[2] = Math.max(...corners.map(corner => corner[0])) - svg.viewBox[0];
    svg.viewBox[3] = Math.max(...corners.map(corner => corner[1])) - svg.viewBox[1];

    return updateSvgBoundingBox(svg);
}

export function translate(svg, x, y) {
    const move = new THREE.Matrix4().makeTranslation(x, y, 0);
    applyMatrix4(svg, move);
    return svg;
}

// Rotate SVG counter-clockwise by the given radians.
export function rotate(svg, radian) {
    const rotation = new THREE.Euler(0, 0, radian);
    const anchorPoint = [svg.viewBox[0] + svg.viewBox[2] * 0.5, svg.viewBox[1] + svg.viewBox[3] * 0.5];

    const move1 = new THREE.Matrix4().makeTranslation(-anchorPoint[0], -anchorPoint[1], 0);
    applyMatrix4(svg, move1);

    const rotationMatrix = new THREE.Matrix4().makeRotationFromEuler(rotation);
    applyMatrix4(svg, rotationMatrix);

    const move2 = new THREE.Matrix4().makeTranslation(anchorPoint[0], anchorPoint[1], 0);
    applyMatrix4(svg, move2);

    return svg;
}
