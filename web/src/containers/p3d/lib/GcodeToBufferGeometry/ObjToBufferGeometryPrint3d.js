import * as THREE from 'three';
import isEmpty from 'lodash/isEmpty';
import noop from 'lodash/noop';

const TYPE_SETTINGS = {
    'WALL-INNER': {
        rgb: [0, 255, 0],
        typeCode: 1
    },
    'WALL-OUTER': {
        rgb: [255, 33, 33],
        typeCode: 2
    },
    'SKIN': {
        rgb: [255, 255, 0],
        typeCode: 3
    },
    'SKIRT': {
        rgb: [250, 140, 53],
        typeCode: 4
    },
    'SUPPORT': {
        rgb: [75, 0, 130],
        typeCode: 5
    },
    'FILL': {
        rgb: [141, 75, 187],
        typeCode: 6
    },
    'TRAVEL': {
        rgb: [68, 206, 246],
        typeCode: 7
    },
    'UNKNOWN': {
        rgb: [75, 0, 130],
        typeCode: 8
    }
};

class ObjToBufferGeometryPrint3d {
    // Note: y and z are swapped on the way out.
    parse(gcodeObj, onParsed = noop, onProgress = noop, onError = noop) {
        if (isEmpty(gcodeObj)) {
            onError(new Error('gcodeObj is empty'));
            return;
        }

        const { points } = gcodeObj;

        if (isEmpty(points)) {
            onError(new Error('points of gcodeObj is empty'));
            return;
        }

        let layerCount = 0;
        const colors = [];
        const positions = [];
        const layerIndices = [];
        const typeCodes = [];

        const firstPoint = points[0];
        const firstTypeCode = firstPoint[3];
        const firstTypeSetting = this.getTypeSetting(firstTypeCode);

        let layerIndex = 1;
        let height = firstPoint[2];
        let lastTypeCode = firstTypeCode;

        if (!firstPoint[0]) {
            firstPoint[0] = 0;
        }
        if (!firstPoint[2]) {
            firstPoint[2] = 0;
        }
        if (!firstPoint[1]) {
            firstPoint[1] = 0;
        }

        positions.push(firstPoint[0]);
        positions.push(firstPoint[2]);
        positions.push(-firstPoint[1]);

        colors.push(firstTypeSetting.rgb[0]);
        colors.push(firstTypeSetting.rgb[1]);
        colors.push(firstTypeSetting.rgb[2]);

        layerIndices.push(layerIndex);
        typeCodes.push(firstTypeCode);
        let progress = 0;
        const pointsLength = points.length;
        for (let i = 1; i < pointsLength; i++) {
            const point = points[i];
            const typeCode = point[3];

            // A height change starts a new layer.
            if (height !== point[2]) {
                height = point[2];
                ++layerIndex;
            }

            const typeSetting = this.getTypeSetting(typeCode);
            const rgb = [
                typeSetting.rgb[0],
                typeSetting.rgb[1],
                typeSetting.rgb[2]
            ];

            // When the type changes, repeat the last position with the new colour so the segment
            // before it is not interpolated into the new one.
            if (lastTypeCode !== typeCode) {
                lastTypeCode = typeCode;

                const lastZ = positions[positions.length - 1];
                const lastY = positions[positions.length - 2];
                const lastX = positions[positions.length - 3];
                positions.push(lastX);
                positions.push(lastY);
                positions.push(lastZ);

                colors.push(rgb[0]);
                colors.push(rgb[1]);
                colors.push(rgb[2]);

                layerIndices.push(layerIndex);
                typeCodes.push(typeCode);
            }

            positions.push(point[0]);
            positions.push(point[2]);
            positions.push(-point[1]);

            colors.push(rgb[0]);
            colors.push(rgb[1]);
            colors.push(rgb[2]);

            layerIndices.push(layerIndex);
            typeCodes.push(typeCode);

            const curProgress = i / pointsLength;
            if ((curProgress - progress > 0.01)) {
                progress = curProgress;
                onProgress(progress);
            }
        }

        layerCount = layerIndex;
        onProgress(1);

        const bufferGeometry = new THREE.BufferGeometry();
        const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
        const colorAttribute = new THREE.Uint8BufferAttribute(colors, 3);
        // this will map the buffer values to 0.0f - +1.0f in the shader
        colorAttribute.normalized = true;
        const layerIndexAttribute = new THREE.Float32BufferAttribute(layerIndices, 1);
        const typeCodeAttribute = new THREE.Float32BufferAttribute(typeCodes, 1);

        bufferGeometry.setAttribute('position', positionAttribute);
        bufferGeometry.setAttribute('a_color', colorAttribute);
        bufferGeometry.setAttribute('a_layer_index', layerIndexAttribute);
        bufferGeometry.setAttribute('a_type_code', typeCodeAttribute);

        onParsed(bufferGeometry, layerCount);
    }

    getTypeSetting(typeCode) {
        for (const key of Object.keys(TYPE_SETTINGS)) {
            if (TYPE_SETTINGS[key].typeCode === typeCode) {
                return TYPE_SETTINGS[key];
            }
        }
        // A ;TYPE: value the map does not know about must not crash the preview.
        return TYPE_SETTINGS.UNKNOWN;
    }
}

export default ObjToBufferGeometryPrint3d;
