import React from 'react';
import {connect} from 'react-redux';
import TwoDContainer from '../_2d/ui/Container/Index.jsx';
import {Canvas2dPen as Canvas2D} from './ui/Canvas2D/Index.jsx';
import Config from "./ui/Config/Index.jsx";
import Control from "./ui/Control/Index.jsx";
import {actions as writeAndDrawActions} from "../../reducers/writeAndDraw";

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
    const {model, modelCount} = state.writeAndDraw;
    return {
        model,
        modelCount
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        removeSelected: () => dispatch(writeAndDrawActions.removeSelected()),
        removeAll: () => dispatch(writeAndDrawActions.removeAll()),
        duplicateSelected: () => dispatch(writeAndDrawActions.duplicateSelected()),
        undo: () => dispatch(writeAndDrawActions.undo()),
        redo: () => dispatch(writeAndDrawActions.redo()),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Index);
