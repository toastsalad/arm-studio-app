/**
 * The job states shared by both senders, and the two transition tables that reach them.
 *
 * A job is run one of two ways: streamed from the desktop over the ack loop, or offloaded to the
 * Wi-Fi bridge which runs (and acks) it itself. The states themselves -- and the bridge's words for
 * them -- are shared with the browser, so they live in shared/jobStates.mjs; this file adds the two
 * transition tables, which only the server drives.
 *
 * Nothing in this module talks to a port, a socket or a clock: the tables only say which moves
 * are legal, and the senders attach the I/O to them.
 */

export {
    IDLE, UPLOADING, STARTED, PAUSED, STOPPING,
    JOB_STATES, ACTIVE_JOB_STATES, isActiveJobState, jobStateForBridge, BRIDGE_JOB_STATE_WORDS,
} from '../../../shared/jobStates.mjs';

// Re-exported names are not in scope here, and the tables below are keyed by them.
import {IDLE, UPLOADING, STARTED, PAUSED, STOPPING} from '../../../shared/jobStates.mjs';

/** Events raised by the streaming sender's own ack loop. */
export const STREAM = {
    START: 'START',
    PAUSE: 'PAUSE',
    RESUME: 'RESUME',
    STOP: 'STOP',
    /** The queue ran dry on its own: the job finished. */
    DRAINED: 'DRAINED',
    /** The stop safety tail finished. */
    STOPPED: 'STOPPED',
};

/** Events raised by the bridge's `!job` status poll. */
export const OFFLOAD = {
    START: 'START',
    /** The upload completed and the bridge accepted the job id. */
    UPLOADED: 'UPLOADED',
    UPLOAD_FAILED: 'UPLOAD_FAILED',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    STOPPING: 'STOPPING',
    /** done / stopped / error / interrupted / idle, all of which end the job here. */
    FINISHED: 'FINISHED',
};

const NO_TASK = 'No G-code sending task';
const STOPPING_WAIT = 'G-code sending task stopping, please wait';
const ALREADY_ACTIVE = 'An offloaded job is already active';

/**
 * The streaming sender: one line at a time over the serial/TCP ack loop.
 *
 *     idle <-------- drained ------- started
 *      |                              |   ^
 *      +--start--> started <--resume--+   |
 *                     |  |               |
 *                   pause stop           |
 *                     v  v               |
 *                  paused --stop--> stopping
 *                                        |
 *                                    stopped -> idle
 */
export const streamingJobTable = {
    [IDLE]: {
        [STREAM.START]: STARTED,
        [STREAM.PAUSE]: {refuse: NO_TASK},
        [STREAM.RESUME]: {refuse: NO_TASK},
        [STREAM.STOP]: {refuse: NO_TASK},
    },
    [STARTED]: {
        [STREAM.START]: {refuse: 'G-code sending task started, please do not repeat'},
        [STREAM.PAUSE]: PAUSED,
        [STREAM.RESUME]: {refuse: 'G-code sending task started, no need resume'},
        [STREAM.STOP]: STOPPING,
        [STREAM.DRAINED]: IDLE,
    },
    [PAUSED]: {
        [STREAM.START]: {refuse: 'G-code sending task paused, please resume or stop first'},
        [STREAM.PAUSE]: {refuse: 'G-code sending task paused, please do not repeat'},
        [STREAM.RESUME]: STARTED,
        [STREAM.STOP]: STOPPING,
    },
    [STOPPING]: {
        [STREAM.START]: {refuse: STOPPING_WAIT},
        [STREAM.PAUSE]: {refuse: STOPPING_WAIT},
        [STREAM.RESUME]: {refuse: STOPPING_WAIT},
        [STREAM.STOP]: {refuse: STOPPING_WAIT},
        [STREAM.STOPPED]: IDLE,
    },
};

/**
 * The offloaded sender: the bridge owns the ack loop, so every move here is a report from the
 * bridge, never a local decision. `UPLOADING` is a real state rather than a boolean because it
 * refuses a second job exactly like the other non-idle states do.
 *
 * `RUNNING`/`PAUSED`/`STOPPING` are accepted from every state, because connecting to a bridge
 * that is already running a job (started from its own web page or another client) must start
 * tracking it instead of ignoring it.
 */
const fromBridge = (to) => ({
    [OFFLOAD.RUNNING]: STARTED,
    [OFFLOAD.PAUSED]: PAUSED,
    [OFFLOAD.STOPPING]: STOPPING,
    [OFFLOAD.FINISHED]: IDLE,
    [OFFLOAD.START]: {refuse: ALREADY_ACTIVE},
    ...to,
});

export const offloadedJobTable = {
    [IDLE]: fromBridge({
        [OFFLOAD.START]: UPLOADING,
        [OFFLOAD.UPLOADED]: {refuse: 'No upload in progress'},
        [OFFLOAD.UPLOAD_FAILED]: {refuse: 'No upload in progress'},
    }),
    [UPLOADING]: fromBridge({
        [OFFLOAD.UPLOADED]: STARTED,
        [OFFLOAD.UPLOAD_FAILED]: IDLE,
    }),
    [STARTED]: fromBridge({}),
    [PAUSED]: fromBridge({}),
    [STOPPING]: fromBridge({}),
};
