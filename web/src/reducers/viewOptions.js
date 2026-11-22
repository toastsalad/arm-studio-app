// What the 2D canvas shows, as opposed to what it holds. A drawing is the model's business; how you
// like to read the canvas is yours, and it should survive a reload.
const ACTION_SET_SHOW_TRAVEL = 'VIEW_OPTIONS/ACTION_SET_SHOW_TRAVEL';
const SHOW_TRAVEL = 'VIEW_OPTIONS_SHOW_TRAVEL';

// Pen-up moves are green and, on a busy drawing, they are most of the lines on screen. They are hidden unless
// asked for -- the eye button in the toolbar draws them -- and the choice is remembered.
const readShowTravel = () => {
    // Guarded because this module is imported by tests that run without a DOM.
    if (typeof localStorage === 'undefined') return false;
    const stored = localStorage.getItem(SHOW_TRAVEL);
    if (stored === null) return false;
    return stored === 'true';
};

const INITIAL_STATE = {
    showTravel: readShowTravel(),
};

export const actions = {
    toggleTravel: () => (dispatch, getState) => {
        const showTravel = !getState().viewOptions.showTravel;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(SHOW_TRAVEL, showTravel ? 'true' : 'false');
        }
        dispatch({type: ACTION_SET_SHOW_TRAVEL, showTravel});
    },
};

export default (state = INITIAL_STATE, action) => {
    switch (action.type) {
        case ACTION_SET_SHOW_TRAVEL:
            return {...state, showTravel: action.showTravel};
        default:
            return state;
    }
};
