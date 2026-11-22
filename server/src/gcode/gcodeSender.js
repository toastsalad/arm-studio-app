import EventEmitter from 'events';
import serialPortManager from '../serialPortManager.js';
import deviceStateMonitor from '../deviceStateMonitor.js';
import {createStateMachine} from '../stateMachine.mjs';
import {createSerialQueue} from '../../../shared/serialQueue.mjs';
import {IDLE, STREAM, STARTED, isActiveJobState, streamingJobTable} from './jobStates.mjs';
import {GCODE_SENDER_REFUSE, GCODE_SENDER_STATUS_CHANGE, GCODE_SENDER_PROGRESS_CHANGE} from "../constants";
import {log} from '../../../shared/log.mjs';

// Status-free command
const noStatusLimitGcodes = ['M105']

/**
 * Streams G-code to the arm one line at a time, waiting for each `ok`.
 *
 * The state graph (idle -> started <-> paused -> stopping -> idle) lives in `jobStates.mjs` as a
 * transition table; this class only supplies the I/O each state needs, so "can I pause right
 * now, and what should I say if not" is answered in one place instead of four hand-written
 * switches.
 */
class GcodeSender extends EventEmitter {
    constructor() {
        super();
        this.lines = [];
        this.total = 0; // line count of gcode
        this.sent = 0;  // line count of gcode sent
        this.taskId = null;
        this.isAckChange = false;
        this.isLaser = false;
        this.isJob = false; // a full job, not a single jog or M105 poll

        // One command outstanding at a time. `stop()` can be called while a job line is being
        // acked, and its safety tail writes too; without this, two 'ok' listeners competed for one
        // reply and the sender could run ahead of the machine.
        this.send = createSerialQueue();

        this.machine = createStateMachine({
            name: 'gcodeSender',
            initial: IDLE,
            states: streamingJobTable,
            // Every field the status event carries is set before the event is fired, so the
            // announcement describes the job that is actually starting/stopping.
            onTransition: ({from, to}) => {
                if (!this.isAckChange) return;
                this.emit(GCODE_SENDER_STATUS_CHANGE, {
                    preStatus: from,
                    curStatus: to,
                    taskId: this.taskId,
                    isJob: this.isJob,
                    offloaded: false,
                });
            },
        });
    }

    /** The state name, read-only: drive the sender with the methods below, not by assignment. */
    get curStatus() {
        return this.machine.state;
    }

    get isActive() {
        return isActiveJobState(this.machine.state);
    }

    _emitProgress() {
        if (this.isAckChange) {
            this.emit(GCODE_SENDER_PROGRESS_CHANGE, {total: this.total, sent: this.sent, taskId: this.taskId});
        }
    }

    /** Reject with the table's message, or report a pair the table does not describe. */
    _refuse(result) {
        if (result.reason === 'refused') {
            this.emit(GCODE_SENDER_REFUSE, {msg: result.refuse});
            return;
        }
        log.warn(`gcodeSender: '${result.event}' is not a valid event in state '${result.from}'`);
    }

    async start(gcode, isAckChange, isLaser, taskId) {
        if (!serialPortManager.getOpened()) {
            const msg = "Please connect DexArm first";
            this.emit(GCODE_SENDER_REFUSE, {msg});
            return;
        }
        if (!serialPortManager.readLineParser) {
            const msg = "Param error: readLineParser is null";
            this.emit(GCODE_SENDER_REFUSE, {msg});
            return;
        }
        if (deviceStateMonitor.isLaserCoverOpened && isLaser) {
            const msg = "Laser cover opened, please close first";
            this.emit(GCODE_SENDER_REFUSE, {msg});
            return;
        }
        log.debug(`current status ${this.machine.state}`)

        // Status-free commands jump the queue when not ready
        if (noStatusLimitGcodes.includes(gcode)
            && !this.machine.is(IDLE)
            && this.lines[0] !== gcode) {
            const gcodeLines = gcode
                .trim().split('\n')
                .filter((line) => line.trim().indexOf(";") !== 0 && line.trim().length > 0);
            this.lines.unshift(...gcodeLines)

            log.debug('prepend status-free command ' + gcode)
            log.debug(gcodeLines)
            return
        }

        const queued = this.machine.can(STREAM.START);
        if (!queued.ok) {
            this._refuse(queued);
            return;
        }

        // Fill in this job before the transition announces it.
        this.lines = gcode
            .trim()
            .split('\n')
            .filter((line) => {
                return (line.trim().indexOf(";") !== 0 && line.trim().length > 0)
            });
        this.total = this.lines.length;
        this.sent = 0;
        this.taskId = taskId;
        this.isAckChange = isAckChange;
        this.isLaser = isLaser;
        this.isJob = !!isAckChange;

        this.machine.fire(STREAM.START);
        await this._startSend();
    }

    _reset() {
        log.info('server reset')

        this.lines = [];
        this.total = 0;
        this.sent = 0;
        this.taskId = null;
        this.isAckChange = false;
        this.isLaser = false;
        this.isJob = false; // a full job, not a single jog or M105 poll
        this.machine.reset(IDLE);
    }

    /** Force the sender back to idle, e.g. after a reconnect. Silent by design. */
    reset() {
        this._reset();
    }

    async _startSend() {
        log.info('server start sending')

        while (this.machine.is(STARTED)) {
            const line = this.lines.shift();
            if (line) {
                log.debug('line exists')
                ++this.sent;
                await this.send(() => this._sendLine(line));
                log.debug('send line done')
                this._emitProgress();
            } else {
                log.debug('line missing')
                this.machine.fire(STREAM.DRAINED);
                this._reset();
                break;
            }
        }
    }

    _sendLine(line) {
        log.debug(`send line ${line}`)

        return new Promise((resolve) => {
            serialPortManager.write(`${line}\n`);
            log.debug(`serial write ${line}`)
            const onData = (data) => {
                data = data.trim();
                log.debug(`serial response ${data}`)

                if (data.startsWith('T:')) {
                    data = `ok ${data}`
                }

                if (data.indexOf("ok") === 0) {
                    serialPortManager.readLineParser.removeListener('data', onData);
                    log.debug('serial ok, remove data listener')
                    resolve();
                } else if (data.indexOf("wait") === 0) {
                    serialPortManager.write(`${line}\n`)
                    log.debug(`serial wait, rewrite ${line}`)
                } else if (data === 'Warning!Laser protection door opened') {
                    log.warn('laser warning')
                    if (this.isLaser) {
                        this.pause();
                    }
                }
            };
            serialPortManager.readLineParser.on('data', onData);
        });
    }

    pause() {
        log.info('server pause')
        const result = this.machine.fire(STREAM.PAUSE);
        if (!result.ok) this._refuse(result);
    }

    async resume() {
        log.info('server resume')

        if (deviceStateMonitor.isLaserCoverOpened && this.isLaser) {
            const msg = "Laser cover opened, please close first";
            this.emit(GCODE_SENDER_REFUSE, {msg});
            return;
        }
        const result = this.machine.fire(STREAM.RESUME);
        if (!result.ok) {
            this._refuse(result);
            return;
        }
        await this._startSend();
    }

    async stop() {
        log.info('server stop')

        // The queue is dropped first: whatever the transition says, these lines are not wanted.
        const result = this.machine.fire(STREAM.STOP);
        if (!result.ok) {
            this._refuse(result);
            return;
        }
        this.lines = [];

        // On stop: laser off, Z +10mm, 3D-print temp 0
        const lines = ['M5', 'M104 S0', 'G91', 'G0 Z10', 'G90'];
        while (true) {
            const line = lines.shift();
            if (line) {
                await this.send(() => this._sendLine(line));
            } else {
                this.machine.fire(STREAM.STOPPED);
                this._reset();
                break;
            }
        }
    }
}

const gcodeSender = new GcodeSender();
export default gcodeSender;
