// antd's static message/notification/modal helpers build their own React root, so they never see
// ConfigProvider's theme - which is what left the popups light in dark mode.
//
// components/AppTheme parks the context-aware instances from antd's App here, and the wrappers in
// utils/messageI18n.js, utils/notificationI18n.js and the confirm in components/BaseDeviceControl
// prefer them, falling back to the static API only until the app has mounted.
const apis = {message: null, notification: null, modal: null};

export const setAntdApis = (next) => {
    apis.message = next.message;
    apis.notification = next.notification;
    apis.modal = next.modal;
};

export const antdApis = () => apis;
