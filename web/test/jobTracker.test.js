import {describe, expect, it, vi} from 'vitest';

// The reducer module reaches the socket only from its `init` thunk; the
// reducer itself is pure. Mock the manager so importing it does not open a
// connection, and so `init` can be exercised without a server.
const listeners = {};
vi.mock('../src/socket/socketClientManager', () => ({
    default: {
        addServerListener: vi.fn((event, listener) => {
            listeners[event] = listener;
            return listener;
        }),
        removeServerListener: vi.fn(),
    },
}));

import reducer, {actions} from '../src/reducers/jobTracker';
import {
    GCODE_SENDER_STATUS_CHANGE,
    FRONT_END_POSITION_MONITOR,
    NETWORK_JOB_STATUS,
} from '../src/constants';

const idle = () => reducer(undefined, {type: '@@INIT'});
const apply = (state, ...actions_) => actions_.reduce(reducer, state);

describe('jobTracker', () => {
    it('adopts a bridge job while idle', () => {
        const state = apply(idle(), actions.bridgeStatus({
            id: 'job-1',
            state: 'running',
            line: 'G1 X10 Y20 Z5',
        }));

        expect(state).toMatchObject({
            active: true,
            // The bridge says "running"; the tracker reports the job vocabulary, not the bridge's.
            status: 'started',
            source: 'bridge',
            offloaded: true,
            positionSource: 'bridge',
            position: {x: 10, y: 20, z: 5},
        });
        expect(state.bridge).toMatchObject({id: 'job-1', absolute: true, has: true});
    });

    it('counts a finishing bridge job as running', () => {
        // The server used to ignore this word and the browser used to count it as active, so the
        // two layers disagreed. Both read one map now.
        const state = apply(idle(), actions.bridgeStatus({id: 'job-1', state: 'finishing'}));
        expect(state).toMatchObject({active: true, status: 'started', offloaded: true});
    });

    it('leaves the state alone for a bridge word it does not know', () => {
        const running = apply(idle(), actions.bridgeStatus({id: 'job-1', state: 'running'}));
        const state = apply(running, actions.bridgeStatus({id: 'job-1', state: 'teleporting'}));
        expect(state).toMatchObject({active: true, status: 'started'});
    });

    it('keeps the last position when a bridge job pauses', () => {
        const running = apply(idle(), actions.bridgeStatus({
            id: 'job-1',
            state: 'running',
            line: 'G1 X10 Y20 Z5',
        }));

        const paused = apply(running, actions.bridgeStatus({id: 'job-1', state: 'paused'}));

        expect(paused).toMatchObject({
            active: true,
            status: 'paused',
            source: 'bridge',
            offloaded: true,
            position: {x: 10, y: 20, z: 5},
        });
    });

    it('lets the sender report idle while a job is offloaded', () => {
        const offloaded = apply(idle(), actions.bridgeStatus({
            id: 'job-1',
            state: 'running',
            line: 'G1 X10 Y20 Z5',
        }));

        const state = apply(offloaded, actions.senderStatus({status: 'idle', offloaded: true}));

        expect(state).toMatchObject({
            active: false,
            status: 'idle',
            source: null,
            offloaded: true,
        });
        // The bridge remains the authority on position.
        expect(state.position).toEqual({x: 10, y: 20, z: 5});
    });

    it('ignores a stream position while the job is offloaded', () => {
        const offloaded = apply(idle(), actions.bridgeStatus({
            id: 'job-1',
            state: 'running',
            line: 'G1 X10 Y20 Z5',
        }));

        const state = apply(offloaded, actions.streamPosition({x: 0, y: 0, z: 0}));

        expect(state).toBe(offloaded);
        expect(state.position).toEqual({x: 10, y: 20, z: 5});
        expect(state.positionSource).toBe('bridge');
    });

    it('takes a stream position while the sender owns the job', () => {
        const running = apply(idle(), actions.senderStatus({status: 'running', offloaded: false}));

        const state = apply(running, actions.streamPosition({x: 3, y: 4, z: 5}));

        expect(state).toMatchObject({
            active: true,
            source: 'sender',
            offloaded: false,
            positionSource: 'stream',
            position: {x: 3, y: 4, z: 5},
        });
    });

    it('resets to the initial state', () => {
        const busy = apply(idle(),
            actions.senderStatus({status: 'running', offloaded: false}),
            actions.streamPosition({x: 1, y: 2, z: 3}));

        expect(apply(busy, actions.reset())).toEqual(idle());
    });

    it('ignores sender status for single commands, not jobs', () => {
        const dispatch = vi.fn();
        actions.init()(dispatch, idle);
        const onSenderStatus = listeners[GCODE_SENDER_STATUS_CHANGE];

        onSenderStatus({isJob: false, curStatus: 'running'});
        expect(dispatch).not.toHaveBeenCalled();

        onSenderStatus({isJob: true, curStatus: 'running', offloaded: false});
        expect(dispatch).toHaveBeenCalledWith(actions.senderStatus({status: 'running', offloaded: false}));
    });

    it('routes position and bridge events to their own actions', () => {
        const dispatch = vi.fn();
        actions.init()(dispatch, idle);

        listeners[FRONT_END_POSITION_MONITOR]({x: 1, y: 2, z: 3});
        expect(dispatch).toHaveBeenCalledWith(actions.streamPosition({x: 1, y: 2, z: 3}));

        listeners[NETWORK_JOB_STATUS]({id: 'job-2', state: 'running'});
        expect(dispatch).toHaveBeenCalledWith(actions.bridgeStatus({id: 'job-2', state: 'running'}));
    });
});
