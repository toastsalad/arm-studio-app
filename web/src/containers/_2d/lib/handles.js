import * as THREE from 'three';
import {canvasPalette} from '../../../utils/canvasPalette';

// Transform handles are drawn as geometry, not textured sprites: a texture is a
// fixed pixel grid, so it goes blurry the moment you zoom in on it.
//
// Every model shares this one material, so the canvas re-colours it once when the theme changes
// instead of making each model rebuild its own handles. It is built on first use rather than at
// import: this module is evaluated while the bundle is still being loaded, before theme.css has
// been applied, and the palette would read empty there.
let handleMaterial = null;

const material = () => {
    if (!handleMaterial) {
        handleMaterial = new THREE.MeshBasicMaterial({
            color: canvasPalette().handle,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
    }
    return handleMaterial;
};

const makeMesh = (positions, indices) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, material());
    mesh.renderOrder = 999;
    return mesh;
};

// Corner resize handle: a square outline, as a ring of four quads so the stroke
// keeps its width at any zoom.
const RESIZE_HANDLE_SIZE = 4.5;

const createResizeHandle = (size = RESIZE_HANDLE_SIZE, thickness = 0.5) => {
    const outer = size / 2;
    const inner = outer - thickness;
    const positions = [
        -outer, -outer, 0, outer, -outer, 0, outer, outer, 0, -outer, outer, 0,
        -inner, -inner, 0, inner, -inner, 0, inner, inner, 0, -inner, inner, 0,
    ];
    const indices = [];
    for (let corner = 0; corner < 4; corner++) {
        const next = (corner + 1) % 4;
        indices.push(corner, next, 4 + next, corner, 4 + next, 4 + corner);
    }
    return makeMesh(positions, indices);
};

// Rotation handle: an arc with an arrow head at one end.
//
// The y axis is negated throughout. Model space is y-up, and these are the same angles the canvas
// texture this replaced was drawn with - but a canvas is y-down, so carrying the angles over
// unchanged mirrored the arc and left the handle opening downwards, upside down.
const createRotateHandle = (radius = 2.3, thickness = 0.55) => {
    const start = -Math.PI / 3;
    const end = Math.PI * 4 / 3;
    const segments = 48;
    const outerRadius = radius + thickness / 2;
    const innerRadius = radius - thickness / 2;

    const positions = [];
    for (let i = 0; i <= segments; i++) {
        const angle = start + (end - start) * i / segments;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        positions.push(outerRadius * cos, -outerRadius * sin, 0);
        positions.push(innerRadius * cos, -innerRadius * sin, 0);
    }
    const indices = [];
    for (let i = 0; i < segments; i++) {
        const outerA = i * 2, innerA = i * 2 + 1, outerB = (i + 1) * 2, innerB = (i + 1) * 2 + 1;
        indices.push(outerA, outerB, innerB, outerA, innerB, innerA);
    }

    const radial = new THREE.Vector2(Math.cos(end), -Math.sin(end));
    const tangent = new THREE.Vector2(-Math.sin(end), -Math.cos(end));
    const centre = radial.clone().multiplyScalar(radius);
    const tip = centre.clone().addScaledVector(tangent, 1.5);
    const head = 0.85;
    const first = positions.length / 3;
    positions.push(tip.x, tip.y, 0);
    positions.push(centre.x + radial.x * head, centre.y + radial.y * head, 0);
    positions.push(centre.x - radial.x * head, centre.y - radial.y * head, 0);
    indices.push(first, first + 1, first + 2);

    return makeMesh(positions, indices);
};

// Every model shares the one handle material, so the canvas re-colours it once when the theme
// changes rather than making each model rebuild its own handles.
const applyCanvasPalette = () => {
    material().color.set(canvasPalette().handle);
};

export {createResizeHandle, createRotateHandle, RESIZE_HANDLE_SIZE, applyCanvasPalette};
