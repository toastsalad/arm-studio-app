import * as THREE from 'three';
import {STLLoader} from 'three/examples/jsm/loaders/STLLoader.js';
import {OBJLoader} from 'three/examples/jsm/loaders/OBJLoader.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const SUPPORT_FORMATS = ['.stl', '.obj'];

class ModelLoader {
    load (modelPath, onLoad, onProgress, onError) {
        // to fix bug: get firstly uploaded model when load different files with the same filename
        THREE.Cache.clear();
        const match = modelPath.match(/\.[^.\/\\]+$/);
        const format = (match ? match[0] : '').toLowerCase();
        if (!ModelLoader.isFormatSupport(format)) {
            onError('Unsupported format');
            return;
        }
        if (format === '.stl') {
            this.parseAsStl(modelPath, onLoad, onProgress, onError);
        } else if (format === '.obj') {
            this.parseAsObj(modelPath, onLoad, onProgress, onError);
        }
    }

    static getSupportFormats () {
        return SUPPORT_FORMATS;
    }

    static isFormatSupport(format) {
        for (const item of SUPPORT_FORMATS) {
            if (item === format.toLowerCase()) {
                return true;
            }
        }
        return false;
    }

    parseAsStl(modelPath, onLoad, onProgress, onError) {
        new STLLoader().load(
            modelPath,
            (geometry) => onLoad(geometry),
            (progress) => onProgress(progress),
            (event) => onError(event)
        );
    }

    parseAsObj(modelPath, onLoad, onProgress, onError) {
        new OBJLoader().load(
            modelPath,
            (container) => {
                // An OBJ container holds several meshes. Merge their positions into
                // one BufferGeometry and recompute the normals.
                const positions = [];
                container.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.geometry && child.geometry.getAttribute('position')) {
                        const src = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry;
                        positions.push(src.getAttribute('position'));
                    }
                });
                if (positions.length === 0) {
                    onError('No mesh found in OBJ file');
                    return;
                }
                const geometries = positions.map((attribute) => {
                    const geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', attribute);
                    return geometry;
                });
                const bufferGeometry = mergeGeometries(geometries, false) || geometries[0];
                bufferGeometry.computeVertexNormals();
                onLoad(bufferGeometry);
            },
            (progress) => onProgress(progress),
            (event) => onError(event)
        );
    }
}

export default ModelLoader;
