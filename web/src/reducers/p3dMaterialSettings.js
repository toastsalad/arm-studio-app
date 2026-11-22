import {P3D_CONFIG_MATERIAL_SETTINGS_FETCH, P3D_CONFIG_MATERIAL_SETTING_UPDATE} from "../constants";
import createSettingsReducer from "./p3dSettingsFactory";

const {actions, reducer} = createSettingsReducer({
    sliceName: 'p3dMaterialSettings',
    fetchEvent: P3D_CONFIG_MATERIAL_SETTINGS_FETCH,
    updateEvent: P3D_CONFIG_MATERIAL_SETTING_UPDATE,
    errorMessage: "material settings is null"
});

export {actions};
export default reducer;
