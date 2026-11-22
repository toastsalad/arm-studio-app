import {describe, expect, it, vi} from 'vitest';
import {disposeModel, removeAllModels, removeModel} from '../src/containers/_2d/lib/removeModels.js';

// Taking drawings off the canvas, for every drawing type. This is what the Clear button ends up in, and it had
// to tolerate a drawing whose dispose() throws: the old code called dispose() first and then removed, so one
// throw left everything on the canvas.

const fakeModel = (name, {throws = false} = {}) => ({
    name,
    disposed: 0,
    dispose() {
        this.disposed += 1;
        if (throws) throw new Error(`${name} refused to be disposed`);
    },
});

const fakeGroup = (models = []) => ({
    children: models.slice(),
    remove(...objects) {
        for (const object of objects) {
            const at = this.children.indexOf(object);
            if (at >= 0) this.children.splice(at, 1);
        }
    },
});

describe('removeAllModels', () => {
    it('takes every drawing out of the scene and frees it', () => {
        const models = [fakeModel('svg'), fakeModel('image'), fakeModel('trace'), fakeModel('text')];
        const group = fakeGroup(models);

        expect(removeAllModels(group)).toBe(4);
        expect(group.children).toHaveLength(0);
        for (const model of models) expect(model.disposed).toBe(1);
    });

    it('keeps going when one drawing fails to be freed', () => {
        const good = fakeModel('svg');
        const bad = fakeModel('image', {throws: true});
        const alsoGood = fakeModel('trace');
        const group = fakeGroup([good, bad, alsoGood]);
        const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});

        // The failure is reported, and the other two are still removed and freed.
        expect(removeAllModels(group)).toBe(3);
        expect(group.children).toHaveLength(0);
        expect(good.disposed).toBe(1);
        expect(alsoGood.disposed).toBe(1);
        expect(bad.disposed).toBe(1);
        expect(quiet).toHaveBeenCalled();
        quiet.mockRestore();
    });

    it('leaves the drawing out of the scene even when freeing it throws', () => {
        // The whole point: a throw must not strand a drawing on the canvas.
        const group = fakeGroup([fakeModel('image', {throws: true})]);
        const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
        removeAllModels(group);
        expect(group.children).toHaveLength(0);
        quiet.mockRestore();
    });

    it('does nothing, and does not throw, without a scene', () => {
        expect(removeAllModels(null)).toBe(0);
        expect(removeAllModels(undefined)).toBe(0);
        expect(removeAllModels({})).toBe(0);
    });
});

describe('removeModel', () => {
    it('removes and frees one drawing', () => {
        const model = fakeModel('image');
        const group = fakeGroup([fakeModel('svg'), model]);

        expect(removeModel(group, model)).toBe(true);
        expect(group.children).toHaveLength(1);
        expect(model.disposed).toBe(1);
    });

    it('frees a drawing that is not in the scene', () => {
        // A model can be missing from the group after a canvas rebuild; the state still holds it.
        const model = fakeModel('image');
        expect(removeModel(fakeGroup(), model)).toBe(true);
        expect(model.disposed).toBe(1);
    });

    it('reports nothing to do when there is no model', () => {
        expect(removeModel(fakeGroup(), null)).toBe(false);
        expect(removeModel(null, null)).toBe(false);
    });
});

describe('disposeModel', () => {
    it('ignores objects that have no dispose', () => {
        expect(() => disposeModel({})).not.toThrow();
        expect(() => disposeModel(null)).not.toThrow();
    });
});
