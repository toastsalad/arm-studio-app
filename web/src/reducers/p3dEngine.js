import {P3D_ENGINE_INSTALL, P3D_ENGINE_STATUS} from "../constants";
import socketClientManager from "../socket/socketClientManager";

// CuraEngine is AGPL-3.0 and is not bundled, so 3D printing starts disabled until the user has
// downloaded it. The server owns the install (checksum, unpacking, user data dir); this slice only
// mirrors the state it reports and asks for a download when the user clicks.
const ACTION_UPDATE_STATE = 'p3dEngine/ACTION_UPDATE_STATE';

const INITIAL_STATE = {
    status: null,
};

export const actions = {
    init: () => (dispatch) => {
        socketClientManager.addServerListener(P3D_ENGINE_STATUS, (status) => {
            dispatch(actions._updateState({status}));
        });
        socketClientManager.addServerListener("disconnect", () => {
            dispatch(actions._updateState({status: null}));
        });
    },
    install: () => () => {
        socketClientManager.emitToServer(P3D_ENGINE_INSTALL);
    },
    refresh: () => () => {
        socketClientManager.emitToServer(P3D_ENGINE_STATUS);
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
