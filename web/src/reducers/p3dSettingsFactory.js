import _ from 'lodash';
import socketClientManager from "../socket/socketClientManager";

// The material-preset and print-preset stores are the same reducer talking to different socket
// events, so both are built from this factory.
const createSettingsReducer = ({sliceName, fetchEvent, updateEvent, errorMessage}) => {
    const ACTION_UPDATE_STATE = `${sliceName}/ACTION_UPDATE_STATE`;

    const INITIAL_STATE = {
        settings: [],
        selected: null,
    };

    const actions = {
        _updateState: (state) => {
            return {type: ACTION_UPDATE_STATE, state};
        },
        init: () => (dispatch, getState) => {
            socketClientManager.addServerListener("connect", () => {
                dispatch(actions.fetch());
            });
            socketClientManager.addServerListener("disconnect", () => {
                dispatch(actions._updateState({
                    settings: [],
                    selected: null
                }));
            });
            socketClientManager.addServerListener(fetchEvent, (settings) => {
                let {selected} = getState()[sliceName];
                if (!selected) {
                    for (let i = 0; i < settings.length; i++) {
                        if (settings[i].isDefaultSelected) {
                            selected = settings[i];
                            break;
                        }
                    }
                }
                // Official presets first
                settings.sort((a, b) => {
                    if (a.isOfficial && !b.isOfficial) return -1;
                    if (!a.isOfficial && b.isOfficial) return 1;
                    return 0;
                });
                dispatch(actions._updateState({
                    settings,
                    selected
                }));
            });
        },
        fetch: () => {
            socketClientManager.emitToServer(fetchEvent);
            return {type: '@@arm-studio/NOOP'};
        },
        // keyChain example: material_flow.default_value
        update: (keyChain, value) => (dispatch, getState) => {
            const {settings, selected} = getState()[sliceName];
            if (!settings || settings.length === 0 || !selected) {
                console.error(errorMessage);
                return {type: '@@arm-studio/NOOP'};
            }
            _.set(selected, keyChain, value);
            const {filename} = selected;
            socketClientManager.emitToServer(updateEvent, {filename, keyChain, value});
            return {type: '@@arm-studio/NOOP'};
        },
        rename: (newName) => {
            return {type: '@@arm-studio/NOOP'};
        },
        delete: (name) => {
            return {type: '@@arm-studio/NOOP'};
        },
        clone: (name) => {
            return {type: '@@arm-studio/NOOP'};
        },
        select: (name) => (dispatch, getState) => {
            const {settings, selected} = getState()[sliceName];
            let selectedNew = null;
            for (let i = 0; i < settings.length; i++) {
                const item = settings[i];
                if (item.name === name) {
                    selectedNew = item;
                    break;
                }
            }
            if (selected === selectedNew) {
                return {type: '@@arm-studio/NOOP'};
            } else {
                dispatch(actions._updateState({selected: selectedNew}));
            }
        }
    };

    const reducer = (state = INITIAL_STATE, action) => {
        switch (action.type) {
            case ACTION_UPDATE_STATE: {
                return Object.assign({}, state, action.state);
            }
            default:
                return state;
        }
    };

    return {actions, reducer};
};

export default createSettingsReducer;
