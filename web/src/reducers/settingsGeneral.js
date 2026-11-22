import socketClientManager from "../socket/socketClientManager";
import {actions as serialPortActions} from './serialPort';
import {
    SERIAL_PORT_OPEN,
    SERIAL_PORT_DATA,
    SERIAL_PORT_GET_OPENED,
    SERIAL_PORT_CLOSE
} from "../constants.js"

const ACTION_UPDATE_STATE = 'settingsGeneral/ACTION_UPDATE_STATE';

const INITIAL_STATE = {
    firmwareVersion: null,
    hardwareVersion: null,
    path: null,
};

export const actions = {
    init: () => (dispatch, getState) => {
        const callback4open = (path) => {
            if (path) {
                dispatch(serialPortActions.write('M2010\nM2011\na5\n'));
            }
        };
        socketClientManager.addServerListener(SERIAL_PORT_GET_OPENED, callback4open);
        socketClientManager.addServerListener(SERIAL_PORT_OPEN, callback4open);

        socketClientManager.addServerListener(SERIAL_PORT_CLOSE, (path) => {
            dispatch(actions._updateState({
                firmwareVersion: null,
                hardwareVersion: null
            }));
        });
        socketClientManager.addServerListener(SERIAL_PORT_DATA, (data) => {
            const {received} = data;
            if (received) {
                // "Firmware Vxx" / "Hardware Vxx" identify the connected arm.
                if (received.startsWith("Firmware ")) {
                    const firmwareVersion = received.replace("Firmware", "").replace("\r", "").trim();
                    dispatch(actions._updateState({firmwareVersion}));
                } else if (received.startsWith("Hardware ")) {
                    const hardwareVersion = received.replace("Hardware", "").replace("\r", "").trim();
                    dispatch(actions._updateState({hardwareVersion}));
                }
            }
        });
    },
    _updateState: (state) => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
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
