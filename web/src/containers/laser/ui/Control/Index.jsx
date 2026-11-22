import React from 'react';
import {connect} from 'react-redux';
import {Switch, Slider} from 'antd';
import DeviceControl from "../../../_deviceControl/Index.jsx"
import Line from "../../../../components/Line/Index.jsx";
import {actions as gcodeSendActions} from "../../../../reducers/gcodeSend";
import {getGcode4runBoundary} from "../../../../reducers/laser";
import {withTranslation} from 'react-i18next';
import {FRONT_END} from "../../../../utils/workAreaUtils";

const INIT_LASER_POWER = 1;

// No way to query the laser head state (could be added in firmware)
class Index extends React.Component {
    state = {
        isLaserOn: false,
        laserPower: INIT_LASER_POWER
    };
    actions = {
        toggleLaser: (checked) => {
            this.setState({isLaserOn: checked, laserPower: INIT_LASER_POWER}, () => {
                this.actions._sendGcode();
            });
        },
        changeLaserPower: (value) => {
            this.setState({laserPower: value})
        },
        afterChangeLaserPower: (value) => {
            this.setState({laserPower: value}, () => {
                this.actions._sendGcode();
            });
        },
        _sendGcode: () => {
            const {isLaserOn, laserPower} = this.state;
            let gcode = "";
            if (isLaserOn) {
                gcode = `M3 S${Math.round(laserPower * 2.55)}`
            } else {
                gcode = "M5"
            }
            this.props.startTask(gcode, false, false);
        },
        // Traces the edge of the job so it can be checked against the material before it is cut.
        runBoundary: () => {
            this.props.startTask(getGcode4runBoundary(), false);
        }
    };

    render() {
        const {t} = this.props;
        const actions = this.actions;
        const state = this.state;
        return (
            <div>
                <DeviceControl
                    showLevel={true}
                    showRunBoundary={true}
                    runBoundary={actions.runBoundary}
                    frontEnd={FRONT_END.LASER}
                    gcode={this.props.gcode}/>
                <Line/>
                <div style={{padding: "5px"}}>
                    <span>{t('Laser')}</span>
                    <Switch style={{position: "absolute", right: "5px"}} checked={state.isLaserOn}
                            onChange={actions.toggleLaser}/>
                    <Slider
                        style={{width: "95%"}}
                        min={0}
                        max={100}
                        step={1}
                        onChange={actions.changeLaserPower}
                        onChangeComplete={actions.afterChangeLaserPower}
                        defaultValue={0}
                        value={state.laserPower}
                        disabled={!state.isLaserOn}
                    />
                </div>
            </div>
        )
    }
}

const mapStateToProps = (state) => ({
    gcode: state.laser.gcode
});

const mapDispatchToProps = (dispatch) => {
    return {
        startTask: (gcode, isAckChange, isLaser) => dispatch(gcodeSendActions.startTask(gcode, isAckChange, isLaser)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(Index));

