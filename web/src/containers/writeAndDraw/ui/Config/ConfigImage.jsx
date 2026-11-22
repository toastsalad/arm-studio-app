import React, {PureComponent} from 'react';
import {connect} from 'react-redux';
import {withTranslation} from 'react-i18next';
import {ConfigSection, ConfigSvgOptions} from '../../../../components/Config';
import {actions as writeAndDrawActions} from '../../../../reducers/writeAndDraw';

// The Image panel: a picture, shaded by its own tone.
//
// It shows the same option component the SVG and trace panels use, because the controls are the same kind of
// thing -- but the settings it is given carry only the three fills that read a raster, so this panel offers
// shade, stipple and scribble and nothing else. The vector tabs deliberately do not list them: they have no
// picture to shade by.
class ConfigImage extends PureComponent {
    render() {
        const {t, model, config} = this.props;
        if (!model || model.fileType !== 'image' || !config) {
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
            console.error('Image config panel error:', e);
            return null;
        }
    }
}

const mapStateToProps = (state) => {
    const {model, config} = state.writeAndDraw;
    return {model, config};
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateConfig: (key, value) => dispatch(writeAndDrawActions.updateConfig(key, value)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(ConfigImage));
