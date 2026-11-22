import React, {PureComponent} from 'react';
import {Checkbox} from 'antd';
import {actions as laserActions} from "../../../../reducers/laser";
import {connect} from 'react-redux';
import {ConfigNumber, ConfigRow, ConfigSection, ConfigSelect} from "../../../../components/Config";
import {withTranslation} from 'react-i18next';
import Tooltip from '../../../Tooltip/Index.jsx';
import {getUuid} from '../../../../utils';

const tooltipId = getUuid();

class ConfigGreyscale extends PureComponent {
    actions = {
        setInvert: (e) => {
            this.props.updateConfig("invert", e.target.checked)
        },
        setContrast: (value) => {
            this.props.updateConfig("contrast", value)
        },
        setBrightness: (value) => {
            this.props.updateConfig("brightness", value)
        },
        setWhiteClip: (value) => {
            this.props.updateConfig("white_clip", value)
        },
        setAlgorithm: (value) => {
            this.props.updateConfig("algorithm", value)
        },
        setMovementMode: (value) => {
            this.props.updateConfig("movement_mode", value)
        },
        setDensity: (value) => {
            this.props.updateConfig("density", value)
        },
    };

    render() {
        const {t} = this.props;
        const {model, config} = this.props;
        if (!model || model.fileType !== "greyscale" || !config) {
            return null;
        }
        const actions = this.actions;
        const {invert, contrast, brightness, white_clip, algorithm, movement_mode, density} = config.children;

        const algorithmOptions = [];
        Object.keys(algorithm.options).forEach((key) => {
            const option = algorithm.options[key];
            algorithmOptions.push({label: key, value: option})
        });

        const movementModeOptions = [];
        Object.keys(movement_mode.options).forEach((key) => {
            const option = movement_mode.options[key];
            movementModeOptions.push({label: key, value: option})
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
                        label={t(contrast.label)}
                        tooltip={t(contrast.description)}
                        tooltipId={tooltipId}>
                        <ConfigNumber
                            min={contrast.minimum_value}
                            max={contrast.maximum_value}
                            value={contrast.default_value}
                            onChange={actions.setContrast}/>
                    </ConfigRow>
                    <ConfigRow
                        label={t(brightness.label)}
                        tooltip={t(brightness.description)}
                        tooltipId={tooltipId}>
                        <ConfigNumber
                            min={brightness.minimum_value}
                            max={brightness.maximum_value}
                            value={brightness.default_value}
                            onChange={actions.setBrightness}/>
                    </ConfigRow>
                    <ConfigRow
                        label={t(white_clip.label)}
                        tooltip={t(white_clip.description)}
                        tooltipId={tooltipId}>
                        <ConfigNumber
                            min={white_clip.minimum_value}
                            max={white_clip.maximum_value}
                            value={white_clip.default_value}
                            onChange={actions.setWhiteClip}/>
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
                        label={t(algorithm.label)}
                        tooltip={t(algorithm.description)}
                        tooltipId={tooltipId}>
                        <ConfigSelect options={algorithmOptions} value={algorithm.default_value}
                                      onChange={actions.setAlgorithm}/>
                    </ConfigRow>
                    <ConfigRow
                        label={t(movement_mode.label)}
                        tooltip={t(movement_mode.description)}
                        tooltipId={tooltipId}>
                        <ConfigSelect options={movementModeOptions} value={movement_mode.default_value}
                                      onChange={actions.setMovementMode}/>
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

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(ConfigGreyscale));

