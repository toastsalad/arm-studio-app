import {STLExporter} from 'three/examples/jsm/exporters/STLExporter.js';
import {OBJExporter} from 'three/examples/jsm/exporters/OBJExporter.js';

class ModelExporter {
    parse (object3d, format = 'stl', isBinary = true) {
        if (!format) {
            return null;
        }
        if (!object3d) {
            return null;
        }
        if (!['stl', 'obj'].includes(format)) {
            return null;
        }
        if (format === 'stl') {
            if (isBinary) {
                return this.parseToBinaryStl(object3d);
            } else {
                return this.parseToAsciiStl(object3d);
            }
        } else if (format === 'obj') {
            return this.parseToObj(object3d);
        }
        return null;
    }
    parseToAsciiStl (object3d) {
        return this._parseStl(object3d, false);
    }
    parseToBinaryStl (object3d) {
        return this._parseStl(object3d, true);
    }
    _parseStl (object3d, binary) {
        // two things have to be undone for the exported STL to line up with the view and the
        // g-code: three's STLExporter is Z-up (so rotate +90 about X), and it reads the parent's
        // matrixWorld, which carries the view transform that the g-code render will apply again.
        const view = object3d.parent;
        const saved = view ? {
            position: view.position.clone(),
            quaternion: view.quaternion.clone(),
            scale: view.scale.clone()
        } : null;
        if (view) {
            view.position.set(0, 0, 0);
            view.quaternion.identity();
            view.scale.set(1, 1, 1);
            view.updateMatrixWorld(true);
        }
        object3d.rotation.x += Math.PI / 2;
        object3d.updateMatrixWorld(true);
        try {
            return binary
                ? new STLExporter().parse(object3d, {binary: true})
                : new STLExporter().parse(object3d);
        } finally {
            object3d.rotation.x -= Math.PI / 2;
            if (view && saved) {
                view.position.copy(saved.position);
                view.quaternion.copy(saved.quaternion);
                view.scale.copy(saved.scale);
                view.updateMatrixWorld(true);
            }
            object3d.updateMatrixWorld(true);
        }
    }
    parseToObj (object3d) {
        return new OBJExporter().parse(object3d);
    }
}

export default ModelExporter;
