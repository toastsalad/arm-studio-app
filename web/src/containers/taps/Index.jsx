import React from 'react';
import Tooltip from '../Tooltip/Index.jsx';
import {connect} from 'react-redux';
import styles from './styles.css';
import Connection from '../connection/Index.jsx';
import Laser from '../laser/Index.jsx';
import P3D from '../p3d/Index.jsx';
import WriteAndDraw from '../writeAndDraw/Index.jsx'
import Settings from '../settings/Index.jsx';
import Basic from '../basic/Index.jsx'
import Terminal from './terminal/Index.jsx'

import {TAP_BASIC, TAP_LASER, TAP_P3D, TAB_WRITE_AND_DRAW, TAP_SETTINGS} from "../../constants.js";

import {actions as hotKeysActions} from "../../reducers/hotKeys";
import {actions as serialPortActions} from "../../reducers/serialPort";
import {actions as socketActions} from "../../reducers/socket";
import {actions as gcodeSendActions} from "../../reducers/gcodeSend";
import {actions as jobTrackerActions} from "../../reducers/jobTracker";
import {actions as plotProgressActions} from "../../reducers/plotProgress";
import {actions as tapsActions} from "../../reducers/taps"
import {actions as themeActions} from "../../reducers/theme";
import {THEME_DARK} from "../../utils/theme";

import {actions as p3dPrintSettingsActions} from "../../reducers/p3dPrintSettings";
import {actions as p3dMaterialSettingsActions} from "../../reducers/p3dMaterialSettings";
import {actions as p3dEngineActions} from "../../reducers/p3dEngine";
import {actions as settingsGeneralActions} from "../../reducers/settingsGeneral";
import {actions as fontsActions} from "../../reducers/fonts";
import notificationI18n from "../../utils/notificationI18n";
import {withTranslation} from 'react-i18next';

import {getUuid} from '../../utils/index.js';

const notificationKey = getUuid();
const tooltipId = getUuid();

class Index extends React.Component {
    constructor(props) {
        super(props);
        this.props.init();

        this.refBasic = React.createRef();
        this.refLaser = React.createRef();
        this.refP3D = React.createRef();
        this.refWriteAndDraw = React.createRef();
        this.refSettings = React.createRef();
    }

    actions = {
        setTap: (value) => {
            this.props.setTap(value);
        },
        toggleTheme: () => {
            this.props.toggleTheme();
        },
    };

    componentDidMount() {
        this.displayTap(this.props.tap);

        // disable select text on document
        document.onselectstart = () => {
            return false;
        };
        setInterval(() => {
            if (this.props.socketStatus === "disconnect") {
                notificationI18n.error({
                    key: notificationKey,
                    message: 'Internal error occurred',
                    description: 'Please restart the app',
                    duration: 0
                });
            } else if (this.props.socketStatus === "connect") {
                notificationI18n.close(notificationKey);
            }
        }, 3000)
    }

    UNSAFE_componentWillReceiveProps(nextProps) {
        if (this.props.tap !== nextProps.tap) {
            this.displayTap(nextProps.tap)
        }
    }

    displayTap = (tap) => {
        this.refBasic.current.style.display = 'none';
        this.refLaser.current.style.display = 'none';
        this.refP3D.current.style.display = 'none';
        this.refWriteAndDraw.current.style.display = 'none';
        this.refSettings.current.style.display = 'none';
        switch (tap) {
            case TAP_BASIC:
                this.refBasic.current.style.display = 'block';
                break;
            case TAP_LASER:
                this.refLaser.current.style.display = 'block';
                break;
            case TAP_P3D:
                this.refP3D.current.style.display = 'block';
                break;
            case TAB_WRITE_AND_DRAW:
                this.refWriteAndDraw.current.style.display = 'block';
                break;
            case TAP_SETTINGS:
                this.refSettings.current.style.display = 'block';
                break;
        }
    };

    render() {
        const actions = this.actions;
        const {tap} = this.props;
        const {t} = this.props;
        const {resolved} = this.props;
        return (
            <div>
                <div className={styles.div_tap_bar}>
                    <Tooltip
                        id={tooltipId}
                        place="right"/>
                    <button
                        data-tooltip-id={tooltipId}
                        data-tooltip-content={t("Basic")}
                        onClick={() => actions.setTap(TAP_BASIC)}
                        className={tap === TAP_BASIC ? styles.btn_basic_selected : styles.btn_basic}
                    />
                    <button
                        data-tooltip-id={tooltipId}
                        data-tooltip-content={t("Write & Draw")}
                        onClick={() => actions.setTap(TAB_WRITE_AND_DRAW)}
                        className={tap === TAB_WRITE_AND_DRAW ? styles.btn_write_and_draw_selected : styles.btn_write_and_draw}
                    />
                    <button
                        data-tooltip-id={tooltipId}
                        data-tooltip-content={t("Laser")}
                        onClick={() => actions.setTap(TAP_LASER)}
                        className={tap === TAP_LASER ? styles.btn_laser_selected : styles.btn_laser}
                    />
                    <button
                        data-tooltip-id={tooltipId}
                        data-tooltip-content={t("3D Print")}
                        onClick={() => actions.setTap(TAP_P3D)}
                        className={tap === TAP_P3D ? styles.btn_3d_selected : styles.btn_3d}
                    />
                    <div className={styles.div_bottom_controls}>
                        <Connection/>
                        <button
                            data-tooltip-id={tooltipId}
                            data-tooltip-content={resolved === THEME_DARK ? t("Light Mode") : t("Dark Mode")}
                            onClick={actions.toggleTheme}
                            className={resolved === THEME_DARK ? styles.btn_theme_light : styles.btn_theme_dark}
                        />
                        <button
                            data-tooltip-id={tooltipId}
                            data-tooltip-content={t("Settings")}
                            onClick={() => actions.setTap(TAP_SETTINGS)}
                            className={tap === TAP_SETTINGS ? styles.btn_settings_selected : styles.btn_settings}
                        />
                    </div>
                </div>
                <div className={styles.div_workspace}>
                    <div ref={this.refBasic}>
                        <Basic/>
                    </div>
                    <div ref={this.refLaser}>
                        <Laser/>
                    </div>
                    <div ref={this.refP3D}>
                        <P3D/>
                    </div>
                    <div ref={this.refWriteAndDraw}>
                        <WriteAndDraw/>
                    </div>
                    <div ref={this.refSettings}>
                        <Settings/>
                    </div>
                </div>
                <Terminal/>
            </div>
        )
    }
}

const mapStateToProps = (state) => {
    const {tap} = state.taps;
    const {status: socketStatus} = state.socket;
    const {resolved} = state.theme;
    return {
        tap,
        socketStatus,
        resolved
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setTap: (value) => dispatch(tapsActions.setTap(value)),
        toggleTheme: () => dispatch(themeActions.toggle()),
        init: () => {
            dispatch(socketActions.init());
            dispatch(gcodeSendActions.init());
            dispatch(jobTrackerActions.init());
            dispatch(plotProgressActions.init());
            dispatch(hotKeysActions.init());
            dispatch(serialPortActions.init());
            dispatch(settingsGeneralActions.init());
            dispatch(p3dMaterialSettingsActions.init());
            dispatch(p3dPrintSettingsActions.init());
            dispatch(p3dEngineActions.init());
            dispatch(fontsActions.init());
        }
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(Index));
