import React from 'react';
import {connect} from 'react-redux';
import {saveAs} from '../../../../utils/saveAs';
import styles from './styles.css';
import {Space, Listy} from 'antd';
import messageI18n from "../../../../utils/messageI18n";
import {getTimestampName} from "../../../../utils/index.js";
import Transformation from './Transformation.jsx';
import ConfigSvg from './ConfigSvg.jsx';
import ConfigText from './ConfigText.jsx';
import ConfigTrace from './ConfigTrace.jsx';
import ConfigImage from './ConfigImage.jsx';
import WorkingParameters from './WorkingParameters.jsx';
import Line from '../../../../components/Line/Index.jsx'
import {actions as gcodeSendActions} from "../../../../reducers/gcodeSend";
import {isOffloadEnabled} from '../../../../utils/offload';
import {describePlotTime} from '../../../../utils/estimatePlotTime.js';

import {actions as writeAndDrawActions} from "../../../../reducers/writeAndDraw";
import {getBuildInSvgArray, base64ToBlob} from "../../buildInSvg";
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
        case "trace":
            // The traced raster is decoded by Jimp on the server, then traced (see rasterToPng.js).
            accept = '.bmp, .gif, .jpeg, .jpg, .png';
            break;
        case "image":
            // Shaded by its own tone, so the picture is passed to the engine as a tone (plotterHelperBridge.js).
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
    buildInSvgList = React.createRef();
    state = {
        fileType: '', // bw, greyscale, svg, text, trace, image
        accept: '',
    };

    actions = {
        onChooseBuildInSvg: async (event) => {
            this.buildInSvgList.current.style.display = "none";
            const filename = "select.svg";
            const blob = base64ToBlob(event.target.src.toString());
            const file = new File([blob], filename);
            this.props.addModel('svg', file);
        },
        onChangeFile: async (event) => {
            //bw, greyscale, svg
            const file = event.target.files[0];
            const fileType = this.state.fileType;
            this.props.addModel(fileType, file);
        },
        onClickToUpload: async (fileType) => {
            this.buildInSvgList.current.style.display = "none";
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
            const {write_and_draw} = this.props;
            const estimate = this.props.generateGcode(write_and_draw);

            // The drawing time goes in the same message as the confirmation, because that is the moment the
            // toolpath exists and the question "how long will this take?" has an answer. It is a floor: pen up
            // and pen down and acceleration are not in it (see utils/estimatePlotTime.js), which is why it is
            // worded as "about" and rounded to two figures.
            messageI18n.success(describePlotTime(estimate));
        },
        exportGcode: () => {
            if (this.props.modelCount === 0) {
                messageI18n.warning('Load model first');
                return ;
            }
            if (!this.props.isAllPreviewed) {
                messageI18n.warning('Previewing');
                return ;
            }
            if (!this.props.gcode) {
                messageI18n.warning('Generate G-code first');
                return ;
            }
            const fileName = getTimestampName('.gcode');
            const gcode = this.props.gcode;
            const blob = new Blob([gcode], {type: 'text/plain;charset=utf-8'});
            saveAs(blob, fileName);
            messageI18n.success('Export G-code success');
        },
        startTask: () => {
            if (!this.props.gcode) {
                messageI18n.warning('Generate G-code first');
                return;
            }
            this.props.startJob(this.props.gcode, {mode: 'pen', offload: isOffloadEnabled()});
        }
    };

    render() {
        const {accept} = this.state;
        const {gcode} = this.props;
        const {t} = this.props;
        const actions = this.actions;
        return (
            <div style={{
                width: "100%",
                height: "100%"
            }}>
                <Space orientation={"vertical"} size="small"
                       style={{width: "100%", padding: "8px"}}>
                    {/* The play button brings the pair that used to sit below it down to one
                        control: stopping lives with the Cancel button on the Control panel. */}
                    <div style={{display: "flex", gap: "8px"}}>
                        <div style={{flex: 1, minWidth: 0}}>
                            <ActionButton onClick={actions.generateGcode} text={t("Generate G-code")}/>
                        </div>
                        {gcode &&
                        <PlayButton title={t("Start Send G-code")} onClick={actions.startTask}/>}
                    </div>
                    <ActionButton onClick={actions.exportGcode} text={t("Export G-code")}/>
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
                        className={`app-artwork ${styles.btn_select}`}
                        onClick={() => {
                            this.buildInSvgList.current.style.display = 'block'
                        }}
                    >
                        <h6 className={styles.h_file_type}>{t('Example')}</h6>
                    </button>
                    <button
                        className={`app-artwork ${styles.btn_svg}`}
                        onClick={() => actions.onClickToUpload('svg')}
                    >
                        <h6 className={styles.h_file_type}>{t('SVG')}</h6>
                    </button>
                    <button
                        className={`app-artwork ${styles.btn_trace}`}
                        onClick={() => actions.onClickToUpload('trace')}
                    >
                        <h6 className={styles.h_file_type}>{t('Trace Image')}</h6>
                    </button>
                    <button
                        className={`app-artwork ${styles.btn_image}`}
                        onClick={() => actions.onClickToUpload('image')}
                    >
                        <h6 className={styles.h_file_type}>{t('Image')}</h6>
                    </button>
                    <button
                        className={`app-artwork ${styles.btn_text}`}
                        onClick={() => actions.onClickToUpload('text')}
                    >
                        <h6 className={styles.h_file_type}>{t('Text')}</h6>
                    </button>
                </Space>
                <div
                    ref={this.buildInSvgList}
                    style={{width: "100%", padding: "5px 5px 5px 20px", display: "none"}}>
                    <Listy
                        className={styles.build_in_svg_list}
                        rowKey="key"
                        items={getBuildInSvgArray().map((src, key) => ({key, src}))}
                        itemRender={(item) => (
                            <img
                                className={`app-artwork ${styles.img_list_item}`}
                                src={item.src}
                                onClick={actions.onChooseBuildInSvg}/>
                        )}
                    />
                </div>
                <ConfigTrace/>
                <ConfigImage/>
                <ConfigSvg/>
                <ConfigText/>
                <Transformation/>
                <WorkingParameters/>
                <div style={{height: "15px"}}/>
            </div>
        )
    }
}

const mapStateToProps = (state) => {
    const {gcode, modelCount, isAllPreviewed, write_and_draw} = state.writeAndDraw;
    return {
        gcode,
        isAllPreviewed,
        modelCount,
        write_and_draw
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        startTask: (gcode, isAckChange) => dispatch(gcodeSendActions.startTask(gcode, isAckChange)),
        startJob: (gcode, opts) => dispatch(gcodeSendActions.startJob(gcode, opts)),
        addModel: (fileType, file) => dispatch(writeAndDrawActions.addModel(fileType, file)),
        generateGcode: (write_and_draw) => dispatch(writeAndDrawActions.generateGcode(write_and_draw)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(Index));
