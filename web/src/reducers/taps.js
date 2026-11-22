import {TAP_BASIC} from "../constants.js";

const SET_TAP = "taps/SET_TAP";

const ACTION_UPDATE_STATE = 'taps/ACTION_UPDATE_STATE';

const INITIAL_STATE = {
    tap: TAP_BASIC,
    terminalVisible: false
};

export const actions = {
    _updateState: (state) => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
    },
    // Switching tabs resizes all canvases; avoid needless switches
    setTap: (value) => (dispatch, getState) => {
        if (getState().taps.tap !== value) {
            dispatch(actions._setTap(value));
        }
    },
    setTerminalVisible: (value) => (dispatch) => {
        dispatch(actions._updateState({terminalVisible: value}));
    },
    _setTap: (value) => {
        return {
            type: SET_TAP,
            value
        };
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case SET_TAP:
            const {value} = action;
            return Object.assign({}, state, {tap: value});
        case ACTION_UPDATE_STATE:
            return Object.assign({}, state, action.state);
        default:
            return state;
    }
}
