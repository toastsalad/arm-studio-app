import EventEmitter from 'events';
import serialPortManager from './serialPortManager.js';
import {createStateMachine} from './stateMachine.mjs';
import {SERIAL_PORT_DATA} from "./constants";

// The firmware announces the laser cover only when it changes, so its state is whatever the last
// announcement said -- it is never asked. Two exact-match lines are the only inputs; anything
// else on the wire is not about the cover.
export const COVER_CLOSED = 'closed';
export const COVER_OPENED = 'opened';

export const COVER_OPENED_LINE = 'Warning!Laser protection door opened';
export const COVER_CLOSED_LINE = 'Laser protection door closed';

export const coverTable = {
    [COVER_CLOSED]: {
        [COVER_OPENED_LINE]: COVER_OPENED,
        [COVER_CLOSED_LINE]: COVER_CLOSED,
    },
    [COVER_OPENED]: {
        [COVER_OPENED_LINE]: COVER_OPENED,
        [COVER_CLOSED_LINE]: COVER_CLOSED,
    },
};

class DeviceStateMonitor extends EventEmitter {
    constructor() {
        super();
        // A closed cover is the assumption until the firmware says otherwise: refusing to start a
        // laser job because a "door opened" line was missed is worse than the reverse, and the
        // firmware announces the open state before any job can run.
        this.cover = createStateMachine({
            name: 'deviceStateMonitor.cover',
            initial: COVER_CLOSED,
            states: coverTable,
        });

        serialPortManager.on(SERIAL_PORT_DATA, ({received}) => {
            // Only these two lines are about the cover; skipping the rest keeps a line-rate stream
            // from allocating a transition object per G-code reply.
            if (received === COVER_OPENED_LINE || received === COVER_CLOSED_LINE) {
                this.cover.fire(received);
            }
        });
    }

    get isLaserCoverOpened() {
        return this.cover.is(COVER_OPENED);
    }
}

const deviceStateMonitor = new DeviceStateMonitor();

export default deviceStateMonitor;
