import React from 'react';
import {connect} from 'react-redux';
import {saveAs} from '../../../../utils/saveAs';
import styles from './styles.css';
import {Space} from 'antd';
import messageI18n from "../../../../utils/messageI18n";
import {getTimestampName} from "../../../../utils/index.js";
import Transformation from './Transformation.jsx';
import ConfigGreyscale from './ConfigGreyscale.jsx';
import ConfigBW from './ConfigBW.jsx';
import ConfigSvg from './ConfigSvg.jsx';
import ConfigText from './ConfigText.jsx';
import WorkingParameters from './WorkingParameters.jsx';
import Line from '../../../../components/Line/Index.jsx'
import {actions as gcodeSendActions} from "../../../../reducers/gcodeSend";
import {isOffloadEnabled} from '../../../../utils/offload';
import {describePlotTime} from '../../../../utils/estimatePlotTime.js';

import {actions as laserActions} from "../../../../reducers/laser";
import ActionButton from "../../../../components/ActionButton/Index.jsx";
import PlayButton from "../../../../components/PlayButton/Index.jsx";
import {withTranslation} from 'react-i18next';

const getAccept = (fileType) => {
    let accept = '';
    switch (fileType) {
        case "bw":
        case "greyscale":
            accept = '.bmp, .gif, .jpeg, .jpg, .png';
            break;
        case "svg":
        case "text":
            accept = '.svg';
            break;
    }
    return accept;
};

class Index extends React.Component {
    fileInput = React.createRef();
    state = {
        fileType: '', // bw, greyscale, svg, text
        accept: '',
    };

    actions = {
        onChangeFile: (event) => {
            //bw, greyscale, svg
            const file = event.target.files[0];
            const fileType = this.state.fileType;
            this.props.addModel(fileType, file);
        },
        onClickToUpload: (fileType) => {
            if (fileType === "text") {
                this.props.addModel(fileType);
            } else {
                this.setState({
                    fileType,
                    accept: getAccept(fileType)
                }, () => {
                    this.fileInput.current.value = null;
                    this.fileInput.current.click();
                });
            }
        },
        generateGcode: () => {
            if (this.props.modelCount === 0) {
                messageI18n.warning('Load model first');
                return;
            }
            if (!this.props.isAllPreviewed) {
                messageI18n.warning('Previewing');
                return;
            }
            const estimate = this.props.generateGcode();
            messageI18n.success(describePlotTime(estimate), 1);
        },
        exportGcode: () => {
            if (this.props.modelCount === 0) {
                messageI18n.warning('Load model first');
                return;
            }
            if (!this.props.isAllPreviewed) {
                messageI18n.warning('Previewing');
                return;
            }
            if (!this.props.gcode) {
                messageI18n.warning('Generate G-code first');
                return;
            }
            const filename = getTimestampName('.gcode');
            const gcode = this.props.gcode;
            const blob = new Blob([gcode], {type: 'text/plain;charset=utf-8'});
            saveAs(blob, filename);
            messageI18n.success('Export G-code success');
        },
        startTask: () => {
            if (!this.props.gcode) {
                messageI18n.warning('Generate G-code first');
                return;
            }
            this.props.startJob(this.props.gcode, {isLaser: true, mode: 'laser', offload: isOffloadEnabled()});
        },
        pauseTask: () => {
            this.props.pauseTask();
        },
        resumeTask: () => {
            this.props.resumeTask();
        }
    };

    render() {
        const {t} = this.props;
        const {accept} = this.state;
        const {gcode} = this.props;
        const actions = this.actions;
        return (
            <div style={{
                width: "100%",
                height: "100%"
            }}>
                <Space orientation={"vertical"} size="small"
                       style={{width: "100%", padding: "8px"}}>
                    {/* As on the pen tab: one control for sending the job, with stopping left
                        to the Cancel button on the Control panel, and the laser's own pause and
                        resume below. */}
                    <div style={{display: "flex", gap: "8px"}}>
                        <div style={{flex: 1, minWidth: 0}}>
                            <ActionButton onClick={actions.generateGcode} text={t("Generate G-code")}/>
                        </div>
                        {gcode &&
                        <PlayButton title={t("Start Send G-code")} onClick={actions.startTask}/>}
                    </div>
                    <ActionButton onClick={actions.exportGcode} text={t("Export G-code")}/>
                    <div style={{width: "100%"}}>
                        <ActionButton onClick={actions.pauseTask} text={t("Pause Send G-code")}
                                      style={{width: "calc(50% - 4px)", marginRight: "8px"}}/>
                        <ActionButton onClick={actions.resumeTask} text={t("Resume Send")}
                                      style={{width: "calc(50% - 4px)"}}/>
                    </div>
                </Space>
                <Line/>
                <input
                    ref={this.fileInput}
                    type="file"
                    accept={accept}
                    style={{display: 'none'}}
                    multiple={false}
                    onChange={actions.onChangeFile}
                />
                <Space orientation={"horizontal"} style={{width: "100%", paddingLeft: "10px", paddingTop: "10px"}}
                       size={16}>
                    <button
                        className={`app-artwork ${styles.btn_bw}`}
                        onClick={() => actions.onClickToUpload('bw')}
                    >
                        <h6 className={styles.h_file_type}>{t('B&W')}</h6>
                    </button>
                    <button
                        className={`app-artwork ${styles.btn_greyscale}`}
                        onClick={() => actions.onClickToUpload('greyscale')}
                    >
                        <h6 className={styles.h_file_type}>{t('Greyscale')}</h6>
                    </button>
                    <button
                        className={`app-artwork ${styles.btn_svg}`}
                        onClick={() => actions.onClickToUpload('svg')}
                    >
                        <h6 className={styles.h_file_type}>{t('SVG')}</h6>
                    </button>
                    <button
                        className={`app-artwork ${styles.btn_text}`}
                        onClick={() => actions.onClickToUpload('text')}
                    >
                        <h6 className={styles.h_file_type}>{t('Text')}</h6>
                    </button>
                </Space>
                <ConfigGreyscale/>
                <ConfigBW/>
                <ConfigSvg/>
                <ConfigText/>
                <Transformation/>
                <WorkingParameters/>
            </div>
        )
    }
}

const mapStateToProps = (state) => {
    const {gcode, modelCount, isAllPreviewed} = state.laser;
    return {
        gcode,
        isAllPreviewed,
        modelCount,
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        startTask: (gcode, isAckChange, isLaser) => dispatch(gcodeSendActions.startTask(gcode, isAckChange, isLaser)),
        startJob: (gcode, opts) => dispatch(gcodeSendActions.startJob(gcode, opts)),
        pauseTask: () => dispatch(gcodeSendActions.pauseTask()),
        resumeTask: () => dispatch(gcodeSendActions.resumeTask()),
        addModel: (fileType, file) => dispatch(laserActions.addModel(fileType, file)),
        generateGcode: () => dispatch(laserActions.generateGcode()),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(Index));
