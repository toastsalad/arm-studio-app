import {TAP_LASER, TAP_P3D, TAB_WRITE_AND_DRAW} from "../constants.js";

import {actions as laserActions} from "./laser";
import {actions as p3dModelActions} from "./p3dModel";
import {actions as writeAndDrawActions} from "./writeAndDraw";

export const actions = {
    init: () => (dispatch, getState) => {
        const onKeyDown = (event) => {
            if (event.key !== 'Backspace' && event.key !== 'Delete') {
                return;
            }
            // Never delete the model while typing in a field (inputs, textareas,
            // selects, contenteditable).
            const target = event.target;
            const tag = target && target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
                (target && target.isContentEditable)) {
                return;
            }
            event.preventDefault();
            switch (getState().taps.tap) {
                case TAP_P3D:
                    dispatch(p3dModelActions.removeSelected());
                    break;
                case TAP_LASER:
                    dispatch(laserActions.removeSelected());
                    break;
                case TAB_WRITE_AND_DRAW:
                    dispatch(writeAndDrawActions.removeSelected());
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return {type: '@@arm-studio/NOOP'};
    }
};
