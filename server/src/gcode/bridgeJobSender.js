import EventEmitter from 'events';
import http from 'http';
import serialPortManager from '../serialPortManager.js';
import {createStateMachine} from '../stateMachine.mjs';
import {
    IDLE,
    OFFLOAD,
    PAUSED,
    STARTED,
    UPLOADING,
    isActiveJobState,
    jobStateForBridge,
    offloadedJobTable,
} from './jobStates.mjs';
import {
    GCODE_SENDER_REFUSE,
    GCODE_SENDER_STATUS_CHANGE,
    GCODE_SENDER_PROGRESS_CHANGE,
    NETWORK_JOB_STATUS,
} from '../constants.js';
import {log} from '../../../shared/log.mjs';

const POLL_MS = 250; // position tracking; a status reply is a single line
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

const parseNetworkPath = (path) => {
    const match = /^tcp:\/\/([^:/]+):(\d+)$/i.exec(path || '');
    return match ? {host: match[1], port: parseInt(match[2], 10)} : null;
};

/**
 * Offloads a whole job to the bridge and follows it by polling !job status.
 *
 * The bridge owns the ack loop, so this module never writes G-code. It only uploads, sends
 * !job commands and maps the bridge state onto the existing sender status/progress events.
 *
 * The states are the same ones the streaming sender uses (`jobStates.mjs`); what differs is
 * who moves between them: here the bridge reports, and this class only translates a report into
 * an event. `active` and `uploading` are therefore derived from the state instead of being
 * separate flags that could disagree with it.
 */
class BridgeJobSender extends EventEmitter {
    constructor() {
        super();
        this.jobId = null;
        this.taskId = null;
        this.total = 0;
        this.sent = 0;
        this.isLaser = false;
        this.mode = 'custom';
        this.lastStatus = null;
        this.pollTimer = null;

        this.machine = createStateMachine({
            name: 'bridgeJobSender',
            initial: IDLE,
            states: offloadedJobTable,
            onTransition: ({from, to}) => {
                this.emit(GCODE_SENDER_STATUS_CHANGE, {
                    preStatus: from,
                    curStatus: to,
                    taskId: this.taskId,
                    isJob: true,
                    offloaded: true,
                });
            },
        });

        serialPortManager.on(NETWORK_JOB_STATUS, (status) => this._onStatus(status));
    }

    get state() {
        return this.machine.state;
    }

    /** True while the bridge is running, holding or stopping a job we started or adopted. */
    get active() {
        return isActiveJobState(this.machine.state);
    }

    /** True while the G-code is still being uploaded to the bridge. */
    get uploading() {
        return this.machine.is(UPLOADING);
    }

    _refuse(msg) {
        this.emit(GCODE_SENDER_REFUSE, {msg});
    }

    /** Report a pair the table does not describe, rather than swallowing it. */
    _fire(event) {
        const result = this.machine.fire(event);
        if (!result.ok && result.reason === 'unknown') {
            log.warn(`bridgeJobSender: '${event}' is not a valid event in state '${result.from}'`);
        }
        return result;
    }

    _send(command) {
        if (!serialPortManager.getOpened()) return false;
        serialPortManager.write(command + '\n');
        return true;
    }

    start({gcode, isLaser = false, mode = 'custom', taskId = null}) {
        const accepted = this.machine.can(OFFLOAD.START);
        if (!accepted.ok) {
            this._refuse(accepted.refuse || 'An offloaded job is already active');
            return;
        }

        const path = serialPortManager.getOpened();
        const address = parseNetworkPath(path);
        const info = serialPortManager.getInfo();
        if (!address || !info) {
            this._refuse('Connect to a network bridge before offloading');
            return;
        }
        if (!info.jobs) {
            this._refuse('This bridge does not support offloaded jobs. Update the bridge firmware.');
            return;
        }
        if (!gcode || !gcode.trim()) {
            this._refuse('Generate G-code first');
            return;
        }

        this.taskId = taskId;
        this.isLaser = !!isLaser;
        this.mode = mode || 'custom';
        this.jobId = null;
        this.total = 0;
        this.sent = 0;
        this.lastStatus = null;

        this._fire(OFFLOAD.START);
        this._upload(gcode, address.host, info.jobs)
            .then((meta) => {
                this.jobId = meta.id;
                this.total = meta.lines || 0;
                this._fire(OFFLOAD.UPLOADED);
                if (!this._send('!job start ' + meta.id)) {
                    this._fire(OFFLOAD.FINISHED);
                    this._refuse('Lost the bridge connection after upload');
                    return;
                }
                this._startPolling();
            })
            .catch((e) => {
                this._fire(OFFLOAD.UPLOAD_FAILED);
                this._refuse('Offload failed: ' + (e && e.message || e));
            });
    }

    _upload(gcode, host, port) {
        return new Promise((resolve, reject) => {
            const body = Buffer.isBuffer(gcode) ? gcode : Buffer.from(gcode, 'utf8');
            const req = http.request({
                host,
                port,
                path: '/job',
                method: 'POST',
                timeout: UPLOAD_TIMEOUT_MS,
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': body.length,
                    'X-Job-Name': 'arm-studio-' + Date.now() + '.gcode',
                    'X-Job-Mode': this.mode,
                    'X-Job-Laser': this.isLaser ? '1' : '0',
                },
            }, (res) => {
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    const text = Buffer.concat(chunks).toString('utf8');
                    let parsed = null;
                    try {
                        parsed = JSON.parse(text);
                    } catch (e) {
                        // fall through to the status check
                    }
                    if (res.statusCode >= 200 && res.statusCode < 300 && parsed && parsed.id) {
                        resolve(parsed);
                    } else {
                        reject(new Error((parsed && parsed.error) || ('HTTP ' + res.statusCode)));
                    }
                });
            });
            req.on('timeout', () => req.destroy(new Error('upload timed out')));
            req.on('error', reject);
            req.end(body);
        });
    }

    _startPolling() {
        this._stopPolling();
        this.queryStatus();
        this.pollTimer = setInterval(() => this.queryStatus(), POLL_MS);
    }

    _stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    queryStatus() {
        // Query even without a job id, so connecting to a bridge that is already
        // running a job starts tracking it.
        this._send('!job status');
    }

    _onStatus(status) {
        if (!status || typeof status !== 'object') return;
        if (status.ok === false && !status.state) {
            this._refuse(status.error || 'The bridge refused the job');
            this._stopPolling();
            this._fire(OFFLOAD.FINISHED);
            return;
        }
        this.lastStatus = status;
        if (status.total !== undefined) this.total = status.total;
        if (status.sent !== undefined) this.sent = status.sent;
        this.emit(GCODE_SENDER_PROGRESS_CHANGE, {
            total: this.total,
            sent: this.sent,
            taskId: this.taskId,
        });

        // One vocabulary for the bridge's words, shared with the browser (shared/jobStates.mjs).
        // The word list used to be spelled out here and again in jobTracker, and the two copies
        // disagreed about `finishing`.
        const bridgeState = status.state;
        const jobState = jobStateForBridge(bridgeState);
        if (jobState === null) return;

        if (jobState === IDLE) {
            if (this.active) {
                if (bridgeState === 'error' || bridgeState === 'interrupted') {
                    this._refuse(status.error || ('Job ' + bridgeState));
                }
                this._fire(OFFLOAD.FINISHED);
            }
            this._stopPolling();
            return;
        }

        if (jobState === STARTED) this._fire(OFFLOAD.RUNNING);
        else if (jobState === PAUSED) this._fire(OFFLOAD.PAUSED);
        else this._fire(OFFLOAD.STOPPING);
    }

    pause() {
        if (!this.active) {
            this._refuse('No offloaded job is active');
            return;
        }
        this._send('!job pause');
    }

    resume() {
        if (!this.active) {
            this._refuse('No offloaded job is active');
            return;
        }
        this._send('!job resume');
    }

    stop() {
        if (!this.active) {
            this._refuse('No offloaded job is active');
            return;
        }
        this._send('!job stop');
    }

    abort() {
        if (!this.jobId) {
            this._refuse('No offloaded job is active');
            return;
        }
        this._send('!job abort');
    }

    onSerialOpen() {
        // A reconnect during a job should restore the UI, not start anything.
        // The query also discovers a job that was started from the bridge page
        // or another client.
        this.queryStatus();
        if (!this.pollTimer) this._startPolling();
    }

    onSerialClose() {
        // The job keeps running on the bridge. Stop polling; reconnect will resume it.
        this._stopPolling();
    }
}

const bridgeJobSender = new BridgeJobSender();
export default bridgeJobSender;
