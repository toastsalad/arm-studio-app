import React from 'react';
import {connect} from 'react-redux';
import {Space} from 'antd';
import messageI18n from "../../../../utils/messageI18n";
import {getTimestampName} from "../../../../utils/index.js";
import TemperatureDisplay from './TemperatureDisplay.jsx'
import SettingVisibility from "./SettingVisibility.jsx";
import MaterialSettings from './MaterialSettings.jsx';
import PrintSettings from './PrintSettings.jsx';
import Upload from '../Upload/Index.jsx';
import Info from '../Info/Index.jsx';
import {saveAs} from '../../../../utils/saveAs';
import {actions as p3dModelActions} from "../../../../reducers/p3dModel";
import {actions as gcodeSendActions} from "../../../../reducers/gcodeSend";
import {isOffloadEnabled} from '../../../../utils/offload';

import Throbber from "../../../../components/Throbber/Index.jsx";
import {withTranslation} from 'react-i18next';
import ActionButton from '../../../../components/ActionButton/Index.jsx';
import EngineSetup from '../EngineSetup/Index.jsx';

class Index extends React.Component {
    actions = {
        generateGcode: () => {
            if (this.props.modelCount === 0) {
                messageI18n.warning('Import a model first');
                return;
            }
            
            this.props.startSlice();
        },
        exportGcode: () => {
            if (this.props.modelCount === 0) {
                messageI18n.warning('Import a model first');
                return;
            }
            if (!this.props.result) {
                messageI18n.warning('Slice the model first');
                return;
            }
            const fileName = getTimestampName('.gcode');
            const {gcodeUrl} = this.props.result;

            fetch(gcodeUrl)
                .then(resp => resp.blob())
                .then(blob => {
                    saveAs(blob, fileName);
                    messageI18n.success('Export G-code success', 1);
                })
                .catch(() => {
                    console.error("down load err");
                    messageI18n.error('Export G-code failed', 1);
                });
        },
        startTask: () => {
            if (!this.props.result) {
                messageI18n.warning('Slice the model first', 1);
                return;
            }
            const {gcodeUrl} = this.props.result;
            fetch(gcodeUrl)
                .then(resp => resp.text())
                .then(gcode => {
                    this.props.startJob(gcode, {mode: 'print', offload: isOffloadEnabled()});
                })
                .catch(() => {
                    console.error("down load error")
                });
        },
        stopTask: () => {
            this.props.stopTask();
        }
    };

    render() {
        const {t} = this.props;
        const actions = this.actions;
        return (
            <div>
                <Space 
                    orientation={"vertical"} 
                    size="small"
                    style={{width: "100%", padding: "8px"}}>
                    <Upload/>
                    <EngineSetup/>
                    <ActionButton
                        onClick={actions.generateGcode}
                        text={this.props.slicing ? t("Slicing") : t("Slice Model")}
                        icon={<Throbber visible={this.props.slicing} inline/>}
                        disabled={this.props.slicing || !this.props.engineReady}
                    />
                    <ActionButton onClick={actions.exportGcode} text={t("Save G-code")}/>
                    <div>
                        <ActionButton 
                            onClick={actions.startTask} 
                            text={t("Start Send G-code")}
                            disabled={!this.props.result}
                            style={{width: "calc(50% - 4px)", marginRight: "8px"}}
                        />
                        <ActionButton 
                            onClick={actions.stopTask} 
                            text={t("Stop Send G-code")}
                            style={{width: "calc(50% - 4px)"}}
                        />
                    </div>
                    <Info/>
                    <TemperatureDisplay />
                    <SettingVisibility/>
                    <MaterialSettings/>
                    <PrintSettings/>
                </Space>
            </div>
        )
    }
}

const mapStateToProps = (state) => {
    const {result, modelCount, slicing} = state.p3dModel;
    return {
        result,
        modelCount,
        slicing,
        engineReady: !!state.p3dEngine.status && state.p3dEngine.status.state === 'ready'
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        startSlice: () => dispatch(p3dModelActions.startSlice()),
        startTask: (gcode, isAckChange) => dispatch(gcodeSendActions.startTask(gcode, isAckChange)),
        startJob: (gcode, opts) => dispatch(gcodeSendActions.startJob(gcode, opts)),
        stopTask: () => dispatch(gcodeSendActions.stopTask()),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(Index));

