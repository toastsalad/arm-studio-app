import React, {PureComponent} from 'react';
import {connect} from 'react-redux';
import {withTranslation} from 'react-i18next';
import {actions as laserActions} from "../../../../reducers/laser";
import ConfigTransformation from '../../../../components/Config/ConfigTransformation/Index.jsx';

class Transformation extends PureComponent {
    render() {
        return (
            <ConfigTransformation
                t={this.props.t}
                model={this.props.model}
                transformation={this.props.transformation}
                isLockScale={this.props.isLockScale}
                previewOnMove={false}
                updateTransformation={this.props.updateTransformation}
                toggleIsLockScale={this.props.toggleIsLockScale}
            />
        );
    }
}

const mapStateToProps = (state) => {
    const {model, transformation, isLockScale} = state.laser;
    return {
        model,
        transformation,
        isLockScale
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateTransformation: (key, value, preview) => dispatch(laserActions.updateTransformation(key, value, preview)),
        toggleIsLockScale: () => dispatch(laserActions.toggleIsLockScale())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(Transformation));
