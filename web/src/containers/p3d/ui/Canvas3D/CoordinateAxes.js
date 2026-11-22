import * as THREE from 'three';
import {canvasPalette} from '../../../../utils/canvasPalette';

const buildAxis = (src, dst, color, dashed) => {
    const material = dashed
        ? new THREE.LineDashedMaterial({linewidth: 1, color: color, dashSize: 1, gapSize: 1, opacity: 0.8, transparent: true})
        : new THREE.LineBasicMaterial({linewidth: 1, color: color, opacity: 0.8, transparent: true});

    const geometry = new THREE.BufferGeometry().setFromPoints([src.clone(), dst.clone()]);
    const axisLine = new THREE.Line(geometry, material);

    if (dashed) {
        axisLine.computeLineDistances();
    }

    return axisLine;
};

class CoordinateAxes {
    group = new THREE.Object3D();

    constructor(width, height) {
        const {axisX: red, axisY: green} = canvasPalette();

        this.group.add(
            buildAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(width, 0, 0), red, false), // +X
            buildAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-width, 0, 0), red, false), // -X
            buildAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, height, 0), green, false), // +Y
            buildAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -height, 0), green, false), // -Y
        );

        return this.group;
    }
}

export default CoordinateAxes;
