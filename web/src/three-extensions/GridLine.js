import * as THREE from 'three';

class GridLine {
    group = new THREE.Object3D();

    colorCenterLine = new THREE.Color(0x444444);

    colorGrid = new THREE.Color(0x888888);

    constructor(sizeX, stepX, sizeY, stepY, colorCenterLine, colorGrid) {
        colorCenterLine = new THREE.Color(colorCenterLine) || this.colorCenterLine;
        colorGrid = new THREE.Color(colorGrid) || this.colorGrid;

        sizeY = (typeof sizeY === 'undefined') ? sizeX : sizeY;
        stepY = (typeof stepY === 'undefined') ? stepX : stepY;

        const addLine = (x1, y1, x2, y2, color) => {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(x1, y1, 0),
                new THREE.Vector3(x2, y2, 0),
            ]);
            geometry.setAttribute('color', new THREE.Float32BufferAttribute([
                color.r, color.g, color.b,
                color.r, color.g, color.b,
            ], 3));
            const material = new THREE.LineBasicMaterial({vertexColors: true});
            this.group.add(new THREE.Line(geometry, material));
        };

        for (let x = -1 * sizeX; x <= sizeX; x += stepX) {
            addLine(x, -sizeY, x, sizeY, (x === 0) ? colorCenterLine : colorGrid);
        }

        for (let y = -1 * sizeY; y <= sizeY; y += stepY) {
            addLine(-sizeX, y, sizeX, y, (y === 0) ? colorCenterLine : colorGrid);
        }

        return this.group;
    }
}

export default GridLine;
