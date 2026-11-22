import test from 'node:test';
import assert from 'node:assert/strict';

import {createStateMachine} from '../src/stateMachine.mjs';
import {
    ACTIVE_JOB_STATES,
    IDLE,
    JOB_STATES,
    OFFLOAD,
    STARTED,
    STREAM,
    UPLOADING,
    isActiveJobState,
    offloadedJobTable,
    streamingJobTable,
} from '../src/gcode/jobStates.mjs';

const streaming = () => createStateMachine({initial: IDLE, states: streamingJobTable});
const offloaded = () => createStateMachine({initial: IDLE, states: offloadedJobTable});

test('both tables draw on the same set of job states', () => {
    for (const state of Object.keys(streamingJobTable)) {
        assert.ok(JOB_STATES.includes(state), `streaming table invents state '${state}'`);
    }
    for (const state of Object.keys(offloadedJobTable)) {
        assert.ok(JOB_STATES.includes(state), `offloaded table invents state '${state}'`);
    }
    // Only the offloading sender uploads, so only it has the uploading state.
    assert.ok(!(UPLOADING in streamingJobTable));
    assert.ok(UPLOADING in offloadedJobTable);
    assert.deepEqual([...ACTIVE_JOB_STATES].sort(), [STARTED, 'paused', 'stopping'].sort());
    assert.equal(isActiveJobState(UPLOADING), false, 'an upload is not yet a job to pause');
});

test('streaming: a job runs, drains and is back to idle', () => {
    const m = streaming();
    assert.equal(m.fire(STREAM.START).to, STARTED);
    assert.equal(m.fire(STREAM.DRAINED).to, IDLE);
});

test('streaming: pause holds the queue and resume continues it', () => {
    const m = streaming();
    m.fire(STREAM.START);
    assert.equal(m.fire(STREAM.PAUSE).to, 'paused');
    assert.equal(m.fire(STREAM.RESUME).to, STARTED);
});

test('streaming: stop goes through stopping so the safety tail can finish', () => {
    const m = streaming();
    m.fire(STREAM.START);
    assert.equal(m.fire(STREAM.STOP).to, 'stopping');
    assert.equal(m.fire(STREAM.STOPPED).to, IDLE);
});

test('streaming: stop is legal from paused, and only the tail can finish a stop', () => {
    const m = streaming();
    m.fire(STREAM.START);
    m.fire(STREAM.PAUSE);
    assert.equal(m.fire(STREAM.STOP).to, 'stopping');
    assert.equal(m.fire(STREAM.DRAINED).reason, 'unknown', 'a stopping job does not drain to idle');
});

test('streaming: every refusal is worded for the state it was asked in', () => {
    const refuse = (events) => {
        const m = streaming();
        for (const event of events) m.fire(event);
        return m;
    };
    assert.equal(refuse([]).fire(STREAM.PAUSE).refuse, 'No G-code sending task');
    assert.equal(refuse([STREAM.START]).fire(STREAM.START).refuse,
        'G-code sending task started, please do not repeat');
    assert.equal(refuse([STREAM.START]).fire(STREAM.RESUME).refuse,
        'G-code sending task started, no need resume');
    assert.equal(refuse([STREAM.START, STREAM.PAUSE]).fire(STREAM.START).refuse,
        'G-code sending task paused, please resume or stop first');
    assert.equal(refuse([STREAM.START, STREAM.PAUSE]).fire(STREAM.PAUSE).refuse,
        'G-code sending task paused, please do not repeat');
    assert.equal(refuse([STREAM.START, STREAM.STOP]).fire(STREAM.STOP).refuse,
        'G-code sending task stopping, please wait');
});

test('offloading: upload, then the bridge state drives everything', () => {
    const m = offloaded();
    assert.equal(m.fire(OFFLOAD.START).to, UPLOADING);
    assert.equal(isActiveJobState(m.state), false, 'a job being uploaded cannot be paused yet');
    assert.equal(m.fire(OFFLOAD.UPLOADED).to, STARTED);
    assert.equal(m.fire(OFFLOAD.PAUSED).to, 'paused');
    assert.equal(m.fire(OFFLOAD.RUNNING).to, STARTED);
    assert.equal(m.fire(OFFLOAD.STOPPING).to, 'stopping');
    assert.equal(m.fire(OFFLOAD.FINISHED).to, IDLE);
});

test('offloading: a failed upload lands back in idle', () => {
    const m = offloaded();
    m.fire(OFFLOAD.START);
    assert.equal(m.fire(OFFLOAD.UPLOAD_FAILED).to, IDLE);
});

test('offloading: connecting to a bridge already running a job adopts it', () => {
    for (const event of [OFFLOAD.RUNNING, OFFLOAD.PAUSED, OFFLOAD.STOPPING]) {
        const m = offloaded();
        const result = m.fire(event);
        assert.equal(result.ok, true, `${event} from idle must be accepted`);
        assert.notEqual(m.state, IDLE);
    }
    // And a terminal report while nothing is tracked is just noise, not an error.
    assert.equal(offloaded().fire(OFFLOAD.FINISHED).ok, true);
    assert.equal(offloaded().fire(OFFLOAD.FINISHED).changed, false);
});

test('offloading: a second job is refused in every non-idle state', () => {
    for (const path of [
        [OFFLOAD.START],
        [OFFLOAD.START, OFFLOAD.UPLOADED],
        [OFFLOAD.START, OFFLOAD.UPLOADED, OFFLOAD.PAUSED],
        [OFFLOAD.START, OFFLOAD.UPLOADED, OFFLOAD.STOPPING],
    ]) {
        const m = offloaded();
        for (const event of path) m.fire(event);
        const result = m.fire(OFFLOAD.START);
        assert.equal(result.ok, false);
        assert.equal(result.refuse, 'An offloaded job is already active');
    }
});
