import React, {PureComponent} from 'react';
import {actions as laserActions} from "../../../../reducers/laser";
import {connect} from 'react-redux';
import {ConfigSection, ConfigSvgOptions} from "../../../../components/Config";
import {withTranslation} from 'react-i18next';

// See the pen tab's ConfigSvg: the options are shared, and a laser drawing's settings simply
// carry fewer of them.
class ConfigSvg extends PureComponent {
    render() {
        const {t, model, config} = this.props;
        if (!model || model.fileType !== "svg" || !config) {
            return null;
        }
        try {
            return (
                <div>
                    <ConfigSection title={t(config.label)}>
                        <ConfigSvgOptions t={t} config={config} updateConfig={this.props.updateConfig}/>
                    </ConfigSection>
                </div>
            );
        } catch (e) {
            console.error("SVG config panel error:", e);
            return null;
        }
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

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(ConfigSvg));
