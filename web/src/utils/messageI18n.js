import {message} from 'antd';
import i18next from 'i18next'
import {antdApis} from './antdStatic';

// The instance antd's App hands out, so the toast follows the app theme. The static API is only
// used before the app has mounted (see components/AppTheme).
const api = () => antdApis().message || message;

export default  {
    info: (content, duration, onClose) => api().info(i18next.t(content), duration, onClose),
    success: (content, duration, onClose) => api().success(i18next.t(content), duration, onClose),
    error: (content, duration, onClose) => api().error(i18next.t(content), duration, onClose),
    warn: (content, duration, onClose) => api().warn(i18next.t(content), duration, onClose),
    warning: (content, duration, onClose) => api().warning(i18next.t(content), duration, onClose),
    loading: (content, duration, onClose) => api().loading(i18next.t(content), duration, onClose),
    open: (args) => api().open(args),
    config: (options) => api().config(options),
    destroy: () => api().destroy()
}
