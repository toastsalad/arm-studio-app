import React from 'react';
import _ from 'lodash';
import styles from './styles.css';
import {Button, Checkbox, Input, Modal, Radio, Select} from 'antd';
import notificationI18n from "../../utils/notificationI18n";
import {connect} from 'react-redux';
import {actions as serialPortActions} from '../../reducers/serialPort';
import {getUuid} from '../../utils/index.js';
import {actions as tapsActions} from "../../reducers/taps";
import {actions as gcodeSendActions} from '../../reducers/gcodeSend'
import socketClientManager from '../../socket/socketClientManager';
import {GCODE_SENDER_STATUS_CHANGE} from '../../constants';
import Throbber from "../../components/Throbber/Index.jsx";
import {withTranslation} from 'react-i18next';
import {isOffloadEnabled, setOffloadEnabled} from '../../utils/offload';

const notificationKeyConnected = getUuid();
const notificationKeyDisconnected = getUuid();

// 'up' is the arm link being open, 'waiting' is no arm attached, 'unknown' is firmware that
// does not report it.
const armStateText = (arm) => {
    if (arm === 'up') return 'DexArm connected';
    if (arm === 'waiting') return 'no DexArm';
    return 'arm state unknown';
};

class Index extends React.Component {
    state = {
        serialPortModalVisible: false,
        selectedPath: undefined, // undefined shows the Select placeholder
        connectionMode: 'usb', // 'usb' | 'network'
        manualAddress: '',
        paused: false,
        offload: isOffloadEnabled(),
    };

    UNSAFE_componentWillReceiveProps(nextProps) {
        if (this.props.paths.length > 0) {
            const countDif = nextProps.paths.length - this.props.paths.length;
            if (countDif === 1) {
                const dif = _.difference(nextProps.paths, this.props.paths);
                notificationI18n.success({
                    key: notificationKeyConnected,
                    message: 'Cable Inserted',
                    description: dif[0],
                });
                notificationI18n.close(notificationKeyDisconnected);
            } else if (countDif === -1) {
                const dif = _.difference(this.props.paths, nextProps.paths);
                notificationI18n.error({
                    key: notificationKeyDisconnected,
                    message: 'Cable Cable Pulled Out',
                    description: dif[0],
                    duration: 1 // Delay so the message clears after reconnect
                });
                notificationI18n.close(notificationKeyConnected)
            }
        }
        if (this.props.paths.includes(this.state.selectedPath) && !nextProps.paths.includes(this.state.selectedPath)) {
            this.setState({selectedPath: undefined});
        }
    }

    componentDidMount() {
        // Track the sender state so the rail pause button can toggle pause/resume.
        this._statusListener = socketClientManager.addServerListener(GCODE_SENDER_STATUS_CHANGE, (data) => {
            this.setState({paused: data.curStatus === 'paused'});
        });
    }

    componentWillUnmount() {
        if (this._statusListener) {
            socketClientManager.removeServerListener(GCODE_SENDER_STATUS_CHANGE, this._statusListener);
            this._statusListener = null;
        }
    }

    actions = {
        openSerialPortModal: () => {
            if (!this.state.selectedPath) {
                this.setState({
                    selectedPath: this.props.path,
                });
            }
            this.setState({
                serialPortModalVisible: true,
            });
            // Scan the LAN for bridges as soon as the dialog opens
            this.props.discoverNetwork();
        },
        closeSerialPortModal: () => {
            this.setState({
                serialPortModalVisible: false,
            });
        },
        openSerialPort: () => {
            this.props.openSerialPort(this.state.selectedPath)
        },
        closeSerialPort: () => {
            this.props.closeSerialPort()
        },
        selectPath: (selectedPath) => {
            this.setState({selectedPath})
        },
        setConnectionMode: (connectionMode) => {
            this.setState({connectionMode, selectedPath: undefined})
            if (connectionMode === 'network') {
                this.props.discoverNetwork()
            }
        },
        setManualAddress: (manualAddress) => {
            this.setState({manualAddress})
        },
        discoverNetwork: () => {
            this.props.discoverNetwork()
        },
        useManualAddress: () => {
            const raw = (this.state.manualAddress || '').trim()
            if (!raw) return
            let addr = raw
            if (!/^tcp:\/\//i.test(addr)) {
                const match = /^([^:/]+)(?::(\d+))?$/.exec(addr)
                if (!match) return
                addr = `tcp://${match[1]}:${match[2] || 23}`
            }
            this.setState({selectedPath: addr})
        },
        emergencyStop: () => {
            // The server routes this to !job abort for an offloaded job and to a
            // raw M410 otherwise.
            this.props.abortTask();
        },
        setOffload: (offload) => {
            setOffloadEnabled(offload);
            this.setState({offload});
        },
        pauseResume: () => {
            if (this.state.paused) {
                this.props.resumeTask();
            } else {
                this.props.pauseTask();
            }
        },
        changeTerminalVisibility: (checked) => {
            this.props.setTerminalVisible(checked);
        },
    };

    render() {
        const actions = this.actions;
        const state = this.state;
        const {paths, path, terminalVisible} = this.props;
        const {selectedPath} = state;
        const {t} = this.props;

        let connectDisabled = false;
        let disconnectDisabled = false;
        if (!selectedPath) {
            connectDisabled = true;
            disconnectDisabled = true;
        } else {
            if (selectedPath === path) {
                connectDisabled = true;
                disconnectDisabled = false;
            } else {
                connectDisabled = false;
                disconnectDisabled = true;
            }
        }

        const options = [];
        for (let i = 0; i < paths.length; i++) {
            options.push({label: paths[i], value: paths[i]})
        }

        const networkOptions = [];
        const networkDevices = this.props.networkDevices || [];
        for (let i = 0; i < networkDevices.length; i++) {
            const dev = networkDevices[i];
            networkOptions.push({
                label: `${dev.path} - ${t(armStateText(dev.arm))}`,
                value: dev.path,
            })
        }

        // Being connected over the network says nothing about the arm; a USB
        // port is the arm itself, so it only needs stating for tcp:// paths.
        const {networkArm} = this.props;
        const isNetworkPath = !!(path && String(path).startsWith('tcp://'));
        let armDes = '';
        if (path) {
            if (!isNetworkPath) armDes = 'DexArm connected';
            else if (networkArm) {
                armDes = armStateText(networkArm.arm);
                if (networkArm.ready === false) armDes = 'arm booting / restoring leveling';
            } else armDes = 'checking...';
        }

        // Only offer a link when the bridge reports a status page port; older firmware does not.
        const statusPageUrl = (() => {
            const forPath = (p) => {
                if (!p || !String(p).startsWith('tcp://')) return null;
                const host = String(p).slice('tcp://'.length).split(':')[0];
                const match = networkDevices.find((d) => d.path === p);
                const web = (match && match.web)
                    || (networkArm && networkArm.path === p ? networkArm.web : null);
                if (!web) return null;
                return `http://${host}${Number(web) === 80 ? '' : ':' + web}/`;
            };
            return forPath(selectedPath) || forPath(path);
        })();
        const jobPageUrl = (() => {
            const forPath = (p) => {
                if (!p || !String(p).startsWith('tcp://')) return null;
                const host = String(p).slice('tcp://'.length).split(':')[0];
                const match = networkDevices.find((d) => d.path === p);
                const jobs = (match && match.jobs)
                    || (networkArm && networkArm.path === p ? networkArm.jobs : null);
                if (!jobs) return null;
                return `http://${host}:${jobs}/`;
            };
            return forPath(selectedPath) || forPath(path);
        })();
        const selectedInfo = networkArm && networkArm.path === (selectedPath || path)
            ? networkArm
            : networkDevices.find((d) => d.path === (selectedPath || path));
        const offloadAvailable = !!(selectedInfo && selectedInfo.jobs);
        const job = this.props.job;
        const connectTitle = path
            ? (isNetworkPath && armDes !== 'DexArm connected'
                ? t('Connected (no DexArm)')
                : t('Connected'))
            : t('Connect Marlin Arm');
        return (
            <div className={styles.rail_controls}>
                {path &&
                <React.Fragment>
                    <button
                        className={`${styles.btn_rail} ${styles.ic_estop}`}
                        title={t("Emergency Stop")}
                        onClick={actions.emergencyStop}/>
                    <button
                        className={`${styles.btn_rail} ${state.paused ? styles.ic_resume : styles.ic_pause}`}
                        title={state.paused ? t("Resume") : t("Pause")}
                        onClick={actions.pauseResume}/>
                    <button
                        className={`${styles.btn_rail} ${terminalVisible ? styles.ic_terminal_on : styles.ic_terminal_off} ${terminalVisible ? styles.btn_rail_active : ''}`}
                        title={t("Terminal")}
                        onClick={() => actions.changeTerminalVisibility(!terminalVisible)}/>
                </React.Fragment>}
                <button
                    className={`${styles.btn_rail} ${path ? styles.ic_link_on : styles.ic_link_off} ${path ? styles.btn_rail_active : ''}`}
                    title={connectTitle}
                    onClick={actions.openSerialPortModal}/>
                <Modal
                    title={t("Connect DexArm")}
                    open={state.serialPortModalVisible}
                    onCancel={actions.closeSerialPortModal}
                    width={430}
                    footer={[
                        <Button
                            key="connect"
                            type="primary"
                            disabled={connectDisabled}
                            onClick={actions.openSerialPort}>
                            {t("Connect")}
                        </Button>,
                        <Button
                            key="disconnect"
                            disabled={disconnectDisabled}
                            onClick={actions.closeSerialPort}>
                            {t('Disconnect')}
                        </Button>,
                    ]}
                >
                    <div className={styles.status_row}>
                        <span className={`${styles.status_dot} ${path ? styles.status_dot_on : ''}`}/>
                        <span>{path ? t('Connected') : t('Disconnected')}</span>
                        {statusPageUrl &&
                        <a className={styles.status_link}
                           href={statusPageUrl}
                           target="_blank"
                           rel="noopener noreferrer">
                            {t('Device status')}
                        </a>}
                    </div>
                    {path && <div className={styles.hint}>{`${t('DexArm')}: ${t(armDes)}`}</div>}

                    <div className={styles.field}>
                        <div className={styles.field_label}>{t('Connection')}</div>
                        <Radio.Group
                            value={state.connectionMode}
                            onChange={(e) => actions.setConnectionMode(e.target.value)}
                            optionType="button"
                            buttonStyle="solid">
                            <Radio.Button value="usb">{t('USB')}</Radio.Button>
                            <Radio.Button value="network">{t('Network')}</Radio.Button>
                        </Radio.Group>
                    </div>

                    {state.connectionMode === 'usb' ? (
                        <div className={styles.field}>
                            <div className={styles.field_label}>{t('Port')}</div>
                            <Select
                                style={{width: '100%'}}
                                value={selectedPath}
                                onChange={actions.selectPath}
                                placeholder={t("Choose a port")}
                                options={options}/>
                        </div>
                    ) : (
                        <React.Fragment>
                            <div className={styles.field}>
                                <div className={styles.field_label}>{t('Device')}</div>
                                <div className={styles.row}>
                                    <Select
                                        className={styles.row_grow}
                                        style={{width: '100%'}}
                                        value={(selectedPath && String(selectedPath).startsWith('tcp://')) ? selectedPath : undefined}
                                        onChange={actions.selectPath}
                                        placeholder={t("Choose a device")}
                                        notFoundContent={this.props.networkScanning ? <Throbber visible inline/> : t("No devices found")}
                                        options={networkOptions}/>
                                    <Button
                                        icon={<Throbber visible={this.props.networkScanning} inline/>}
                                        onClick={actions.discoverNetwork}>
                                        {t('Rescan')}
                                    </Button>
                                </div>
                            </div>
                            {offloadAvailable &&
                            <div className={styles.field}>
                                <div className={styles.field_label}>{t('Job execution')}</div>
                                <Checkbox
                                    checked={state.offload}
                                    onChange={(e) => actions.setOffload(e.target.checked)}>
                                    {t('Run jobs on the device (the desktop can be switched off)')}
                                </Checkbox>
                            </div>}
                            {jobPageUrl &&
                            <div className={styles.field}>
                                <a className={styles.status_link} href={jobPageUrl} target="_blank"
                                   rel="noopener noreferrer">{t('Job page and Z offset')}</a>
                            </div>}
                            {job && job.id &&
                            <div className={styles.hint}>
                                {`${t('On device')}: ${job.state}` +
                                 (job.total ? ` ${Math.round(100 * job.sent / job.total)}%` : '')}
                            </div>}
                            <div className={styles.field}>
                                <div className={styles.field_label}>{t('Manual address')}</div>
                                <div className={styles.row}>
                                    <Input
                                        className={styles.row_grow}
                                        value={state.manualAddress}
                                        onChange={(e) => actions.setManualAddress(e.target.value)}
                                        onPressEnter={actions.useManualAddress}
                                        placeholder={'192.168.18.65:23'}/>
                                    <Button onClick={actions.useManualAddress}>{t("Use")}</Button>
                                </div>
                            </div>
                        </React.Fragment>
                    )}
                </Modal>
            </div>
        )
    }
}

const mapStateToProps = (state) => {
    const {paths, path, networkDevices, networkScanning, networkArm} = state.serialPort;
    const {terminalVisible} = state.taps;
    return {
        paths,
        path,
        networkDevices,
        networkScanning,
        networkArm,
        terminalVisible,
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        openSerialPort: (path) => dispatch(serialPortActions.open(path)),
        closeSerialPort: () => dispatch(serialPortActions.close()),
        serialPortWrite: (gcode) => dispatch(serialPortActions.write(gcode)),
        setTerminalVisible: (value) => dispatch(tapsActions.setTerminalVisible(value)),
        abortTask: () => dispatch(gcodeSendActions.abortTask()),
        pauseTask: () => dispatch(gcodeSendActions.pauseTask()),
        resumeTask: () => dispatch(gcodeSendActions.resumeTask()),
        discoverNetwork: () => dispatch(serialPortActions.discoverNetwork())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(Index));
