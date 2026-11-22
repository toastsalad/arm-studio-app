import BaseTagParser from './BaseTagParser.js';


class CircleTagParser extends BaseTagParser {
    parse(node, attributes) {
        this.initialize(attributes);

        const cx = attributes.cx || 0;
        const cy = attributes.cy || 0;
        const radius = attributes.r || 0;

        if (radius > 0) {
            this.moveTo(cx - radius, cy);
            this.arcTo(cx - radius, cy, radius, radius, 0, 0, 0, cx, cy + radius);
            this.arcTo(cx, cy + radius, radius, radius, 0, 0, 0, cx + radius, cy);
            this.arcTo(cx + radius, cy, radius, radius, 0, 0, 0, cx, cy - radius);
            this.arcTo(cx, cy - radius, radius, radius, 0, 0, 0, cx - radius, cy);

            this.commitPath(true);
        }

        return this.createShape();
    }
}

export default CircleTagParser;
