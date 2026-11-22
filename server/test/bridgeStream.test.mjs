import test from 'node:test';
import assert from 'node:assert/strict';

import {CLOSED, OPEN, createBridgeStream} from '../src/gcode/bridgeStream.mjs';

const record = () => {
    const sent = [];
    return {sent, stream: createBridgeStream((line) => sent.push(line.trim()))};
};

test('the first streamed job opens the ack loop and the last one closes it', () => {
    const {sent, stream} = record();
    assert.equal(stream.isOpen, false);
    stream.begin();
    assert.equal(stream.isOpen, true);
    assert.deepEqual(sent, ['!job stream begin']);
    stream.end();
    assert.equal(stream.isOpen, false);
    assert.deepEqual(sent, ['!job stream begin', '!job stream end']);
});

test('begin is idempotent, so concurrent callers cannot double-open the stream', () => {
    const {sent, stream} = record();
    stream.begin();
    stream.begin();
    stream.begin();
    assert.deepEqual(sent, ['!job stream begin']);
});

test('end is idempotent, so a refusal with no job in flight sends nothing', () => {
    const {sent, stream} = record();
    stream.end();
    assert.deepEqual(sent, []);
    assert.equal(stream.isOpen, false);

    stream.begin();
    stream.end();
    stream.end();
    assert.deepEqual(sent, ['!job stream begin', '!job stream end']);
});

test('the states are exactly closed and open', () => {
    const {stream} = record();
    assert.deepEqual(stream.machine.states.sort(), [CLOSED, OPEN].sort());
});
