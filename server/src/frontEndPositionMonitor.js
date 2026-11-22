import {
    FRONT_END_POSITION_MONITOR,
    SERIAL_PORT_CLOSE,
    SERIAL_PORT_DATA, SERIAL_PORT_ERROR,
    SERIAL_PORT_OPEN, SERIAL_PORT_WRITE_ERROR,
    SERIAL_PORT_WRITE_OK,
    TEMPERATURE_MONITOR
} from "./constants";
import EventEmitter from "events";
import serialPortManager from "./serialPortManager";
import {createStateMachine} from "./stateMachine.mjs";
import {parsePositionReply} from "../../shared/firmwareReply.mjs";
import {log} from '../../shared/log.mjs';

// The arm's position is tracked optimistically from the lines we write, then corrected when the
// firmware answers. Two things therefore have to be tracked explicitly:
//
//   * whether an M114 query is outstanding (its reply is a bare `X:.. Y:.. Z:..` line, which is
//     indistinguishable from noise unless we know we asked for it), and
//   * whether the next motion command's coordinates are absolute or relative.
//
// Both used to be booleans (`needProcessM114`, `isAbsolutePosition`) set and cleared from a dozen
// handlers, so a missed clear left the monitor permanently consuming lines as coordinates. The
// outstanding query is now a state machine, and the absolute/relative choice is a named mode.

const REPLY_IDLE = 'idle';
const REPLY_AWAITING_M114 = 'awaiting-m114';

const M114_REQUESTED = 'M114_REQUESTED';
const M114_ANSWERED = 'M114_ANSWERED';
const QUERY_CANCELLED = 'QUERY_CANCELLED';

export const replyTable = {
    [REPLY_IDLE]: {
        [M114_REQUESTED]: REPLY_AWAITING_M114,
        [QUERY_CANCELLED]: REPLY_IDLE,
    },
    // A second M114 before the first is answered leaves one query outstanding, not two.
    [REPLY_AWAITING_M114]: {
        [M114_REQUESTED]: REPLY_AWAITING_M114,
        [M114_ANSWERED]: REPLY_IDLE,
        [QUERY_CANCELLED]: REPLY_IDLE,
    },
};

export const ABSOLUTE = 'absolute';
export const RELATIVE = 'relative';

/**
 * Ordered command dispatch. The order is the data: the first prefix that matches wins, so
 * `G92.1` has to come before `G92`, and the old if/else chain encoded exactly this without saying
 * so. Adding a command is one row; reordering them is visible.
 */
const COMMAND_HANDLERS = [
    {prefix: 'G0', handler: 'onWriteG0'},
    {prefix: 'G1', handler: 'onWriteG1'},
    {prefix: 'G90', handler: 'onWriteG90'},
    {prefix: 'G91', handler: 'onWriteG91'},
    {prefix: 'G92.1', handler: 'onWriteG92_1'},
    {prefix: 'G92', handler: 'onWriteG92'},
    {prefix: 'M1112', handler: 'onWriteM1112'},
    {prefix: 'M114', handler: 'onWriteM114'},
];

class FrontEndPositionMonitor extends EventEmitter {
    constructor() {
        super();
        this.reply = createStateMachine({
            name: 'frontEndPositionMonitor.reply',
            initial: REPLY_IDLE,
            states: replyTable,
        });
        this.positionMode = ABSOLUTE;
    }

    registerListeners() {
        if (this._listenersRegistered) {
            return;
        }
        this._listenersRegistered = true;
        serialPortManager.on(SERIAL_PORT_OPEN, () => {
            this.onOpen();
        });
        serialPortManager.on(SERIAL_PORT_CLOSE, () => {
            this.onClose();
        });
        serialPortManager.on(SERIAL_PORT_ERROR, () => {
            this.onError();
        });
        serialPortManager.on(SERIAL_PORT_DATA, ({received}) => {
            this.onRead(received);
        });
        serialPortManager.on(SERIAL_PORT_WRITE_OK, (data) => {
            this.onWrite(data);
        });
        serialPortManager.on(SERIAL_PORT_WRITE_ERROR, (data) => {
            this.onWriteError();
        });
    }

    get isAbsolutePosition() {
        return this.positionMode === ABSOLUTE;
    }

    get needProcessM114() {
        return this.reply.is(REPLY_AWAITING_M114);
    }

    resetPosition() {
        this.currentX = 0;
        this.currentY = 0
        this.currentZ = 0;
        this.currentE = 0;
        this.nextX = 0;
        this.nextY = 0;
        this.nextZ = 0;
        this.nextE = 0;
        this.positionMode = ABSOLUTE;
        this.reply.reset(REPLY_IDLE);
    }

    onOpen() {
        this.resetPosition();
        this.sendPosition();
    }

    onClose() {
        this.resetPosition();
        this.sendPosition();
    }

    onError() {
        this.resetPosition();
        this.sendPosition();
    }

    onWriteError() {
        this.resetPosition();
        this.sendPosition();
    }

    onReadOk() {
        this.currentX = this.nextX;
        this.currentY = this.nextY;
        this.currentZ = this.nextZ;
        this.currentE = this.nextE;
        this.sendPosition();
    }

    onWrite(line) {
        if (!line) {
            return;
        }

        if (line.startsWith('N')) {
            const indexOfSpace = line.indexOf(' ');
            line = line.slice(indexOfSpace + 1, line.length)
        }
        if (line.lastIndexOf('*') > 0) {
            const lastIndexOfStar = line.lastIndexOf('*');
            line = line.slice(0, lastIndexOfStar);
        }
        line = line.trim();

        for (const {prefix, handler} of COMMAND_HANDLERS) {
            if (!line.startsWith(prefix)) continue;
            this[handler](line);
            return;
        }
    }

    onRead(line) {
        log.debug(`frontEndPositionMonitor line ${line}`)
        if (!line) {
            return;
        }

        if (line.startsWith('ok') || line.startsWith('T:')) {
            if (line.startsWith('ok T:') || line.startsWith('T:')) {
                log.debug('frontEndPositionMonitor send temperature')
                this.sendTemperature(line)
                return
            }

            this.onReadOk();
            return;
        }

        // Anything that is not an ack is only meaningful if it is the answer to a query we made.
        if (this.needProcessM114) {
            this.processM114(line);
        }
    }

    sendPosition() {
        this.currentX = Math.round((this.currentX) * 10) / 10
        this.currentY = Math.round((this.currentY) * 10) / 10
        this.currentZ = Math.round((this.currentZ) * 10) / 10
        this.currentE = Math.round((this.currentE) * 10) / 10

        const position = {
            x: this.currentX,
            y: this.currentY,
            z: this.currentZ,
            e: this.currentE
        };
        this.emit(FRONT_END_POSITION_MONITOR, position);
    }

    sendTemperature (receive) {
        this.emit(TEMPERATURE_MONITOR, receive)
    }

    onWriteG0(line) {
        this.setNextPosition(line);
    }

    onWriteG1(line) {
        this.setNextPosition(line);
    }

    onWriteG90() {
        this.positionMode = ABSOLUTE;
    }

    onWriteG91() {
        this.positionMode = RELATIVE;
    }

    onWriteG92(line) {
        this.currentZ = this.nextZ = 0;
        // M114 and the new value can race because transfers are event-based, which would
        // leave the UI showing stale coordinates.
        this.reply.fire(QUERY_CANCELLED);
        this.sendPosition();
    }

    onWriteG92_1(line) {
    }

    onWriteM1112() {
    }

    onWriteM114() {
        this.reply.fire(M114_REQUESTED);
    }

    processM114(line) {
        const position = parsePositionReply(line);
        if (!position) return;
        this.nextX = position.x;
        this.nextY = position.y;
        this.nextZ = position.z;
        // E is optional on firmware that does not report it.
        if (position.e !== undefined) this.nextE = position.e;
        this.reply.fire(M114_ANSWERED);
        this.sendPosition();
    }

    setNextPosition(line) {
        let x = Number.MIN_VALUE;
        let y = Number.MIN_VALUE;
        let z = Number.MIN_VALUE;
        let extruder = Number.MIN_VALUE;
        line.split(' ').forEach((value) => {
            if (value.startsWith('X')) {
                x = parseFloat(value.slice(1, value.length));
            } else if (value.startsWith('Y')) {
                y = parseFloat(value.slice(1, value.length));

            } else if (value.startsWith('Z')) {
                z = parseFloat(value.slice(1, value.length));
            } else if (value.startsWith('E')) {
                extruder = parseFloat(value.slice(1, value.length));
            }
        });

        if (this.isAbsolutePosition) {
            this.nextX = (x === Number.MIN_VALUE || Number.isNaN(x)) ? this.nextX : x;
            this.nextY = (y === Number.MIN_VALUE || Number.isNaN(y)) ? this.nextY : y;
            this.nextZ = (z === Number.MIN_VALUE || Number.isNaN(z)) ? this.nextZ : z;
            this.nextE = (extruder === Number.MIN_VALUE || Number.isNaN(extruder)) ? this.nextE : extruder;
        } else {
            this.nextX += (x === Number.MIN_VALUE || Number.isNaN(x)) ? 0 : x;
            this.nextY += (y === Number.MIN_VALUE || Number.isNaN(y)) ? 0 : y;
            this.nextZ += (z === Number.MIN_VALUE || Number.isNaN(z)) ? 0 : z;
            this.nextE += (extruder === Number.MIN_VALUE || Number.isNaN(extruder)) ? 0 : extruder;
        }
    }
}

const frontEndPositionMonitor = new FrontEndPositionMonitor();
export default frontEndPositionMonitor;
