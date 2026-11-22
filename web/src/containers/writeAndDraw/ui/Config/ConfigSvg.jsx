import React, {PureComponent} from 'react';
import {actions as writeAndDrawActions} from "../../../../reducers/writeAndDraw";
import {connect} from 'react-redux';
import {ConfigSection, ConfigSvgOptions} from "../../../../components/Config";
import {withTranslation} from 'react-i18next';

// The SVG panel is only its heading: the options themselves are shared with the trace and text
// panels, which plot the same way (see components/Config/ConfigSvgOptions).
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
    const {model, config} = state.writeAndDraw;
    return {
        model,
        config
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateConfig: (key, value) => dispatch(writeAndDrawActions.updateConfig(key, value)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(ConfigSvg));
