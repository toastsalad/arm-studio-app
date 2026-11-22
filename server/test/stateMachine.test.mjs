import test from 'node:test';
import assert from 'node:assert/strict';

import {createStateMachine} from '../src/stateMachine.mjs';

const table = {
    idle: {
        START: 'running',
        PAUSE: {refuse: 'nothing to pause'},
        STOP: {to: 'running', when: (payload) => payload && payload.forgiven, refuse: 'not forgiven'},
    },
    running: {
        START: {refuse: 'already running'},
        STOP: (payload) => (payload && payload.hard ? 'halted' : 'stopping'),
        DONE: 'idle',
    },
    stopping: {STOPPED: 'idle'},
    halted: {},
};

const machine = () => createStateMachine({name: 'test', initial: 'idle', states: table});

test('an unconditional move changes state and reports the change', () => {
    const m = machine();
    const result = m.fire('START');
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'ok');
    assert.equal(result.from, 'idle');
    assert.equal(result.to, 'running');
    assert.equal(result.changed, true);
    assert.equal(m.state, 'running');
});

test('a rejection leaves the state alone and carries the table message', () => {
    const m = machine();
    const result = m.fire('PAUSE');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'refused');
    assert.equal(result.refuse, 'nothing to pause');
    assert.equal(result.changed, false);
    assert.equal(m.state, 'idle');
});

test('a state/event pair that is not in the table is unknown, not a silent no-op', () => {
    const m = machine();
    const result = m.fire('DONE');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unknown');
    assert.equal(m.state, 'idle');
});

test('a failing guard rejects with the transition message', () => {
    const m = machine();
    assert.equal(m.fire('STOP').refuse, 'not forgiven');
    const allowed = m.fire('STOP', {forgiven: true});
    assert.equal(allowed.ok, true);
    assert.equal(m.state, 'running');
});

test('a transition function sees its payload', () => {
    const m = machine();
    m.fire('START');
    assert.equal(m.fire('STOP', {hard: false}).to, 'stopping');
    const m2 = machine();
    m2.fire('START');
    assert.equal(m2.fire('STOP', {hard: true}).to, 'halted');
});

test('can() predicts a move without making it', () => {
    const m = machine();
    assert.deepEqual(m.can('START').to, 'running');
    assert.equal(m.state, 'idle');
    assert.equal(m.can('DONE').reason, 'unknown');
});

test('a self-transition is legal but is not announced', () => {
    const announced = [];
    const m = createStateMachine({
        name: 'self',
        initial: 'a',
        states: {a: {PING: 'a', OTHER: 'b'}, b: {}},
        onTransition: (t) => announced.push(`${t.from}->${t.to}`),
    });
    const result = m.fire('PING');
    assert.equal(result.ok, true);
    assert.equal(result.changed, false);
    assert.deepEqual(announced, []);
    m.fire('OTHER');
    assert.deepEqual(announced, ['a->b']);
});

test('reset() moves without announcing, for re-synchronising with the world', () => {
    const announced = [];
    const m = createStateMachine({
        name: 'reset',
        initial: 'a',
        states: {a: {GO: 'b'}, b: {}},
        onTransition: (t) => announced.push(`${t.from}->${t.to}`),
    });
    m.fire('GO');
    announced.length = 0;
    m.reset('a');
    assert.equal(m.state, 'a');
    assert.deepEqual(announced, []);
});

test('an unknown initial state or reset target is a construction error, not a runtime one', () => {
    assert.throws(() => createStateMachine({initial: 'nowhere', states: table}), /initial state/);
    assert.throws(() => machine().reset('nowhere'), /unknown state/);
});

test('is/isAny/events describe the current state', () => {
    const m = machine();
    assert.equal(m.is('idle'), true);
    assert.equal(m.isAny('running', 'idle'), true);
    assert.deepEqual(m.events().sort(), ['PAUSE', 'START', 'STOP']);
    assert.deepEqual(m.states.sort(), ['halted', 'idle', 'running', 'stopping']);
});
