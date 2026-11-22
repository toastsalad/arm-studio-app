import { xformMultiply } from './Utils.js';
import BaseTagParser from './BaseTagParser.js';

// The svg element; see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/svg
class SVGTagParser extends BaseTagParser {
    initialize(attributes) {
        super.initialize(attributes);

        if (attributes.width && attributes.height && !attributes.viewBox) {
            attributes.viewBox = [0, 0, attributes.width, attributes.height];
        }

        if (attributes.width && !attributes.height) {
            const scale = attributes.width / attributes.viewBox[2];
            attributes.height = attributes.viewBox[3] * scale;
        }

        if (!attributes.width && attributes.height) {
            const scale = attributes.height / attributes.viewBox[3];
            attributes.width = attributes.viewBox[2] * scale;
        }

        if (!attributes.width && !attributes.height) {
            attributes.width = attributes.viewBox[2];
            attributes.height = attributes.viewBox[3];
        }
    }

    parse(node, attributes) {
        this.initialize(attributes);

        // x and y move the coordinate system, but not on the outermost svg element.
        if (attributes.x) {
            xformMultiply(this.attributes.xform, [1, 0, 0, 1, attributes.x, 0]);
        }
        if (attributes.y) {
            xformMultiply(this.attributes.xform, [1, 0, 0, 1, 0, attributes.y]);
        }

        const scaleX = attributes.width / attributes.viewBox[2];
        const scaleY = attributes.height / attributes.viewBox[3];

        xformMultiply(this.attributes.xform, [scaleX, 0, 0, scaleY, 0, 0]);

        attributes.viewBox[0] *= scaleX;
        attributes.viewBox[1] *= scaleY;
        attributes.viewBox[2] *= scaleX;
        attributes.viewBox[3] *= scaleY;
    }
}

export default SVGTagParser;
