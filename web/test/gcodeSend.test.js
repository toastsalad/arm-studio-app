import {beforeEach, describe, expect, it, vi} from 'vitest';

// Listener handles are what the reducer module hands back to the socket
// manager; keep them so the tests can tell whose subscription was removed.
const h = vi.hoisted(() => ({added: [], removed: []}));

vi.mock('../src/socket/socketClientManager', () => ({
    default: {
        addServerListener: vi.fn((event, listener) => {
            const wrapper = {event, listener};
            h.added.push(wrapper);
            return wrapper;
        }),
        removeServerListener: vi.fn((event, wrapper) => {
            h.removed.push(wrapper);
        }),
        emitToServer: vi.fn(),
    },
}));

vi.mock('../src/utils/messageI18n', () => ({
    default: {success: vi.fn(), warning: vi.fn()},
}));

import {actions} from '../src/reducers/gcodeSend';

const take = () => {
    const handles = h.added.slice();
    h.added.length = 0;
    return handles;
};

describe('gcodeSend listener ownership', () => {
    beforeEach(() => {
        // The registry is module state: unwire whatever earlier tests left behind
        // before measuring this test's traffic.
        for (const key of ['job', 'jog', 'quiet', null]) actions.stopListening(key);
        h.added.length = 0;
        h.removed.length = 0;
    });

    it('does not unwire the running job when another caller starts a task', () => {
        // A full job (e.g. the laser panel) owns its subscription...
        actions.startJob('G1 X0 Y0');
        const jobHandles = take();
        expect(jobHandles).toHaveLength(2);

        // ...and a jog from a second panel registers its own, without disturbing it.
        actions.startTask('G1 X10', false, false, 'jog');

        expect(h.removed).toEqual([]);
    });

    it('replaces only the listeners of the task that restarts', () => {
        actions.startTask('G1 X1', false, false, 'jog');
        const first = take();

        actions.startTask('G1 X2', false, false, 'jog');

        expect(h.removed).toEqual(first);
        expect(h.added).toHaveLength(2);
    });

    it('replaces the job listeners when a new job starts', () => {
        actions.startJob('G1 X0');
        const first = take();

        actions.startJob('G1 X1');

        expect(h.removed).toEqual(first);
    });

    it('unwires a task on request and leaves the job alone', () => {
        actions.startJob('G1 X0');
        const jobHandles = take();
        actions.startTask('G1 X1', false, false, 'jog');
        const jogHandles = take();

        actions.stopListening('jog');

        expect(h.removed).toEqual(jogHandles);
        expect(h.removed).not.toContain(jobHandles[0]);
        expect(h.removed).not.toContain(jobHandles[1]);
    });

    it('does not subscribe to events the caller opted out of', () => {
        actions.startTask('G1 X1', false, false, 'quiet', false, false);

        expect(h.added).toEqual([]);
    });
});
