const ACTION_UPDATE_STATE = 'PERSISTENT_DATA/ACTION_UPDATE_STATE';
const WORK_HEIGHT = {
    P3D: 'WORK_HEIGHT_P3D',
    LASER: 'WORK_HEIGHT_LASER',
    PEN: 'WORK_HEIGHT_PEN'
};
const IS_TOOLTIP_DISPLAYED = "IS_TOOLTIP_DISPLAYED";
const ADVANCE = 'ADVANCE'

const persistents = {
    getFloat: (key) => parseFloat(localStorage.getItem(key)),
    get: (key) => localStorage.getItem(key),
    set: (key, value) => localStorage.setItem(key, value)
};

if (persistents.get(IS_TOOLTIP_DISPLAYED) === null) {
    persistents.set(IS_TOOLTIP_DISPLAYED, true);
}
if (persistents.get(WORK_HEIGHT.P3D) === null) {
    persistents.set(WORK_HEIGHT.P3D, -90);
}
if (persistents.get(WORK_HEIGHT.PEN) === null) {
    persistents.set(WORK_HEIGHT.PEN, -90);
}
if (persistents.get(WORK_HEIGHT.LASER) === null) {
    persistents.set(WORK_HEIGHT.LASER, 0);
}

if (persistents.get(ADVANCE) === null) {
    persistents.set(ADVANCE, 0);
}

const INITIAL_STATE = {
    workHeightP3d: persistents.getFloat(WORK_HEIGHT.P3D),
    workHeightPen: persistents.getFloat(WORK_HEIGHT.PEN),
    workHeightLaser: persistents.getFloat(WORK_HEIGHT.LASER),
    isTooltipDisplayed: persistents.get(IS_TOOLTIP_DISPLAYED),
    advance: persistents.getFloat(ADVANCE)
};

export const actions = {
    _updateState: (state) => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
    },
    setWorkHeightP3d: (value) => (dispatch, getState) => {
        dispatch(actions._updateState({workHeightP3d: value}));
        persistents.set(WORK_HEIGHT.P3D, value);
    },
    setWorkHeightPen: (value) => (dispatch, getState) => {
        dispatch(actions._updateState({workHeightPen: value}));
        persistents.set(WORK_HEIGHT.PEN, value);
    },
    setWorkHeightLaser: (value) => (dispatch, getState) => {
        dispatch(actions._updateState({workHeightLaser: value}));
        persistents.set(WORK_HEIGHT.LASER, value);
    },
    setIsTooltipDisplayed: (value) => (dispatch) => {
        const key = IS_TOOLTIP_DISPLAYED;
        dispatch(actions._updateState({isTooltipDisplayed: value}));
        persistents.set(key, value);
    },

    setAdvance: (value) => (dispatch) => {
        dispatch(actions._updateState({advance: value}));
        persistents.set(ADVANCE, value);
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE:
            return Object.assign({}, state, action.state);
        default:
            return state;
    }
}
