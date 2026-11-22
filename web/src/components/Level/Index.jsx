import React from 'react';
import {connect} from 'react-redux';
import _ from 'lodash';
import styles from './styles.css';
import {Radio, Space, Modal, Button,} from 'antd';
import {actions as serialPortAction, actions as serialPortActions} from "../../reducers/serialPort";
import {withTranslation} from 'react-i18next';
import messageI18n from "../../utils/messageI18n";
import {actions as gcodeSendActions} from "../../reducers/gcodeSend";
import socketClientManager from "../../socket/socketClientManager";
import {NETWORK_LEVELING_STATUS} from "../../constants";
import Throbber from "../Throbber/Index.jsx";

const INIT_Z_ARRAY = [
    undefined,
    undefined,
    undefined,
    undefined
];
const POINT_NAME = ['A', 'B', 'C', 'D'];
const POINT_STYLE = [styles.img_point_a, styles.img_point_b, styles.img_point_c, styles.img_point_d];
const LEVEL_POINTS_KEY = 'DEXARM_LEVEL_POINTS';

const loadPoints = () => {
    try {
        const stored = JSON.parse(localStorage.getItem(LEVEL_POINTS_KEY));
        if (Array.isArray(stored) && stored.length === 4) return stored;
    } catch (e) {
        // ignore a corrupt copy
    }
    return INIT_Z_ARRAY.slice();
};

const savePoints = (points) => {
    localStorage.setItem(LEVEL_POINTS_KEY, JSON.stringify(points));
};

const isNetworkPath = (path) => typeof path === 'string' && /^tcp:\/\//i.test(path);
const ARM_REBOOT_SETTLE_MS = 4000;

class Index extends React.Component {
    state = {
        showModal: false,
        pointIndex: undefined,
        stepLength: 0.1,
        zArray: loadPoints(),
        lastConnectSerialPort: undefined,
        started: false,
        serialPortState: null,
        showLoading: false
    }

    onSetPoint = (event) => {
        const index = event.target.value;
        let gcode = '';
        switch (index) {
            case 0://A
                gcode = 'G0 X0 Y350 Z0';
                break;
            case 1://B
                gcode = 'G0 X0 Y250 Z0';
                break;
            case 2://C
                gcode = 'G0 X50 Y300 Z0';
                break;
            case 3://D
                gcode = 'G0 X-50 Y300 Z0';
                break;
        }
        this.props.serialPortWrite(gcode + '\n');
        this.setState({
            pointIndex: index
        });
    }

    componentDidMount() {
        this._levelListener = socketClientManager.addServerListener(NETWORK_LEVELING_STATUS, (leveling) => {
            if (!this.state.showModal || !leveling || !leveling.points) return;
            if (!this.state.zArray.every((value) => value === undefined)) return;
            const points = [leveling.points.A, leveling.points.B, leveling.points.C, leveling.points.D];
            if (points.every((value) => typeof value === 'number')) {
                this.setState({zArray: points});
                savePoints(points);
            }
        });
    }

    componentWillUnmount() {
        if (this._levelListener) {
            socketClientManager.removeServerListener(NETWORK_LEVELING_STATUS, this._levelListener);
            this._levelListener = null;
        }
    }

    onSetStepLength = (event) => {
        this.setState({
            stepLength: event.target.value
        })
    }

    onClickSave = () => {
        if (this.state.pointIndex === undefined) {
            messageI18n.error('You should choose one point first!');
            return;
        }
        const pointIndex = this.state.pointIndex;
        this.props.addOneShootGcodeResponseListener(
            'M114',
            (x, y, z) => {
                const zArray = _.cloneDeep(this.state.zArray);
                zArray[pointIndex] = z;
                this.setState({zArray}, () => savePoints(zArray));
            });
        messageI18n.success(`Point ${POINT_NAME[pointIndex]} was saved.`);
    }
    onClickStart = () => {
        if (isNetworkPath(this.props.path) && this.props.ready !== true) {
            messageI18n.warning('Wait for the arm to finish booting');
            return;
        }
        const gcode = [
            'M891 X0 Y0',
            'M2007'
        ];
        this.props.serialPortWrite(gcode.join('\n') + '\n');
        this.delayToConnectSerialPort(this, true, true, 'Level Started', Date.now() + ARM_REBOOT_SETTLE_MS);
        this.setState({showLoading: true});
    }

    onClickLevel = () => {
        if (isNetworkPath(this.props.path) && this.props.ready !== true) {
            messageI18n.warning('Wait for the arm to finish booting');
            return;
        }
        for (let index = 0; index < this.state.zArray.length; index++) {
            if (this.state.zArray[index] === undefined) {
                messageI18n.error(`Point ${POINT_NAME[index]} need to be saved.`);
                return;
            }
        }
        const zArray = this.state.zArray;
        savePoints(zArray);
        if (isNetworkPath(this.props.path)) {
            // Keep the four raw points on the bridge; it also stores the slope.
            this.props.serialPortWrite(`!level points ${zArray.join(' ')}\n`);
        }
        const gcode = [
            `M891 X${(zArray[2] - zArray[3]) / 100} Y${(zArray[0] - zArray[1]) / 100}`,
            'M2007'
        ];
        this.props.serialPortWrite(gcode.join('\n') + '\n');
        this.delayToConnectSerialPort(this, false, false, 'Level Done.', Date.now() + ARM_REBOOT_SETTLE_MS);
        this.setState({showLoading: true});
    }
    delayToConnectSerialPort = (that, showModal, started, msg, notBefore = 0) => {
        setTimeout(() => {
            const {lastConnectSerialPort} = that.state;
            const {paths} = that.props;
            const ready = isNetworkPath(lastConnectSerialPort)
                ? Date.now() >= notBefore
                : ((paths) && (paths.length > 0) && (paths.indexOf(lastConnectSerialPort) !== -1));
            if (!ready) {
                this.delayToConnectSerialPort(that, showModal, started, msg, notBefore);
                return;
            }
            this.props.openSerialPort(lastConnectSerialPort);
            this.delayToM1112(that, showModal, started, msg);
        }, 1000);
    }
    delayToM1112 = (that, showModal, started, msg, attempts = 0) => {
        setTimeout(() => {
            const {path, ready} = that.props;
            if (!path) {
                this.delayToConnectSerialPort(that, showModal, started, msg);
                return;
            }
            // The arm reboots after M2007.  On a network path the bridge reports
            // ready=1 only after the firmware (and any leveling restore) is back.
            if (isNetworkPath(path) && ready !== true && attempts < 12) {
                this.delayToM1112(that, showModal, started, msg, attempts + 1);
                return;
            }

            that.props.serialPortWrite('M1112\n');
            messageI18n.success(msg);
            that.setState({
                showModal,
                started,
                showLoading: false
            });
        }, 1000);
    }
    onClickDown = () => {
        this.move(`G0 Z${-this.state.stepLength}`);
    }

    onClickUp = () => {
        this.move(`G0 Z${this.state.stepLength}`);
    }

    move = (cmd) => {
        const gcode = [
            'G91',//relative position
            cmd,
            'G90'//absolute position
        ];
        this.props.startTask(gcode.join("\n") + '\n', false);
    }

    showModal = () => {
        const {path} = this.props;
        if (!path) {
            messageI18n.error('You should connect the device first.');
            return;
        }
        const points = this.props.leveling && this.props.leveling.points;
        const fromBridge = points && ['A', 'B', 'C', 'D'].every(
            (key) => typeof points[key] === 'number')
            ? [points.A, points.B, points.C, points.D]
            : null;
        this.setState({
            showModal: true,
            pointIndex: undefined,
            stepLength: 10,
            zArray: fromBridge || loadPoints(),
            lastConnectSerialPort: path,
            started: false,
            showLoading: false
        });
        if (isNetworkPath(path)) {
            this.props.serialPortWrite('!level status\n');
        }
    };

    render() {
        const {t} = this.props;
        const {showLevel} = this.props;
        const {pointIndex} = this.state;
        return (<div>
                {showLevel && <button
                    onClick={this.showModal}
                    className={styles.btn_action_work}
                >{t('Level')}
                </button>}

                <Modal
                    title={t("Leveling")}
                    open={this.state.showModal}
                    width={1000}
                    footer={null}
                    centered={true}
                    onCancel={() => {
                        this.setState({showModal: false})
                    }}
                >
                    <Space orientation={"horizontal"} align={"start"}>
                        <Space orientation={"vertical"}>
                            <div>
                                {t("Before start bed leveling, put a piece of paper between the module and the build plate. And follow the instructions to level your DexArm.")}
                            </div>

                            <div style={{marginTop: "10px"}}>

                                <b>{t("Step")} 1:</b>
                                {t("Click the button to reset DexArm's XY slope rate. Wait about 4 seconds, the machine will be reconnected.")}

                            </div>
                            <Button size={"small"} onClick={this.onClickStart}>
                                {t('Reset XY Slope Rate')}</Button>
                            <div style={{marginTop: "10px"}}>
                                <b>{t("Step")} 2:</b> {t("Click the first point to start leveling.")}
                            </div>
                            <Radio.Group
                                size={"small"}
                                value={this.state.pointIndex}
                                buttonStyle="solid"
                                disabled={!this.state.started}
                                onChange={this.onSetPoint}>
                                <Radio.Button value={0}>{t("Point")} A</Radio.Button>
                                <Radio.Button value={1}>{t("Point")} B</Radio.Button>
                                <Radio.Button value={2}>{t("Point")} C</Radio.Button>
                                <Radio.Button value={3}>{t("Point")} D</Radio.Button>
                            </Radio.Group>

                            <div style={{marginTop: "10px"}}><b>{t("Step")} 3:</b>
                                {t("Adjust the distance between the module and build plate using the Up and Down button until there is slight resistance on the A4 paper from the nozzle.")}
                            </div>
                            <div style={{opacity: 0.5}}>{t("Step Length")}</div>

                            <Radio.Group size={"small"} value={this.state.stepLength} buttonStyle="solid"
                                         onChange={this.onSetStepLength}>
                                <Radio.Button value={10}>10</Radio.Button>
                                <Radio.Button value={1.0}>1.0</Radio.Button>
                                <Radio.Button value={0.2}>0.2</Radio.Button>
                                <Radio.Button value={0.1}>0.1</Radio.Button>
                            </Radio.Group>
                            <Space orientation={"horizontal"}>
                                <Button size={"small"} style={{width: "61px"}}
                                        onClick={this.onClickDown}>{t("Down")}</Button>
                                <Button size={"small"} style={{width: "61px"}}
                                        onClick={this.onClickUp}>{t("Up")}</Button>
                            </Space>
                            <Button size={"small"} style={{width: "130px"}}
                                    onClick={this.onClickSave}>{t("Save")}</Button>

                            <div style={{marginTop: "10px"}}><b>{t("Step")} 4:</b>
                                {t("Click Level when all the points are leveled.")}
                            </div>
                            <Button size={"small"} style={{width: "130px"}}
                                    onClick={this.onClickLevel}>{t("Level")}</Button>
                        </Space>
                        <Space>
                            <img className={POINT_STYLE[pointIndex ? pointIndex : 0]}/>
                        </Space>
                        <div
                            className={this.state.showLoading ? styles.div_loading_visible : styles.div_loading_hidden}>
                            {/* Levelling takes seconds, so there is no point delaying this one. */}
                            <Throbber visible={this.state.showLoading} delay={0}/>
                        </div>
                    </Space>
                </Modal>
            </div>
        )
    }
}

const mapStateToProps = (state) => {
    const {path, paths, networkArm, leveling} = state.serialPort;
    return {
        path,
        paths,
        ready: networkArm ? networkArm.ready : null,
        leveling,
    };
};
const mapDispatchToProps = (dispatch) => {
    return {
        addOneShootGcodeResponseListener: (gcode, listener) => {
            dispatch(serialPortAction.addOneShootGcodeResponseListener(gcode, listener))
        },
        startTask: (gcode, isAckChange) => dispatch(gcodeSendActions.startTask(gcode, isAckChange)),
        serialPortWrite: (gcode) => {
            dispatch(serialPortActions.write(gcode));
        },
        openSerialPort: (path) => dispatch(serialPortActions.open(path)),
    };
};
export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(Index));
