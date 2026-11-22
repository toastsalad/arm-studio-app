import {createStateMachine} from '../stateMachine.mjs';

/**
 * Whether the bridge has been told that a desktop owns the arm's ack loop.
 *
 * While a streamed job runs, the desktop answers every `ok` itself, so the bridge must keep its
 * own trim/level controls locked. That is a two-state machine -- closed/open -- but it used to be
 * a module boolean written from three places (job start, job idle, job refused), each with its
 * own copy of the "and don't send it twice" test. Here the guard is the state, and the two
 * commands are emitted from the transition, so no caller can send `begin` twice or `end` on a
 * stream that was never opened.
 *
 * `write` is injected so the machine can be exercised without a port (see test/bridgeStream).
 */
export const CLOSED = 'closed';
export const OPEN = 'open';

export const BEGIN = 'begin';
export const END = 'end';

export const bridgeStreamTable = {
    // Repeated commands are self-transitions: legal, but not a state change, so nothing is sent.
    [CLOSED]: {[BEGIN]: OPEN, [END]: CLOSED},
    [OPEN]: {[BEGIN]: OPEN, [END]: CLOSED},
};

export const createBridgeStream = (write) => {
    const machine = createStateMachine({
        name: 'bridgeStream',
        initial: CLOSED,
        states: bridgeStreamTable,
        onTransition: ({to}) => {
            // The desktop owns the ack loop; keep the bridge's trim/level controls locked.
            write(to === OPEN ? '!job stream begin\n' : '!job stream end\n');
        },
    });

    return {
        get isOpen() {
            return machine.is(OPEN);
        },
        /** Take ownership of the ack loop; a no-op when it is already taken. */
        begin: () => machine.fire(BEGIN),
        /** Give the ack loop back; a no-op when it was never taken. */
        end: () => machine.fire(END),
        machine,
    };
};

export default createBridgeStream;
