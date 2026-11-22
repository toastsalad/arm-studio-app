import test from 'node:test';
import assert from 'node:assert/strict';
import {createLog} from '../../shared/log.mjs';

// A sink that records what reached it, so the level rule can be checked without a console.
const recorder = () => {
    const seen = [];
    const put = (level) => (...args) => seen.push(args.length ? {level, args} : level);
    const sink = {error: put('error'), warn: put('warn'), info: put('info'), debug: put('debug')};
    sink.seen = seen;
    // The levels that were not filtered out, in call order.
    sink.levels = () => seen.map((entry) => (typeof entry === 'string' ? entry : entry.level));
    return sink;
};

test('info is the default and drops debug', () => {
    const sink = recorder();
    const log = createLog(undefined, sink);
    log.error('e');
    log.warn('w');
    log.info('i');
    log.debug('d');
    assert.equal(log.level, 'info');
    assert.deepEqual(sink.levels(), ['error', 'warn', 'info']);
});

test('debug shows everything and error shows only errors', () => {
    const loud = recorder();
    const quiet = recorder();
    const a = createLog('debug', loud);
    const b = createLog('ERROR', quiet);
    a.error('e'); a.warn('w'); a.info('i'); a.debug('d');
    b.error('e'); b.warn('w'); b.info('i'); b.debug('d');
    assert.deepEqual(loud.levels(), ['error', 'warn', 'info', 'debug']);
    // Case does not matter, and a level above the threshold drops the call.
    assert.equal(b.level, 'error');
    assert.deepEqual(quiet.levels(), ['error']);
});

test('an unknown level says so instead of pretending to be the default', () => {
    const sink = recorder();
    const log = createLog('verbose', sink);
    assert.equal(log.level, 'info');
    assert.equal(sink.seen.length, 1);
    assert.match(sink.seen[0].args[0], /is not one of: error, warn, info, debug; using 'info'/);
});

test('arguments are passed through untouched, including objects', () => {
    const sink = recorder();
    const log = createLog('debug', sink);
    log.debug('a', 1, {b: 2});
    assert.deepEqual(sink.seen, [{level: 'debug', args: ['a', 1, {b: 2}]}]);
});
