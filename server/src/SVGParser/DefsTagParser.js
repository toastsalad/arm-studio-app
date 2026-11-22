import BaseTagParser from './BaseTagParser.js';

class DefsTagParser extends BaseTagParser {
    parse(node, attributes) {
        this.initialize(attributes);

        // Everything inside defs is hidden from the canvas.
        this.attributes.visibility = false;
    }
}

export default DefsTagParser;
