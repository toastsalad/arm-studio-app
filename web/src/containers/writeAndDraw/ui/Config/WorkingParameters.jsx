import React, {PureComponent} from 'react';
import {actions as writeAndDrawActions} from "../../../../reducers/writeAndDraw";
import {connect} from 'react-redux';
import {ConfigNumber, ConfigRow, ConfigSection} from "../../../../components/Config";
import {withTranslation} from 'react-i18next';
import Tooltip from '../../../Tooltip/Index.jsx';
import {getUuid} from '../../../../utils';

const tooltipId = getUuid();

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
        setJogPenOffset: (value) => {
            this.props.updateWriteAndDrawParameters("jog_pen_offset", value)
        }
    };

    render() {
        const {model, working_parameters, config, jog_pen_offset} = this.props;
        const {t} = this.props;

        if (!model || !working_parameters || !config) {
            return null;
        }
        const actions = this.actions;
        const {work_speed, jog_speed} = working_parameters.children;
        return (
            <div>
                <Tooltip
                    id={tooltipId}
                    place="left"
                />
                <ConfigSection title={t(working_parameters.label)}>
                    <ConfigRow
                        label={t(work_speed.label)} unit={work_speed.unit}
                        tooltip={t('Determines how fast the front end moves when it’s working.')}
                        tooltipId={tooltipId}>
                        <ConfigNumber
                            min={work_speed.minimum_value}
                            max={work_speed.maximum_value}
                            value={work_speed.default_value}
                            onChange={actions.setWorkSpeed}/>
                    </ConfigRow>
                    <ConfigRow
                        label={t(jog_speed.label)} unit={jog_speed.unit}
                        tooltip={t('Determines how fast the front end moves when it’s working.')}
                        tooltipId={tooltipId}>
                        <ConfigNumber
                            min={jog_speed.minimum_value}
                            max={jog_speed.maximum_value}
                            value={jog_speed.default_value}
                            onChange={actions.setJogSpeed}/>
                    </ConfigRow>
                    <ConfigRow
                        label={t(jog_pen_offset.label)} unit={jog_pen_offset.unit}
                        tooltip={t('Determines the offset of the pen when it is not drawn.')}
                        tooltipId={tooltipId}>
                        <ConfigNumber
                            min={jog_pen_offset.minimum_value}
                            max={jog_pen_offset.maximum_value}
                            value={jog_pen_offset.default_value}
                            onChange={actions.setJogPenOffset}/>
                    </ConfigRow>
                </ConfigSection>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const {model, working_parameters, config} = state.writeAndDraw;
    const {jog_pen_offset} = state.writeAndDraw.write_and_draw;

    return {
        model,
        working_parameters,
        config,
        jog_pen_offset
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateWorkingParameters: (key, value) => dispatch(writeAndDrawActions.updateWorkingParameters(key, value)),
        updateWriteAndDrawParameters: (key, value) => dispatch(writeAndDrawActions.updateWriteAndDrawParameters(key, value))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(WorkingParameters));

