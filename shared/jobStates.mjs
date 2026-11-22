/**
 * The job states that both the server and the browser talk about.
 *
 * A job is either streamed from the desktop over the ack loop, or offloaded to the bridge, which
 * runs and acks it itself. Those are the same states either way, but each layer used to declare
 * them again: the server had two transition tables, the browser had a third copy of "which states
 * count as active", and the bridge had its own words for the whole set. The copies had drifted --
 * the browser counted the bridge's `finishing` as active while the server ignored the word
 * completely.
 *
 * Nothing here talks to a port, a socket or a clock, so both sides can use it and the tests can
 * import it directly.
 */

/** No job. The only state a fresh sender is in. */
export const IDLE = 'idle';
/** An offloaded job's G-code is being uploaded; the bridge does not have it yet. */
export const UPLOADING = 'uploading';
/** Lines are being written (streamed) or executed (offloaded). */
export const STARTED = 'started';
/** Held between lines; the queue survives, `RESUME` continues it. */
export const PAUSED = 'paused';
/** Told to stop; the safety tail is being written before `IDLE`, or the bridge is ending the job. */
export const STOPPING = 'stopping';

export const JOB_STATES = [IDLE, UPLOADING, STARTED, PAUSED, STOPPING];

/** States in which a job exists that the user can pause, resume or stop. */
export const ACTIVE_JOB_STATES = [STARTED, PAUSED, STOPPING];

export const isActiveJobState = (state) => ACTIVE_JOB_STATES.includes(state);

/**
 * The bridge's own words for the same states, in one table.
 *
 * `finishing` has no job state of its own: the planner holds the last lines and the job cannot be
 * paused, but it is still running, so it is reported as started. The terminal words all mean the
 * job is over.
 */
const BRIDGE_JOB_STATES = {
    running: STARTED,
    finishing: STARTED,
    paused: PAUSED,
    stopping: STOPPING,
    done: IDLE,
    stopped: IDLE,
    error: IDLE,
    interrupted: IDLE,
    idle: IDLE,
};

/**
 * Translate a bridge job state into a job state, or null for a word this code does not know.
 * A null must leave the caller's state alone rather than be guessed at.
 */
export const jobStateForBridge = (bridgeState) =>
    (Object.prototype.hasOwnProperty.call(BRIDGE_JOB_STATES, bridgeState)
        ? BRIDGE_JOB_STATES[bridgeState]
        : null);

/** Every bridge word this code understands, for tests and diagnostics. */
export const BRIDGE_JOB_STATE_WORDS = Object.keys(BRIDGE_JOB_STATES);

export default jobStateForBridge;
