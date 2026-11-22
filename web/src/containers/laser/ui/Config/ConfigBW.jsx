import React, {PureComponent} from 'react';
import {Checkbox} from 'antd';
import {actions as laserActions} from "../../../../reducers/laser";
import {connect} from 'react-redux';
import {ConfigNumber, ConfigRow, ConfigSection, ConfigSelect} from "../../../../components/Config";
import {withTranslation} from 'react-i18next';
import Tooltip from '../../../Tooltip/Index.jsx';
import {getUuid} from '../../../../utils';

const tooltipId = getUuid();

class ConfigBW extends PureComponent {
    actions = {
        setInvert: (e) => {
            this.props.updateConfig("invert", e.target.checked)
        },
        setBW: (value) => {
            this.props.updateConfig("bw", value)
        },
        setDensity: (value) => {
            this.props.updateConfig("density", value)
        },
        setLineDirection: (value) => {
            this.props.updateConfig("line_direction", value)
        }
    };

    render() {
        const {t} = this.props;
        const {model, config} = this.props;
        if (!model || model.fileType !== "bw" || !config) {
            return null;
        }
        const actions = this.actions;
        const {invert, bw, line_direction, density} = config.children;

        const directionOptions = [];
        Object.keys(line_direction.options).forEach((key) => {
            const option = line_direction.options[key];
            directionOptions.push({label: key, value: option})
        });
        return (
            <div>
                <Tooltip
                    id={tooltipId}
                    place="left"
                   />
                <ConfigSection title={t(config.label)}>
                    <ConfigRow
                        label={t(invert.label)}
                        tooltip={t(invert.description)}
                        tooltipId={tooltipId}>
                        <Checkbox checked={invert.default_value} onChange={actions.setInvert}/>
                    </ConfigRow>
                    <ConfigRow
                        label={t(bw.label)}
                        tooltip={t(bw.description)}
                        tooltipId={tooltipId}>
                        <ConfigNumber
                            min={bw.minimum_value}
                            max={bw.maximum_value}
                            value={bw.default_value}
                            onChange={actions.setBW}/>
                    </ConfigRow>
                    <ConfigRow
                        label={t(density.label)} unit={density.unit}
                        tooltip={t(density.description)}
                        tooltipId={tooltipId}>
                        <ConfigNumber
                            min={density.minimum_value}
                            max={density.maximum_value}
                            value={density.default_value}
                            onChange={actions.setDensity}/>
                    </ConfigRow>
                    <ConfigRow
                        label={t(line_direction.label)}
                        tooltip={t(line_direction.description)}
                        tooltipId={tooltipId}>
                        <ConfigSelect options={directionOptions} value={line_direction.default_value}
                                      onChange={actions.setLineDirection}/>
                    </ConfigRow>
                </ConfigSection>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const {model, config} = state.laser;
    return {
        model,
        config
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateConfig: (key, value) => dispatch(laserActions.updateConfig(key, value)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(ConfigBW));

