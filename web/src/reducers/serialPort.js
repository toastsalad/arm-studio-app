import messageI18n from "../utils/messageI18n";
import socketClientManager from "../socket/socketClientManager";
import {
    SERIAL_PORT_PATH_UPDATE,
    SERIAL_PORT_GET_OPENED,
    SERIAL_PORT_OPEN,
    SERIAL_PORT_CLOSE,
    SERIAL_PORT_ERROR,
    SERIAL_PORT_DATA,
    SERIAL_PORT_WRITE,
    MSG_SERIAL_PORT_CLOSE_TOAST,
    NETWORK_DEVICE_DISCOVER,
    NETWORK_DEVICE_UPDATE,
    NETWORK_DEVICE_INFO,
    NETWORK_JOB_STATUS,
    NETWORK_LEVELING_STATUS
} from "../constants.js"
import {actions as tapsActions} from "./taps";
import {parsePositionReply} from "../../../shared/firmwareReply.mjs";

const ACTION_UPDATE_STATE = 'serialPort/ACTION_UPDATE_STATE';

const INITIAL_STATE = {
    paths: [],
    // Discovered bridges: [{path, arm, dev, baud, ...}]; "arm" is the bridge's own
    // report of whether the arm is attached ('up'|'waiting'|'unknown').
    networkDevices: [],
    networkScanning: false,
    // Arm state of the currently connected bridge; null while unknown.
    networkArm: null,
    // Last job/leveling snapshot from the bridge. They survive a disconnect
    // because the bridge keeps running the job.
    job: null,
    leveling: null,
    path: null // connected port path (COMx or tcp://host:port); empty means closed
};

// One outstanding query reply at a time (M114, M2101, M895). This is a small state machine:
// either nothing is pending, or we are waiting for the reply to exactly one G-code, and only the
// parse that completes clears it. It used to be two module variables (a type and a callback) that
// could disagree when a request replaced another.
let pendingReply = null; // {gcode, listener} while waiting, null when idle

const processGcodeResponseListen = (data) => {
    if (!pendingReply) return;
    if (!data) return;
    if (!data.received) return;

    const parser = REPLY_PARSERS[pendingReply.gcode];
    if (!parser) {
        console.log('add unsupported gcode listener')
        pendingReply = null;
        return;
    }
    if (parser(data.received, pendingReply.listener)) pendingReply = null;
}

const processM894 = (received, listener) => {
    const position = parsePositionReply(received);
    if (!position) return false;
    // M895 answers in whole steps.
    listener && listener(Math.trunc(position.x), Math.trunc(position.y), Math.trunc(position.z));
    return true;
}
const processM114 = (received, listener) => {
    const position = parsePositionReply(received);
    if (!position) return false;
    listener && listener(position.x, position.y, position.z);
    return true;
}

const processM2101 = (received, listener) => {
    console.log('M2101 result ' + received)
    const splitReceived = received.split('current positon = ')
    if (splitReceived.length === 2) {
        listener && listener(parseFloat(splitReceived[1]));
    return true
    } else {
        return false
    }
}

/** Reply parsers, keyed by the G-code whose reply they complete. */
const REPLY_PARSERS = {
    M895: processM894,
    M114: processM114,
    M2101: processM2101,
};

export const actions = {
    init: () => (dispatch) => {
        socketClientManager.addServerListener("connect", () => {
            dispatch(actions._updateState({paths: [], path: null}));
            socketClientManager.emitToServer(SERIAL_PORT_GET_OPENED);
        });
        socketClientManager.addServerListener("disconnect", () => {
            dispatch(actions._updateState({paths: [], path: null}));
        });
        socketClientManager.addServerListener(SERIAL_PORT_PATH_UPDATE, (paths) => {
            dispatch(actions._updateState({paths}));
        });
        socketClientManager.addServerListener(NETWORK_DEVICE_UPDATE, (devices) => {
            dispatch(actions._updateState({networkDevices: devices || [], networkScanning: false}));
        });
        socketClientManager.addServerListener(NETWORK_DEVICE_INFO, (info) => {
            dispatch(actions._updateState({networkArm: info || null}));
        });
        socketClientManager.addServerListener(NETWORK_JOB_STATUS, (job) => {
            dispatch(actions._updateState({job: job || null}));
        });
        socketClientManager.addServerListener(NETWORK_LEVELING_STATUS, (leveling) => {
            dispatch(actions._updateState({leveling: leveling || null}));
        });
        socketClientManager.addServerListener(SERIAL_PORT_GET_OPENED, (path) => {
            dispatch(actions._updateState({path}));
        });
        socketClientManager.addServerListener(SERIAL_PORT_OPEN, (path) => {
            // A bridge reports its arm link asynchronously, so drop any stale
            // value until its first reply lands.
            dispatch(actions._updateState({path, networkArm: null}));
        });
        socketClientManager.addServerListener(SERIAL_PORT_CLOSE, (path) => {
            dispatch(tapsActions.setTerminalVisible(false))
            dispatch(actions._updateState({path: null, networkArm: null}));
        });
        socketClientManager.addServerListener(SERIAL_PORT_ERROR, () => {
            console.error("serial port -> err");
            dispatch(actions._updateState({path: null, networkArm: null}));
        });
        socketClientManager.addServerListener(SERIAL_PORT_DATA, (data) => {
            if (!data) return;

            processGcodeResponseListen(data);

            let received = data.received || '';

            if (received.toLowerCase().includes('error')) {
                messageI18n.error(received)
            }

            if (received.indexOf("beyound limit..") !== -1) {
                received = received.replace("beyound", "beyond");
            }
            if (
                received.indexOf("beyond limit..") !== -1 ||
                received.indexOf("Send M1112 or click HOME to initialize DexArm first before any motion") !== -1 ||
                received.indexOf("Warning!Laser protection door opened") !== -1 ||
                received.indexOf("Laser protection door closed") !== -1
            ) {
                messageI18n.warning(received);
            }
        });
    },
    _updateState: (state) => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
    },
    discoverNetwork: () => (dispatch) => {
        dispatch(actions._updateState({networkScanning: true, networkDevices: []}));
        socketClientManager.emitToServer(NETWORK_DEVICE_DISCOVER);
    },
    open: (path) => () => {
        console.log("path: " + path)
        socketClientManager.emitToServer(SERIAL_PORT_OPEN, path);
        return {type: '@@arm-studio/NOOP'};
    },
    close: () => () => {
        socketClientManager.emitToServer(SERIAL_PORT_CLOSE);
        return {type: '@@arm-studio/NOOP'};
    },
    //data: string|Buffer|Array<number>
    write: (data) => (dispatch, getState) => {
        if (getState().serialPort.path) {
            socketClientManager.emitToServer(SERIAL_PORT_WRITE, data);
        } else {
            messageI18n.warning(MSG_SERIAL_PORT_CLOSE_TOAST);
        }
        return {type: '@@arm-studio/NOOP'};
    },

    // Register a one-shot callback for the reply to a query G-code, e.g. M114.
    addOneShootGcodeResponseListener: (gcode, listener) => (dispatch, getState) => {
        console.log('listen gcode = ' + gcode)
        // One outstanding query: a second request replaces the first, which is what the UI
        // wants (the newer panel is the one still on screen).
        pendingReply = {gcode, listener};
        dispatch(actions.write(gcode + '\n'));
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE: {
            return Object.assign({}, state, action.state);
        }
        default:
            return state;
    }
}
