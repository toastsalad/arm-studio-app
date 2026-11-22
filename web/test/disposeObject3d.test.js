import {describe, expect, it} from 'vitest';
import * as THREE from 'three';
import {disposeObject3d, replaceGeometry} from '../src/utils/disposeObject3d.js';

// Record what a disposable object was asked to do, so the test sees the calls and not just the end state.
const watched = () => {
    const calls = {geometry: 0, material: 0};
    return {
        calls,
        geometry: () => {
            const g = new THREE.BufferGeometry();
            g.dispose = () => { calls.geometry += 1; };
            return g;
        },
        material: (extra = {}) => {
            const m = new THREE.MeshBasicMaterial(extra);
            const realDispose = m.dispose.bind(m);
            m.dispose = () => { calls.material += 1; realDispose(); };
            return m;
        },
    };
};

describe('disposeObject3d', () => {
    it('disposes the geometry and material of a plain mesh', () => {
        const w = watched();
        const mesh = new THREE.Mesh(w.geometry(), w.material());
        disposeObject3d(mesh);
        expect(w.calls).toEqual({geometry: 1, material: 1});
    });

    it('walks into children, and handles a material array', () => {
        const w = watched();
        const group = new THREE.Group();
        group.add(new THREE.Mesh(w.geometry(), w.material()));
        group.add(new THREE.LineSegments(w.geometry(), [w.material(), w.material()]));
        disposeObject3d(group);
        expect(w.calls).toEqual({geometry: 2, material: 3});
    });

    it('leaves a texture alone, because it may be shared', () => {
        const w = watched();
        const texture = new THREE.Texture();
        let textureDisposed = 0;
        texture.dispose = () => { textureDisposed += 1; };
        const mesh = new THREE.Mesh(w.geometry(), w.material({map: texture}));
        disposeObject3d(mesh);
        expect(textureDisposed).toBe(0);
        expect(w.calls.material).toBe(1);
    });

    it('accepts a missing object', () => {
        expect(() => disposeObject3d(null)).not.toThrow();
        expect(() => disposeObject3d(undefined)).not.toThrow();
        expect(() => disposeObject3d(new THREE.Object3D())).not.toThrow();
    });
});

describe('replaceGeometry', () => {
    it('frees the old geometry and keeps the new one', () => {
        const w = watched();
        const mesh = new THREE.Mesh(w.geometry(), w.material());
        const replacement = w.geometry();
        expect(replaceGeometry(mesh, replacement)).toBe(replacement);
        expect(mesh.geometry).toBe(replacement);
        expect(w.calls).toEqual({geometry: 1, material: 0});
    });

    it('does not free a geometry it is handed back', () => {
        const w = watched();
        const mesh = new THREE.Mesh(w.geometry(), w.material());
        const same = mesh.geometry;
        replaceGeometry(mesh, same);
        expect(w.calls.geometry).toBe(0);
    });
});
