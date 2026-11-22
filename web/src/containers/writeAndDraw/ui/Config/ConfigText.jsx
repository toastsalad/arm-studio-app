import React, {PureComponent} from 'react';
import {connect} from 'react-redux';
import {withTranslation} from 'react-i18next';
import {actions as writeAndDrawActions} from "../../../../reducers/writeAndDraw";
import {ConfigTextPanel} from "../../../../components/Config";

class Text extends PureComponent {
    render() {
        return (
            <ConfigTextPanel
                t={this.props.t}
                model={this.props.model}
                config={this.props.config}
                config_text={this.props.config_text}
                buildInFonts={this.props.buildInFonts}
                userFonts={this.props.userFonts}
                updateConfig={this.props.updateConfig}
                updateConfigText={this.props.updateConfigText}
            />
        );
    }
}

const mapStateToProps = (state) => {
    const {model, config, config_text} = state.writeAndDraw;
    const {buildInFonts, userFonts} = state.fonts;
    return {model, config, config_text, buildInFonts, userFonts};
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateConfig: (key, value) => dispatch(writeAndDrawActions.updateConfig(key, value)),
        updateConfigText: (key, value) => dispatch(writeAndDrawActions.updateConfigText(key, value)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(Text));
