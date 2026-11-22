import io from '../socket/socketClientManager';
import {GCODE_SENDER_PROGRESS_CHANGE, NETWORK_JOB_STATUS} from '../constants';

// How much of the current job has gone out, for the canvas to paint over the drawing.
//
// One slice for both transports because the number means the same thing in both: executable lines from the
// top of the assembled job. Streamed jobs report it from the sender, offloaded jobs from the bridge's job
// snapshot, and a job the bridge ran while the app was closed is correct on the first update for the same
// reason.
export const ACTION_PROGRESS = 'plotProgress/progress';
export const ACTION_STARTED = 'plotProgress/started';
export const ACTION_CLEARED = 'plotProgress/cleared';

const INITIAL_STATE = {
    // Executable lines sent so far, and how many there are in total. -1 means "not plotted since the last
    // clear", which is what the canvas uses to decide there is nothing to paint.
    sent: -1,
    total: 0,
    active: false,
    // Per-model offsets into the assembled job, filled in when the gcode is generated.
    models: [],
};

const reducer = (state = INITIAL_STATE, action) => {
    switch (action.type) {
        case ACTION_PROGRESS:
            return {...state, sent: action.sent, total: action.total};
        case ACTION_STARTED:
            // A new job: nothing has been drawn in it yet. The drawing keeps its model offsets, which are
            // regenerated with the job.
            return {...state, sent: 0, total: action.total || 0, active: true, models: action.models || state.models};
        case ACTION_CLEARED:
            return {...INITIAL_STATE};
        default:
            return state;
    }
};

export const actions = {
    progress: (sent, total) => ({type: ACTION_PROGRESS, sent, total}),
    started: (total, models) => ({type: ACTION_STARTED, total, models}),
    cleared: () => ({type: ACTION_CLEARED}),
    /**
     * Subscribe to both progress sources.
     *
     * Streamed jobs emit a progress event per line, so the store is updated at the position monitor's
     * cadence instead: a repaint per line would be a repaint per line, and the canvas only has to look
     * current, not exact.
     */
    init: () => (dispatch) => {
        const MIN_INTERVAL_MS = 100;
        let lastAt = 0;
        let pending = null;
        const publish = () => {
            lastAt = Date.now();
            const {sent, total} = pending;
            pending = null;
            dispatch(actions.progress(sent, total));
        };
        const push = (sent, total) => {
            if (!Number.isFinite(sent) || !Number.isFinite(total)) return;
            pending = {sent, total};
            const elapsed = Date.now() - lastAt;
            if (elapsed >= MIN_INTERVAL_MS) publish();
            else if (!push.timer) {
                push.timer = setTimeout(() => {
                    push.timer = null;
                    pending && publish();
                }, MIN_INTERVAL_MS - elapsed);
            }
        };

        io.addServerListener(GCODE_SENDER_PROGRESS_CHANGE, ({total, sent}) => push(sent, total));
        io.addServerListener(NETWORK_JOB_STATUS, (job) => {
            if (!job) return;
            const total = Number(job.total);
            const sent = Number(job.sent);
            if (Number.isFinite(total) && Number.isFinite(sent) && total > 0) push(sent, total);
        });
    },
};

export default reducer;
