import messageI18n from "../utils/messageI18n";
import socketClientManager from "../socket/socketClientManager";
import {
    GCODE_SENDER_STATUS_CHANGE,
    GCODE_SENDER_REFUSE,
    GCODE_SENDER_START,
    GCODE_SENDER_STOP,
    GCODE_SENDER_PAUSE,
    GCODE_SENDER_RESUME,
    GCODE_SENDER_ABORT,
    GCODE_SENDER_PROGRESS_CHANGE
} from "../constants";

const onProgress = ({total, sent, taskId}) => {
    console.log("progress: " + (sent / total))
};

let _listenersByTask = new Map();

// startJob() runs a full job (possibly offloaded to the bridge) and does not know
// its wire taskId, so its listeners are owned by the job itself.
const JOB_TASK_KEY = 'job';

/**
 * Register this module's progress/status listeners under `taskKey`, replacing only
 * the listeners that key already owns.
 *
 * The handles used to live in two module variables, so any second caller
 * (a jog, a second panel's short task) silently unwired the first caller's
 * subscription. Keying the handles by task keeps each caller's subscription
 * independent: only the same key is replaced, and only by its own owner.
 */
const listenForTask = (taskKey, {progress = true, status = true} = {}) => {
    stopListeningForTask(taskKey);
    const handles = {progress: null, status: null};
    if (progress) {
        handles.progress = socketClientManager.addServerListener(GCODE_SENDER_PROGRESS_CHANGE, onProgress);
    }
    if (status) {
        handles.status = socketClientManager.addServerListener(GCODE_SENDER_STATUS_CHANGE, onStatusChange);
    }
    _listenersByTask.set(taskKey, handles);
};

const stopListeningForTask = (taskKey) => {
    const handles = _listenersByTask.get(taskKey);
    if (!handles) return;
    if (handles.progress) socketClientManager.removeServerListener(GCODE_SENDER_PROGRESS_CHANGE, handles.progress);
    if (handles.status) socketClientManager.removeServerListener(GCODE_SENDER_STATUS_CHANGE, handles.status);
    _listenersByTask.delete(taskKey);
};

/**
 * What the user is told about each legal move of a job.
 *
 * The server's job state graph is a transition table (server/src/gcode/jobStates.mjs); this is the
 * same graph with the wording attached. It used to be an if/else chain of `preStatus`/`curStatus`
 * pairs, which silently said nothing about any move it did not list -- including the
 * `uploading -> started` step an offloaded job makes.
 */
const TRANSITION_MESSAGES = {
    idle: {started: 'Task started'},
    uploading: {started: 'Task started', idle: 'Task upload failed'},
    started: {idle: 'Task completed', stopping: 'Task stopping', paused: 'Task paused'},
    paused: {started: 'Task resumed', stopping: 'Task stopping'},
    stopping: {idle: 'Task stopped'},
};

const onStatusChange = ({preStatus, curStatus, taskId}) => {
    console.log(`gcode sender status: ${preStatus} => ${curStatus}`);
    const message = TRANSITION_MESSAGES[preStatus] && TRANSITION_MESSAGES[preStatus][curStatus];
    if (message) messageI18n.success(message);
};

export const actions = {
    init: () => (dispatch, getState) => {
        socketClientManager.addServerListener("connect", () => {
            socketClientManager.emitToServer(GCODE_SENDER_STATUS_CHANGE);
        });
        socketClientManager.addServerListener(GCODE_SENDER_REFUSE, (data) => {
            messageI18n.warning(data.msg);
        });
    },
    /**
     * @param gcode
     * @param isAckChange callback on status/progress change
     * @param taskId
     * @param isLaser
     * @returns {{type: '@@arm-studio/NOOP'}}
     */
    startTask: (gcode, isAckChange = false, isLaser = false, taskId = null, isListenProgress = true, isListenStatus = true) => {
        listenForTask(taskId, {progress: isListenProgress, status: isListenStatus});
        socketClientManager.emitToServer(GCODE_SENDER_START, {gcode, isAckChange, isLaser, taskId});
        return {type: '@@arm-studio/NOOP'};
    },

    // Unwire a task without starting anything (a panel that is going away, say).
    stopListening: (taskId = null) => {
        stopListeningForTask(taskId);
        return {type: '@@arm-studio/NOOP'};
    },

    // Start a full job. The bridge can run it after the desktop is switched off.
    startJob: (gcode, {isLaser = false, mode = 'custom', offload = false} = {}) => {
        listenForTask(JOB_TASK_KEY);
        socketClientManager.emitToServer(GCODE_SENDER_START, {
            gcode,
            isAckChange: true,
            isLaser,
            taskId: null,
            offload,
            mode,
        });
        return {type: '@@arm-studio/NOOP'};
    },
    stopTask: () => {
        socketClientManager.emitToServer(GCODE_SENDER_STOP);
        return {type: '@@arm-studio/NOOP'};
    },
    abortTask: () => {
        socketClientManager.emitToServer(GCODE_SENDER_ABORT);
        return {type: '@@arm-studio/NOOP'};
    },
    pauseTask: () => {
        socketClientManager.emitToServer(GCODE_SENDER_PAUSE);
        return {type: '@@arm-studio/NOOP'};
    },
    resumeTask: () => {
        socketClientManager.emitToServer(GCODE_SENDER_RESUME);
        return {type: '@@arm-studio/NOOP'};
    }
};
