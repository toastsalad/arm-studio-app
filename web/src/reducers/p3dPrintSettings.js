import {P3D_CONFIG_PRINT_SETTINGS_FETCH, P3D_CONFIG_PRINT_SETTING_UPDATE} from "../constants";
import createSettingsReducer from "./p3dSettingsFactory";

const {actions, reducer} = createSettingsReducer({
    sliceName: 'p3dPrintSettings',
    fetchEvent: P3D_CONFIG_PRINT_SETTINGS_FETCH,
    updateEvent: P3D_CONFIG_PRINT_SETTING_UPDATE,
    errorMessage: "config is null"
});

export {actions};
export default reducer;
