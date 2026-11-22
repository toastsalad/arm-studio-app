import * as THREE from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import ThreeUtils from '../../../three-extensions/ThreeUtils.js';

const materialNormal = new THREE.MeshPhongMaterial({color: 0xa0a0a0, specular: 0xb0b0b0, shininess: 30});
const materialSelected = new THREE.MeshPhongMaterial({
    color: 0xb0b0b0,
    shininess: 30,
    transparent: true,
    opacity: 0.6,
    depthTest: false
});
const materialTransparent = new THREE.MeshPhongMaterial({
    color: 0xb0b0b0,
    shininess: 30,
    transparent: true,
    opacity: 0.1,
    depthTest: false
});

// Extract vertices and triangular faces from a BufferGeometry, optionally transformed by a matrix.
const facesFromGeometry = (geometry, matrix) => {
    const position = geometry.getAttribute('position');
    const index = geometry.index;
    const vertices = [];
    for (let i = 0; i < position.count; i++) {
        vertices.push(new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i)).applyMatrix4(matrix));
    }
    const faces = [];
    const pushFace = (v0, v1, v2) => {
        const normal = new THREE.Vector3()
            .subVectors(vertices[v1], vertices[v0])
            .cross(new THREE.Vector3().subVectors(vertices[v2], vertices[v0]))
            .normalize();
        faces.push({a: v0, b: v1, c: v2, normal});
    };
    if (index) {
        for (let i = 0; i < index.count; i += 3) pushFace(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    } else {
        for (let i = 0; i < position.count; i += 3) pushFace(i, i + 1, i + 2);
    }
    return {vertices, faces};
};

class Model3D extends THREE.Mesh {
    constructor(bufferGeometry, convexBufferGeometry, modelName, modelPath) {
        super(bufferGeometry, materialNormal);

        this.boundingBox = null; // aligned to the parent axis

        this.bufferGeometry = bufferGeometry;
        this.convexBufferGeometry = convexBufferGeometry;
        this.modelName = modelName;
        this.modelPath = modelPath;

        this.isSelected = false;
        this.mode = 'prepare';

        // Indexed geometry (shared vertices) for the lay-flat algorithm.
        this.convexGeometry = mergeVertices(convexBufferGeometry);

        this.transformation = {
            x: 0,
            y: 300,
            z: 0,
            rx: 0,
            ry: 0,
            rz: 0,
            scale: 1,
            sx: 1,
            sy: 1,
            sz: 1,
            ogScaleWidth: 0,
            ogScaleHeight: 0,
            ogScaleDepth: 0,
            scaleWidth: 0,
            scaleHeight: 0,
            scaleDepth: 0,
            isUniformScaling: true
        };
        this.position.x = 0;
        this.position.z = -300;

        let cubeEdges = new THREE.EdgesGeometry(this.bufferGeometry, 6);
        let edgesMtl = new THREE.LineBasicMaterial({color: 0x4169E1});
        this.edgesLineObj3d = new THREE.LineSegments(cubeEdges, edgesMtl);
        this.edgesLineObj3d.visible = false;
        this.add(this.edgesLineObj3d);
    }

    stickToPlate() {
        this.computeBoundingBox();
        this.position.y = this.position.y - this.boundingBox.min.y;
    }

    computeBoundingBox() {
        // Geometry is unchanged by move/scale/rotate, so apply this.matrix to a clone instead.
        const clone = this.convexBufferGeometry.clone();
        this.updateMatrix();
        clone.applyMatrix4(this.matrix);
        clone.computeBoundingBox();
        this.boundingBox = clone.boundingBox;
    }

    setSelected(value) {
        this.isSelected = value;
        if (this.mode === "prepare") {
            if (this.isSelected) {
                this.edgesLineObj3d.visible = true;
                this.material = materialSelected;
            } else {
                this.edgesLineObj3d.visible = false;
                this.material = materialNormal;
            }
        } else if (this.mode === "preview") {
            this.material = materialTransparent;
        }
    }

    setMode(mode) {
        if (mode) {
            this.mode = mode
            if (this.mode === "prepare") {
                if (this.isSelected) {
                    this.edgesLineObj3d.visible = true;
                    this.material = materialSelected;
                } else {
                    this.edgesLineObj3d.visible = false;
                    this.material = materialNormal;
                }
            } else if (this.mode === "preview") {
                this.edgesLineObj3d.visible = true;
                this.material = materialTransparent;
            }
        }
    }

    clone() {
        const clone = new Model3D(
            this.bufferGeometry.clone(),
            this.convexBufferGeometry.clone(),
            this.modelName,
            this.modelPath
        );

        const {x, y, rx, ry, rz, sx, sy, sz} = this.transformation;
        clone.transformation = this.transformation;
        clone.position.x = x;
        clone.position.z = -y; // different axis orientation

        clone.rotation.x = rx;
        clone.rotation.y = ry;
        clone.rotation.z = rz;

        clone.scale.copy(new THREE.Vector3(sx, sy, sz));
        clone.stickToPlate();
        return clone;
    }

    layFlat() {
        const epsilon = 1e-6;
        const positionX = this.position.x;
        const positionZ = this.position.z;

        // The min-Y vertex and the min-angle vertex must lie in the same face.
        this.updateMatrix();
        let {vertices, faces} = facesFromGeometry(this.convexGeometry, this.matrix);

        let minY = Number.MAX_VALUE;
        let minYVertexIndex = -1;
        let minAngleVertexIndex = -1;
        let minAngleFace = null;

        for (let i = 0; i < vertices.length; i++) {
            if (vertices[i].y < minY) {
                minY = vertices[i].y;
                minYVertexIndex = i;
            }
        }

        let minYVerticesCount = 0;
        for (let i = 0; i < vertices.length; i++) {
            if (vertices[i].y - minY < epsilon) {
                ++minYVerticesCount;
            }
        }

        if (minYVerticesCount >= 3) {
            // Already lay flat.
            return;
        }

        if (minYVerticesCount === 2) {
            for (let i = 0; i < vertices.length; i++) {
                if (vertices[i].y - minY < epsilon && i !== minYVertexIndex) {
                    minAngleVertexIndex = i;
                }
            }
        } else if (minYVerticesCount === 1) {
            let sinValue = Number.MAX_VALUE; // sine of the angle between directionVector3 and the x-z plane
            for (let i = 1; i < vertices.length; i++) {
                if (i !== minYVertexIndex) {
                    const directionVector3 = new THREE.Vector3().subVectors(vertices[i], vertices[minYVertexIndex]);
                    const length = directionVector3.length();
                    if (directionVector3.y / length < sinValue) {
                        sinValue = directionVector3.y / length;
                        minAngleVertexIndex = i;
                    }
                }
            }
            // Rotate so the min-angle vertex reaches minY.
            const vb1 = new THREE.Vector3().subVectors(vertices[minAngleVertexIndex], vertices[minYVertexIndex]);
            const va1 = new THREE.Vector3(vb1.x, 0, vb1.z);
            const matrix1 = ThreeUtils.getRotateMatrixBetweenVector3(va1, vb1);
            this.applyMatrix4(matrix1);
            this.stickToPlate();

            ({vertices, faces} = facesFromGeometry(this.convexGeometry, this.matrix));
        }

        // With two min-Y vertices, pick the face joining them whose outward normal tips the most.
        const candidateFaces = [];
        for (let i = 0; i < faces.length; i++) {
            const face = faces[i];
            if ([face.a, face.b, face.c].includes(minYVertexIndex) &&
                [face.a, face.b, face.c].includes(minAngleVertexIndex)) {
                candidateFaces.push(face);
            }
        }

        let cosValue = Number.MIN_VALUE;
        for (let i = 0; i < candidateFaces.length; i++) {
            const faceNormal = candidateFaces[i].normal;
            if (faceNormal.y < 0) {
                const cosine = -faceNormal.y / faceNormal.length();
                if (cosine > cosValue) {
                    cosValue = cosine;
                    minAngleFace = candidateFaces[i];
                }
            }
        }

        // Degenerate mesh with no outward-facing candidate: leave the model as it is.
        if (!minAngleFace) {
            return;
        }

        const xzPlaneNormal = new THREE.Vector3(0, -1, 0);
        const vb2 = minAngleFace.normal;
        const matrix2 = ThreeUtils.getRotateMatrixBetweenVector3(xzPlaneNormal, vb2);
        this.applyMatrix4(matrix2);
        this.stickToPlate();
        this.position.x = positionX;
        this.position.z = positionZ;
    }

    dispose() {
        if (this.geometry) this.geometry.dispose();
        if (this.convexGeometry) this.convexGeometry.dispose();
        if (this.convexBufferGeometry) this.convexBufferGeometry.dispose();
        if (this.edgesLineObj3d) {
            this.edgesLineObj3d.geometry.dispose();
            this.edgesLineObj3d.material.dispose();
            this.edgesLineObj3d = null;
        }
        this.bufferGeometry = null;
        this.convexGeometry = null;
        this.convexBufferGeometry = null;
    }

    updateTransformation(key, value, uniformScaleFlag) {
        if (isNaN(value) && key !== 'isUniformScaling') value = 0

        this.transformation[key] = value;

        let {x, y, z, rx, ry, rz, scale, sx, sy, sz, scaleWidth, scaleHeight, scaleDepth, ogScaleWidth, ogScaleHeight, ogScaleDepth, isUniformScaling} = this.transformation;

        this.position.x = x;
        this.position.y = z;
        this.position.z = -y; // different axis orientation

        this.rotation.x = rx;
        this.rotation.y = ry;
        this.rotation.z = rz;

        if (key === 'scaleWidth') {
            sx = Number.parseFloat(scaleWidth / ogScaleWidth)
            this.updateTransformation('sx', sx)
            return
        }

        if (key === 'scaleHeight') {
            sy = Number.parseFloat(scaleHeight / ogScaleHeight)
            this.updateTransformation('sy', sy)
            return
        }

        if (key === 'scaleDepth') {
            sz = Number.parseFloat(scaleDepth / ogScaleDepth)
            this.updateTransformation('sz', sz)
            return
        }

        if (key === 'sx') {
            scaleWidth = Number(Number.parseFloat(sx * ogScaleWidth).toFixed(2))
            this.transformation.scaleWidth = scaleWidth
            this.scale.copy(new THREE.Vector3(this.transformation.sx, this.transformation.sy, this.transformation.sz));

            if (!uniformScaleFlag && isUniformScaling) {
                this.updateTransformation('sy', this.transformation.sx, true)
                this.updateTransformation('sz', this.transformation.sx, true)
            }
        }

        if (key === 'sy') {
            scaleHeight = Number(Number.parseFloat(sy * ogScaleHeight).toFixed(2))
            this.transformation.scaleHeight = scaleHeight
            this.scale.copy(new THREE.Vector3(this.transformation.sx, this.transformation.sy, this.transformation.sz));

            if (!uniformScaleFlag && isUniformScaling) {
                this.updateTransformation('sx', this.transformation.sy, true)
                this.updateTransformation('sz', this.transformation.sy, true)
            }
        }

        if (key === 'sz') {
            scaleDepth = Number(Number.parseFloat(sz * ogScaleDepth).toFixed(2))
            this.transformation.scaleDepth = scaleDepth
            this.scale.copy(new THREE.Vector3(this.transformation.sx, this.transformation.sy, this.transformation.sz));

            if (!uniformScaleFlag && isUniformScaling) {
                this.updateTransformation('sy', this.transformation.sz, true)
                this.updateTransformation('sx', this.transformation.sz, true)
            }
        }

    }
}

export default Model3D;
