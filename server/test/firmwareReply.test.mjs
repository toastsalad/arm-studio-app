import test from 'node:test';
import assert from 'node:assert/strict';

import {parsePositionReply} from '../../shared/firmwareReply.mjs';

test('a full reply yields the three axes', () => {
    assert.deepEqual(parsePositionReply('X:1.00 Y:2.50 Z:-3.00'), {x: 1, y: 2.5, z: -3, e: undefined});
});

test('E is optional and is reported when present', () => {
    assert.equal(parsePositionReply('X:0 Y:0 Z:0 E:12.75').e, 12.75);
    assert.equal(parsePositionReply('X:0 Y:0 Z:0').e, undefined);
});

test('a reply with X but no Y is not a position reply', () => {
    // This is the shape that made the browser throw: it read split[1] without checking it.
    assert.equal(parsePositionReply('X:1'), null);
    assert.equal(parsePositionReply('X:1 Y:2'), null);
    assert.equal(parsePositionReply('X:1 Z:3'), null);
});

test('other lines are rejected rather than read as coordinates', () => {
    for (const line of ['ok', 'ok T:200 /0 B:60 /0', 'wait', '', '   ', null, undefined, 42,
        'Warning!Laser protection door opened', 'current positon = 12.5']) {
        assert.equal(parsePositionReply(line), null, `took "${line}" for a position`);
    }
});

test('extra whitespace and lowercase axes are tolerated', () => {
    assert.deepEqual(parsePositionReply('  x:1  y:2\tz:3  '), {x: 1, y: 2, z: 3, e: undefined});
});

test('a garbage axis value makes the whole line useless', () => {
    // Y cannot be read, so the line is a fragment and must not move the tracked position.
    assert.equal(parsePositionReply('X:1 Y:oops Z:3'), null);
    assert.equal(parsePositionReply('X:1 Y:2 Z:'), null);
});
