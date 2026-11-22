import React, {PureComponent} from 'react';
import {connect} from 'react-redux';
import {withTranslation} from 'react-i18next';
import {actions as writeAndDrawActions} from "../../../../reducers/writeAndDraw";
import ConfigTransformation from '../../../../components/Config/ConfigTransformation/Index.jsx';

class Transformation extends PureComponent {
    render() {
        return (
            <ConfigTransformation
                t={this.props.t}
                model={this.props.model}
                transformation={this.props.transformation}
                isLockScale={this.props.isLockScale}
                previewOnMove={true}
                updateTransformation={this.props.updateTransformation}
                toggleIsLockScale={this.props.toggleIsLockScale}
            />
        );
    }
}

const mapStateToProps = (state) => {
    const {model, transformation, isLockScale} = state.writeAndDraw;
    return {
        model,
        transformation,
        isLockScale
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateTransformation: (key, value, preview) => dispatch(writeAndDrawActions.updateTransformation(key, value, preview)),
        toggleIsLockScale: () => dispatch(writeAndDrawActions.toggleIsLockScale())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(Transformation));
