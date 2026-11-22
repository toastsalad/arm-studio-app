import {notification} from 'antd';
import i18next from 'i18next'
import {antdApis} from './antdStatic';

// The instance antd's App hands out, so the notice follows the app theme. The static API is only
// used before the app has mounted (see components/AppTheme).
const api = () => antdApis().notification || notification;

function preprocess(params) {
    if (params.message) params.message = i18next.t(params.message);
    if (params.description) params.description = i18next.t(params.description);
    return params;
}

export default {
    success: (params) => api().success(preprocess(params)),
    close: (params) => api().destroy(params),
    error: (params) => api().error(preprocess(params)),
    info: (params) => api().info(params),
    warning: (params) => api().warning(params),
    open: (params) => api().open(params),
    warn: (params) => api().warn(params),
    config: (options) => api().config(options),
    destroy: () => api().destroy(),
}
