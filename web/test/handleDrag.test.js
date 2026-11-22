import {describe, expect, it} from 'vitest';
import {beginResize, beginRotate, moved, pointerAngle, resizeWidth, rotateRotation} from '../src/containers/writeAndDraw/lib/handleDrag';

describe('handle drag geometry', () => {
    describe('resize', () => {
        it('scales the width with the pointer distance', () => {
            const drag = beginResize(10, 100);

            expect(resizeWidth(drag, 20, 0)).toBeCloseTo(200);
            expect(resizeWidth(drag, 5, 0)).toBeCloseTo(50);
        });

        it('never goes below the configured minimum', () => {
            const drag = beginResize(10, 100);

            expect(resizeWidth(drag, 0.5, 30)).toBe(30);
        });

        it('survives a drag that starts on the centre', () => {
            const drag = beginResize(0, 100);

            expect(resizeWidth(drag, 1, 0)).toBe(100000);
        });

        it('ignores changes smaller than half a unit', () => {
            expect(moved(100, 100.4)).toBe(false);
            expect(moved(100, 100.5)).toBe(true);
        });
    });

    describe('rotate', () => {
        it('follows the pointer angle in degrees', () => {
            const drag = beginRotate(0, 0);

            expect(rotateRotation(drag, Math.PI / 2, -180, 180)).toBeCloseTo(90);
        });

        it('wraps the result into [-180, 180)', () => {
            const drag = beginRotate(0, 170);

            // +90 degrees from 170 should land on -100, not 260.
            expect(rotateRotation(drag, Math.PI / 2, -180, 180)).toBeCloseTo(-100);
        });

        it('is a no-op before the pointer moves', () => {
            const drag = beginRotate(pointerAngle({x: 10, y: 0}, {x: 0, y: 0}), 45);

            expect(rotateRotation(drag, pointerAngle({x: 10, y: 0}, {x: 0, y: 0}), -180, 180)).toBe(45);
        });

        it('clamps to the setting limits', () => {
            const drag = beginRotate(0, 0);

            expect(rotateRotation(drag, Math.PI / 2, -45, 45)).toBe(45);
            expect(rotateRotation(drag, -Math.PI / 2, -45, 45)).toBe(-45);
        });
    });

    it('measures the pointer angle around the centre', () => {
        expect(pointerAngle({x: 0, y: 5}, {x: 0, y: 0})).toBeCloseTo(Math.PI / 2);
        expect(pointerAngle({x: -5, y: 0}, {x: 0, y: 0})).toBeCloseTo(Math.PI);
    });
});
