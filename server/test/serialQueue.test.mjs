import test from 'node:test';
import assert from 'node:assert/strict';

import {createSerialQueue} from '../../shared/serialQueue.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('tasks run one at a time, in the order they were submitted', async () => {
    const queue = createSerialQueue();
    const events = [];
    let inFlight = 0;

    const task = (name) => async () => {
        inFlight++;
        assert.equal(inFlight, 1, `${name} started while ${name} was not the only task running`);
        events.push(`start ${name}`);
        await tick();
        events.push(`end ${name}`);
        inFlight--;
        return name;
    };

    const results = await Promise.all([
        queue(task('a')),
        queue(task('b')),
        queue(task('c')),
    ]);

    assert.deepEqual(events, ['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
    assert.deepEqual(results, ['a', 'b', 'c']);
});

test('a task that rejects does not block the ones behind it', async () => {
    const queue = createSerialQueue();
    const ran = [];

    const failed = queue(async () => {
        ran.push('fail');
        throw new Error('boom');
    });
    const after = queue(async () => {
        ran.push('after');
        return 'ok';
    });

    await assert.rejects(failed, /boom/);
    assert.equal(await after, 'ok');
    assert.deepEqual(ran, ['fail', 'after']);
});

test('the rejection reaches its own caller, not the next one', async () => {
    const queue = createSerialQueue();
    const first = queue(async () => { throw new Error('first'); });
    const second = queue(async () => 'second');

    await assert.rejects(first, /first/);
    assert.equal(await second, 'second');
});

test('a caller that awaits nothing still keeps the order', async () => {
    const queue = createSerialQueue();
    const events = [];

    queue(async () => { await tick(); events.push('first'); });
    queue(async () => { events.push('second'); });
    await tick();
    await tick();
    await tick();

    assert.deepEqual(events, ['first', 'second']);
});
