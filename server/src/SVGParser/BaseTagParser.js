import { dist2, vertexMiddle, xformPoint } from './Utils.js';


class BaseTagParser {
    constructor(tol) {
        this.tol = tol;
    }

    initialize(attributes = {}) {
        this.attributes = attributes;

        this.points = [];

        this.paths = [];
    }

    moveTo(x, y) {
        if (this.points.length > 0) {
            this.points[this.points.length - 1] = [x, y];
        } else {
            this.points.push([x, y]);
        }
    }

    lineTo(x, y) {
        if (this.points.length > 0) {
            this.points.push([x, y]);
        }
    }

    // Adaptive DeCasteljau subdivision; see http://www.antigrain.com/research/adaptive_bezier/index.html
    cubicBezTo(x1, y1, x2, y2, x3, y3, x4, y4, level) {
        if (level > 18) {
            // Protect from deep recursion: max 2**18 = 262144 segments.
            return;
        }

        const x12 = (x1 + x2) / 2.0;
        const y12 = (y1 + y2) / 2.0;
        const x23 = (x2 + x3) / 2.0;
        const y23 = (y2 + y3) / 2.0;
        const x34 = (x3 + x4) / 2.0;
        const y34 = (y3 + y4) / 2.0;
        const x123 = (x12 + x23) / 2.0;
        const y123 = (y12 + y23) / 2.0;
        const x234 = (x23 + x34) / 2.0;
        const y234 = (y23 + y34) / 2.0;
        const x1234 = (x123 + x234) / 2.0;
        const y1234 = (y123 + y234) / 2.0;

        const dx = x4 - x1;
        const dy = y4 - y1;

        const d2 = Math.abs(((x2 - x4) * dy - (y2 - y4) * dx));
        const d3 = Math.abs(((x3 - x4) * dy - (y3 - y4) * dx));

        if ((d2 + d3) ** 2 < 5.0 * this.tol * this.tol * (dx * dx + dy * dy)) {
            // Factor 5.0 matches the circle resolution.
            this.lineTo(x1234, y1234);
            return;
        }

        this.cubicBezTo(x1, y1, x12, y12, x123, y123, x1234, y1234, level + 1);
        this.cubicBezTo(x1234, y1234, x234, y234, x34, y34, x4, y4, level + 1);
    }

    // https://github.com/tmpvar/svgmill/blob/master/SVGReader.js#L925
    quadBezTo(x1, y1, x2, y2, x3, y3, level) {
        if (level > 18) {
            // Protect from deep recursion: max 2**18 = 262144 segments.
            return;
        }

        const x12 = (x1 + x2) / 2.0;
        const y12 = (y1 + y2) / 2.0;
        const x23 = (x2 + x3) / 2.0;
        const y23 = (y2 + y3) / 2.0;
        const x123 = (x12 + x23) / 2.0;
        const y123 = (y12 + y23) / 2.0;

        const dx = x3 - x1;
        const dy = y3 - y1;
        const deviation = Math.abs(((x2 - x3) * dy - (y2 - y3) * dx));

        if (deviation * deviation <= 5.0 * this.tol * this.tol * (dx * dx + dy * dy)) {
            // Factor 5.0 matches the circle resolution.
            this.lineTo(x123, y123);
            return;
        }

        this.quadBezTo(x1, y1, x12, y12, x123, y123, level + 1);
        this.quadBezTo(x123, y123, x23, y23, x3, y3, level + 1);
    }

    // http://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
    arcTo(x1, y1, rx, ry, phi, large, sweep, x2, y2) {
        const cosAngle = Math.cos(phi);
        const sinAngle = Math.sin(phi);

        const dx = x1 - x2;
        const dy = y1 - y2;

        const x1p = cosAngle * dx / 2 + sinAngle * dy / 2;
        const y1p = -sinAngle * dx / 2 + cosAngle * dy / 2;
        const scale = (x1p / rx) ** 2 + (y1p / ry) ** 2;
        if (scale > 1) {
            rx *= Math.sqrt(scale);
            ry *= Math.sqrt(scale);
        }

        let sign = 0;
        const radicand = ((rx * ry) ** 2 - (rx * y1p) ** 2 - (ry * x1p) ** 2);
        const divisor = ((rx * y1p) ** 2 + (ry * x1p) ** 2);
        if (divisor > 0) {
            sign = Math.sqrt(radicand / divisor);
        }
        if (large === sweep) {
            sign = -sign;
        }
        const cxp = sign * rx * y1p / ry;
        const cyp = -sign * ry * x1p / rx;

        const cx = cosAngle * cxp - sinAngle * cyp + 0.5 * (x1 + x2);
        const cy = sinAngle * cxp + cosAngle * cyp + 0.5 * (y1 + y2);

        function vectorCosine(ux, uy, vx, vy) {
            const cosine = (ux * vx + uy * vy)
                / Math.sqrt(ux ** 2 + uy ** 2)
                * Math.sqrt(vx ** 2 + vy ** 2);

            return Math.max(Math.min(cosine, 1), -1);
        }

        function vectorAngle(ux, uy, vx, vy) {
            const angle = Math.acos(vectorCosine(ux, uy, vx, vy));
            return (ux * vy > vx * uy ? 1 : -1) * angle;
        }

        const ux = (x1p - cxp) / rx;
        const uy = (y1p - cyp) / ry;
        const vx = (-x1p - cxp) / rx;
        const vy = (-y1p - cyp) / ry;

        const startAngle = vectorAngle(1, 0, ux, uy);
        let deltaAngle = vectorAngle(ux, uy, vx, vy);

        if (sweep && deltaAngle < 0) {
            deltaAngle += Math.PI * 2;
        }
        if (!sweep && deltaAngle > 0) {
            deltaAngle -= Math.PI * 2;
        }

        function getVertex(fraction) {
            const theta = startAngle + deltaAngle * fraction;
            const cosTheta = Math.cos(theta);
            const sinTheta = Math.sin(theta);
            return [
                cosAngle * rx * cosTheta - sinAngle * ry * sinTheta + cx,
                sinAngle * rx * cosTheta + cosAngle * ry * sinTheta + cy
            ];
        }

        const recursiveArc = (from, to, start, end, level) => {
            if (level > 18) {
                // Protect from deep recursion: max 2**18 = 262144 segments.
                return;
            }
            const range = to - from;
            const middle = from + 0.5 * range;
            const atQuarter = getVertex(from + 0.25 * range);
            const atMiddle = getVertex(middle);
            const atThreeQuarters = getVertex(from + 0.75 * range);

            if (dist2(atQuarter, vertexMiddle(start, atMiddle)) > this.tol * this.tol) {
                recursiveArc(from, middle, start, atMiddle, level + 1);
            }

            this.lineTo(atMiddle[0], atMiddle[1]);

            if (dist2(atThreeQuarters, vertexMiddle(atMiddle, end)) > this.tol * this.tol) {
                recursiveArc(middle, to, atMiddle, end, level + 1);
            }
        };

        const start = getVertex(0.0);
        const end = getVertex(1.0);
        recursiveArc(0.0, 1.0, start, end, 0);
        this.lineTo(end[0], end[1]);
    }

    commitPath(closed = false) {
        if (this.points.length > 0) {
            this.addPath(closed);
            this.points = [];
        }
        this.closed = false;
    }

    addPath(closed) {
        if (this.points.length < 2) {
            return;
        }

        const firstPoint = this.points[0];
        const lastPoint = this.points[this.points.length - 1];

        if (closed && (lastPoint[0] !== firstPoint[0] || lastPoint[1] !== firstPoint[1])) {
            this.lineTo(firstPoint[0], firstPoint[1]);
        } else if (!closed && lastPoint[0] === firstPoint[0] && lastPoint[1] === firstPoint[1]) {
            // A path whose ends coincide is closed even when the caller did not say so.
            closed = true;
        }

        const path = {
            closed: closed,
            points: this.points
        };

        for (let i = 0, count = this.points.length; i < count; i++) {
            xformPoint(this.attributes.xform, path.points[i]);
        }

        this.paths.push(path);
    }

    createShape() {
        const boundingBox = {
            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity
        };

        for (const path of this.paths) {
            for (const point of path.points) {
                boundingBox.minX = Math.min(boundingBox.minX, point[0]);
                boundingBox.maxX = Math.max(boundingBox.maxX, point[0]);
                boundingBox.minY = Math.min(boundingBox.minY, point[1]);
                boundingBox.maxY = Math.max(boundingBox.maxY, point[1]);
            }
        }

        return {
            fill: this.attributes.fill,
            stroke: this.attributes.stroke,
            strokeWidth: this.attributes.strokeWidth,
            visibility: this.attributes.visibility,
            boundingBox: boundingBox,
            paths: this.paths
        };
    }
}

export default BaseTagParser;
