import {
    THEME_SYSTEM,
    THEME_DARK,
    THEME_LIGHT,
    readStoredTheme,
    storeTheme,
    resolveTheme,
    watchSystemTheme,
} from '../utils/theme';

const ACTION_SET_PREFERENCE = 'theme/ACTION_SET_PREFERENCE';
const ACTION_SET_RESOLVED = 'theme/ACTION_SET_RESOLVED';

const preference = readStoredTheme();

const INITIAL_STATE = {
    preference, // 'system' | 'light' | 'dark', as picked in the settings
    resolved: resolveTheme(preference), // 'light' | 'dark', what is actually drawn
};

export const actions = {
    // Keep following the OS, but only while the preference is still 'system'.
    init: () => (dispatch, getState) => {
        watchSystemTheme((resolved) => {
            if (getState().theme.preference === THEME_SYSTEM) {
                dispatch(actions._setResolved(resolved));
            }
        });
    },
    setPreference: (preference) => (dispatch) => {
        storeTheme(preference);
        dispatch({type: ACTION_SET_PREFERENCE, preference});
        dispatch(actions._setResolved(resolveTheme(preference)));
    },
    // The tap bar button flips what is on screen right now, so it always ends as an explicit
    // pick: toggling out of 'system' stops it following the OS until the setting says otherwise.
    toggle: () => (dispatch, getState) => {
        const {resolved} = getState().theme;
        dispatch(actions.setPreference(resolved === THEME_DARK ? THEME_LIGHT : THEME_DARK));
    },
    _setResolved: (resolved) => {
        return {
            type: ACTION_SET_RESOLVED,
            resolved,
        };
    },
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_SET_PREFERENCE:
            return Object.assign({}, state, {preference: action.preference});
        case ACTION_SET_RESOLVED:
            return Object.assign({}, state, {resolved: action.resolved});
        default:
            return state;
    }
}
