import socketClientManager from "../socket/socketClientManager";
import {
    GCODE_SENDER_STATUS_CHANGE,
    FRONT_END_POSITION_MONITOR,
    NETWORK_JOB_STATUS
} from "../constants";
import {isActiveJobState, jobStateForBridge} from "../../../shared/jobStates.mjs";

export const ACTION_SENDER_STATUS = 'jobTracker/senderStatus';
export const ACTION_BRIDGE_STATUS = 'jobTracker/bridgeStatus';
export const ACTION_STREAM_POSITION = 'jobTracker/streamPosition';
export const ACTION_RESET = 'jobTracker/reset';

const INITIAL_STATE = {
    active: false,
    status: 'idle',
    source: null,
    offloaded: false,
    positionSource: null,
    position: null,
    // Modal state while reading an offloaded job's last line.  The bridge
    // reports one line per status poll; absolute positions make the parser
    // robust to the lines it does not see.
    bridge: {id: null, x: 0, y: 0, z: 0, absolute: true, has: false},
};

const parseBridgeLine = (bridge, line) => {
    if (!line) return bridge;
    const code = String(line).split(';', 1)[0].trim();
    if (!code) return bridge;
    const parts = code.split(/\s+/);
    const cmd = parts[0].toUpperCase();
    let x = null, y = null, z = null;
    for (let i = 1; i < parts.length; i++) {
        const p = parts[i];
        if (p.length < 2) continue;
        const key = p[0].toUpperCase();
        if (key !== 'X' && key !== 'Y' && key !== 'Z') continue;
        const value = Number(p.slice(1));
        if (!Number.isFinite(value)) continue;
        if (key === 'X') x = value;
        else if (key === 'Y') y = value;
        else z = value;
    }
    let absolute = bridge.absolute;
    if (cmd === 'G90') absolute = true;
    else if (cmd === 'G91') absolute = false;

    let {x: cx, y: cy, z: cz, has} = bridge;
    if (cmd === 'G92') {
        if (x !== null) { cx = x; has = true; }
        if (y !== null) { cy = y; has = true; }
        if (z !== null) { cz = z; }
    } else if (cmd === 'G0' || cmd === 'G1' || cmd === 'G2' || cmd === 'G3') {
        if (x !== null) { cx = absolute ? x : cx + x; has = true; }
        if (y !== null) { cy = absolute ? y : cy + y; has = true; }
        if (z !== null) { cz = absolute ? z : cz + z; }
    }
    return {id: bridge.id, x: cx, y: cy, z: cz, absolute, has};
};

// --- Rules -----------------------------------------------------------------
// Each of these is one named transition.  The store used to reduce every
// change through a single "set these fields" action, which meant the rules
// below were only recoverable by reading three socket listeners in order.

// The sender owns the job while it is streaming: it is authoritative about
// "is a job running", but says nothing about an offloaded job's position.
const applySenderStatus = (state, {status, offloaded}) => ({
    ...state,
    active: status !== 'idle',
    status,
    source: status === 'idle' ? null : 'sender',
    offloaded: !!offloaded,
});

// An offloaded job runs on the printer's SD card, so the bridge (network job
// status) is the only source that knows where the head is.  Its acks make the
// normal position monitor report 0,0,0 -- so a stream position must be ignored
// in that mode, and while no job is running at all.
const applyStreamPosition = (state, position) => {
    if (!position) return state;
    if (state.offloaded || !state.active) return state;
    return {
        ...state,
        position: {x: position.x, y: position.y, z: position.z},
        positionSource: 'stream',
    };
};

// The bridge reports one line per poll.  Positions are accumulated into
// `bridge` (absolute lines replace, relative lines add) so a poll that only
// carries a status change does not lose the last known point.
const applyBridgeStatus = (state, job) => {
    let bridge = state.bridge;
    if (job.id && job.id !== bridge.id) {
        bridge = {id: job.id, x: 0, y: 0, z: 0, absolute: true, has: false};
    }
    const reported = job.position
        && Number.isFinite(job.position.x)
        && Number.isFinite(job.position.y)
        && Number.isFinite(job.position.z);
    if (reported) {
        bridge = {
            id: bridge.id,
            x: job.position.x,
            y: job.position.y,
            z: job.position.z,
            absolute: true,
            has: true,
        };
    } else if (job.line) {
        bridge = parseBridgeLine({...bridge, id: job.id || bridge.id}, job.line);
    }

    const applied = job.offset ? Number(job.offset.applied) : NaN;
    const position = reported
        ? {x: bridge.x, y: bridge.y, z: bridge.z}
        : (bridge.has
            ? {x: bridge.x, y: bridge.y, z: bridge.z + (Number.isFinite(applied) ? applied : 0)}
            : state.position);

    // The bridge has its own words for the same job states. Translate here, at the boundary, so
    // that `status` holds one vocabulary whatever the source. This used to be a second copy of the
    // map, and it had drifted: it counted the bridge's `finishing` as active while the server
    // ignored the word altogether.
    //
    // A word we do not know must not demote a running job, so `active` is left alone in that case
    // -- which is also what the server does. The position from the report is still used.
    const jobState = jobStateForBridge(job.state);

    return {
        ...state,
        active: jobState === null ? state.active : isActiveJobState(jobState),
        status: jobState || state.status,
        source: 'bridge',
        offloaded: true,
        positionSource: 'bridge',
        position,
        bridge,
    };
};

export const actions = {
    init: () => (dispatch, getState) => {
        socketClientManager.addServerListener(GCODE_SENDER_STATUS_CHANGE, (data) => {
            // Single commands (jogs, M105 polls) are not jobs and must not
            // flash the tracking pointer.
            if (!data || data.isJob !== true) return;
            dispatch(actions.senderStatus({status: data.curStatus, offloaded: data.offloaded}));
        });

        socketClientManager.addServerListener(FRONT_END_POSITION_MONITOR, (position) => {
            dispatch(actions.streamPosition(position));
        });

        socketClientManager.addServerListener(NETWORK_JOB_STATUS, (job) => {
            if (!job) return;
            dispatch(actions.bridgeStatus(job));
        });
    },

    senderStatus: ({status, offloaded}) => ({type: ACTION_SENDER_STATUS, status, offloaded}),

    streamPosition: (position) => ({type: ACTION_STREAM_POSITION, position}),

    bridgeStatus: (job) => ({type: ACTION_BRIDGE_STATUS, job}),

    reset: () => ({type: ACTION_RESET}),
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_SENDER_STATUS:
            return applySenderStatus(state, action);
        case ACTION_STREAM_POSITION:
            return applyStreamPosition(state, action.position);
        case ACTION_BRIDGE_STATUS:
            return applyBridgeStatus(state, action.job);
        case ACTION_RESET:
            return {...INITIAL_STATE};
        default:
            return state;
    }
}
