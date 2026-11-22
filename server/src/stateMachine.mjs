/**
 * A table-driven finite state machine.
 *
 * Several parts of this app are state machines that grew as a bare string field plus one
 * `switch` per operation, or as a handful of booleans that are only consistent with each other
 * by luck. Declaring the states and the legal moves between them once makes the graph
 * reviewable in one place, and turns an unhandled (state, event) pair into a reported hole
 * instead of a silent fall-through.
 *
 * A table is `{ [state]: { [event]: Transition } }`, where a Transition is one of:
 *
 *   'nextState'                       unconditional move
 *   { to: 'nextState' }               the same thing, spelled out
 *   { to: 'nextState', when: fn }     guarded move; the guard failing rejects the event
 *   { refuse: 'message' }             legal event, rejected in this state
 *   (payload, machine) => Transition  resolved at fire time, for payload-dependent moves
 *
 * A state/event pair that is absent from the table is not a rejection: it is a bug, and comes
 * back as `reason: 'unknown'` so the caller can complain about it.
 *
 * This module is deliberately dependency-free and has no imports, so the transition tables
 * that use it can be exercised without hardware or a bundler (see test/*.test.mjs).
 */

const resolve = (spec, payload, machine) => {
    const transition = typeof spec === 'function' ? spec(payload, machine) : spec;
    if (!transition) return null;
    if (typeof transition === 'string') return {to: transition};
    return transition;
};

export const createStateMachine = ({name = 'state machine', initial, states, onTransition} = {}) => {
    if (!states || !states[initial]) {
        throw new Error(`${name}: initial state '${initial}' is not in the table`);
    }

    let current = initial;

    // `machine` is in scope by the time any of these run, so a transition function can inspect
    // the machine it is being applied to.
    const outcome = (event, spec, payload) => {
        const from = current;
        const transition = spec === undefined ? null : resolve(spec, payload, machine);

        if (!transition) {
            return {ok: false, reason: 'unknown', event, from, to: from, changed: false, refuse: null};
        }
        if (transition.to === undefined || (transition.when && !transition.when(payload))) {
            return {
                ok: false,
                reason: 'refused',
                event,
                from,
                to: from,
                changed: false,
                refuse: transition.refuse || null,
            };
        }
        return {
            ok: true,
            reason: 'ok',
            event,
            from,
            to: transition.to,
            changed: transition.to !== from,
            refuse: null,
        };
    };

    const machine = {
        name,

        get state() {
            return current;
        },

        /** Every state the table knows about, for tests and diagnostics. */
        get states() {
            return Object.keys(states);
        },

        is: (state) => current === state,

        isAny: (...list) => list.includes(current),

        /** Events leaving the current state. */
        events: () => Object.keys(states[current] || {}),

        /** What `fire` would do, without doing it. */
        can: (event, payload) => outcome(event, states[current] && states[current][event], payload),

        /**
         * Apply `event`. Returns the outcome either way; a rejection leaves the state alone and
         * carries the table's message in `refuse` so the caller can surface it.
         */
        fire: (event, payload) => {
            const spec = states[current] && states[current][event];
            const result = outcome(event, spec, payload);
            if (!result.ok) return result;
            current = result.to;
            // A self-transition is not a state change, and announcing one would make the UI
            // report an event that did not happen; `reset` is the way to force a re-announce.
            if (result.changed && onTransition) onTransition({...result, payload});
            return result;
        },

        /**
         * Move to `state` without a transition: for re-synchronising with the outside world
         * (a reconnect, a reset) where announcing a move would be lying about a state change.
         */
        reset: (state = initial) => {
            if (!states[state]) throw new Error(`${name}: cannot reset to unknown state '${state}'`);
            const from = current;
            current = state;
            return {ok: true, reason: 'reset', event: null, from, to: state, changed: from !== state, refuse: null};
        },
    };

    return machine;
};

export default createStateMachine;
