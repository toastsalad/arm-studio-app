import test from 'node:test';
import assert from 'node:assert/strict';
import {toneFrameSize} from '../src/toolPath/toneFrame.js';

// The rectangle a shading fill is applied to. The engine samples a tone image through an axis-aligned box, so
// a picture turned by the drawing's rotation is still sampled through one: the pixels are turned instead, and
// the box has to grow to the turned picture's extent. These are the numbers that were missing, which is why a
// shaded picture drew its ink upright whatever the transformation said.

test('an unturned picture keeps its own size', () => {
    assert.deepEqual(toneFrameSize(200, 100, 0), {width: 200, height: 100});
    // The default matters: every existing settings tree without a rotation reaches here.
    assert.deepEqual(toneFrameSize(200, 100), {width: 200, height: 100});
    assert.deepEqual(toneFrameSize(200, 100, 360), {width: 200, height: 100});
});

test('a quarter turn swaps the sides', () => {
    const frame = toneFrameSize(200, 100, 90);
    assert.equal(Math.round(frame.width), 100);
    assert.equal(Math.round(frame.height), 200);
});

test('a half turn gives the picture its own size back', () => {
    const frame = toneFrameSize(200, 100, 180);
    assert.equal(Math.round(frame.width), 200);
    assert.equal(Math.round(frame.height), 100);
});

test('the direction of the turn does not change the box', () => {
    const left = toneFrameSize(200, 100, 30);
    const right = toneFrameSize(200, 100, -30);
    assert.equal(Math.round(left.width * 1000), Math.round(right.width * 1000));
    assert.equal(Math.round(left.height * 1000), Math.round(right.height * 1000));
});

test('a diagonal turn grows the box symmetrically, and it never collapses', () => {
    // 45 degrees on a square: side becomes side * sqrt(2).
    const square = toneFrameSize(100, 100, 45);
    assert.equal(Math.round(square.width), 141);
    assert.equal(Math.round(square.height), 141);

    // A zero-size picture still needs a region the engine can clip.
    const tiny = toneFrameSize(0, 0, 45);
    assert.ok(tiny.width >= 1 && tiny.height >= 1);
});
