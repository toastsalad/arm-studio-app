import React, {PureComponent} from 'react';
import {Checkbox} from 'antd';
import {actions as laserActions} from "../../../../reducers/laser";
import {connect} from 'react-redux';
import {ConfigNumber, ConfigRow, ConfigSection} from "../../../../components/Config";
import {withTranslation} from 'react-i18next';
import Tooltip from '../../../Tooltip/Index.jsx';
import {getUuid} from '../../../../utils';

const tooltipId = getUuid();

const getHiddenValue = (hiddenStr = "", config) => {
    let hidden = false;
    hiddenStr = hiddenStr.trim();
    if (hiddenStr.length > 0) {
        hiddenStr = hiddenStr.replace(/\s+/g, " ");

        const tokens = hiddenStr.split(" ");

        if (tokens.length !== 3) {
            return false;
        }

        const left = tokens[0];
        const opt = tokens[1];
        const rightValue = tokens[2];

        if (!config.children[left]) {
            return false;
        }
        const leftValue = config.children[left].default_value;
        switch (opt) {
            case "==" :
            case "===" :
                hidden = (leftValue === rightValue);
                break;
            case "!=" :
            case "!==" :
                hidden = (leftValue !== rightValue);
                break;
            case ">" :
                hidden = (leftValue > rightValue);
                break;
            case "<" :
                hidden = (leftValue < rightValue);
                break
        }
    }
    return hidden;
};

class WorkingParameters extends PureComponent {
    actions = {
        setPrintOrder: (value) => {
            this.props.updateWorkingParameters("print_order", value)
        },
        setJogSpeed: (value) => {
            this.props.updateWorkingParameters("jog_speed", value)
        },
        setWorkSpeed: (value) => {
            this.props.updateWorkingParameters("work_speed", value)
        },
        setDwellTime: (value) => {
            this.props.updateWorkingParameters("dwell_time", value)
        },
        setEngraveTime: (value) => {
            this.props.updateWorkingParameters("engrave_time", value)
        },
        setMultiPass: (e) => {
            this.props.updateWorkingParameters("multi_pass", e.target.checked)
        },
        setMultiPassPasses: (value) => {
            this.props.updateWorkingParameters("multi_pass.passes", value)
        },
        setMultiPassPassDepth: (value) => {
            this.props.updateWorkingParameters("multi_pass.pass_depth", value)
        },
        setPower: (value) => {
            this.props.updateWorkingParameters("power", value)
        }
    };

    render() {
        const {t} = this.props;
        const {model, working_parameters, config} = this.props;
        if (!model || !working_parameters || !config) {
            return null;
        }
        const actions = this.actions;
        const {multi_pass, power} = working_parameters.children;

        const {work_speed, jog_speed, dwell_time, engrave_time} = working_parameters.children;
        const {passes, pass_depth} = multi_pass.children;
        const {movement_mode} = config.children;

        // TODO: derive field visibility from the settings schema.
        let jogSpeedVisible = true;
        let dwellTimeVisible = false;
        let engraveTimeVisible = false;
        if (movement_mode && movement_mode.default_value === "greyscale-dot") {
            jogSpeedVisible = false;
            dwellTimeVisible = true;
            engraveTimeVisible = true;
        }
        return (
            <div>
                <Tooltip
                    id={tooltipId}
                    place="left"/>
                <ConfigSection title={t(working_parameters.label)}>
                    <ConfigRow
                        label={t(work_speed.label)} unit={work_speed.unit}
                        tooltip={t(work_speed.description)}
                        tooltipId={tooltipId}>
                        <ConfigNumber
                            min={work_speed.minimum_value}
                            max={work_speed.maximum_value}
                            value={work_speed.default_value}
                            onChange={actions.setWorkSpeed}/>
                    </ConfigRow>
                    <ConfigRow
                        style={{display: jogSpeedVisible ? "" : "none"}}
                        label={t(jog_speed.label)} unit={jog_speed.unit}
                        tooltip={t(jog_speed.description)}
                        tooltipId={tooltipId}>
                        <ConfigNumber
                            min={jog_speed.minimum_value}
                            max={jog_speed.maximum_value}
                            value={jog_speed.default_value}
                            onChange={actions.setJogSpeed}/>
                    </ConfigRow>
                    <ConfigRow
                        style={{display: dwellTimeVisible ? "" : "none"}}
                        label={t(dwell_time.label)} unit={dwell_time.unit}
                        tooltip={t(dwell_time.description)}
                        tooltipId={tooltipId}>
                        <ConfigNumber
                            min={dwell_time.minimum_value}
                            max={dwell_time.maximum_value}
                            value={dwell_time.default_value}
                            onChange={actions.setDwellTime}/>
                    </ConfigRow>
                    <ConfigRow
                        style={{display: engraveTimeVisible ? "" : "none"}}
                        label={t(engrave_time.label)} unit={engrave_time.unit}
                        tooltip={t(engrave_time.description)}
                        tooltipId={tooltipId}>
                        <ConfigNumber
                            min={engrave_time.minimum_value}
                            max={engrave_time.maximum_value}
                            value={engrave_time.default_value}
                            onChange={actions.setEngraveTime}/>
                    </ConfigRow>
                    <ConfigRow
                        label={t(power.label)} unit={power.unit}
                        tooltip={t(power.description)}
                        tooltipId={tooltipId}>
                        <ConfigNumber
                            min={power.minimum_value}
                            max={power.maximum_value}
                            value={power.default_value}
                            onChange={actions.setPower}/>
                    </ConfigRow>
                    <ConfigRow
                        label={t(multi_pass.label)}
                        tooltip={t(multi_pass.description)}
                        tooltipId={tooltipId}>
                        <Checkbox checked={multi_pass.default_value} onChange={actions.setMultiPass}/>
                    </ConfigRow>
                    <ConfigRow
                        style={{display: multi_pass.default_value ? "" : "none"}}
                        indent
                        label={t(passes.label)}
                        tooltip={t(passes.description)}
                        tooltipId={tooltipId}>
                        <ConfigNumber
                            min={passes.minimum_value}
                            max={passes.maximum_value}
                            value={passes.default_value}
                            onChange={actions.setMultiPassPasses}/>
                    </ConfigRow>
                    <ConfigRow
                        style={{display: multi_pass.default_value ? "" : "none"}}
                        indent
                        label={t(pass_depth.label)} unit={pass_depth.unit}
                        tooltip={t(pass_depth.description)}
                        tooltipId={tooltipId}>
                        <ConfigNumber
                            min={pass_depth.minimum_value}
                            max={pass_depth.maximum_value}
                            value={pass_depth.default_value}
                            precision={2}
                            onChange={actions.setMultiPassPassDepth}/>
                    </ConfigRow>
                </ConfigSection>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const {model, working_parameters, config} = state.laser;
    return {
        model,
        working_parameters,
        config
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateWorkingParameters: (key, value) => dispatch(laserActions.updateWorkingParameters(key, value)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(WorkingParameters));

