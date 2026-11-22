import React from 'react';
import {connect} from 'react-redux';
import TwoDContainer from '../_2d/ui/Container/Index.jsx';
import {Canvas2dLaser as Canvas2D} from '../writeAndDraw/ui/Canvas2D/Index.jsx';
import Config from "./ui/Config/Index.jsx";
import Control from "./ui/Control/Index.jsx";
import {actions as laserActions} from "../../reducers/laser";

class Index extends React.Component {
    render() {
        return (
            <TwoDContainer
                Canvas={Canvas2D}
                Config={Config}
                Control={Control}
                model={this.props.model}
                modelCount={this.props.modelCount}
                undo={this.props.undo}
                redo={this.props.redo}
                duplicateSelected={this.props.duplicateSelected}
                removeSelected={this.props.removeSelected}
                removeAll={this.props.removeAll}
            />
        )
    }
}

const mapStateToProps = (state) => {
    const {model, modelCount} = state.laser;
    return {
        model,
        modelCount
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        removeSelected: () => dispatch(laserActions.removeSelected()),
        removeAll: () => dispatch(laserActions.removeAll()),
        duplicateSelected: () => dispatch(laserActions.duplicateSelected()),
        undo: () => dispatch(laserActions.undo()),
        redo: () => dispatch(laserActions.redo()),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Index);
