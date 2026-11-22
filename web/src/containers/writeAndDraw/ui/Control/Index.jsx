import React from 'react';
import {connect} from 'react-redux';
import DeviceControl from "../../../_deviceControl/Index.jsx"
import {FRONT_END} from '../../../../utils/workAreaUtils.js'
import {actions as gcodeSendActions} from "../../../../reducers/gcodeSend";
import {getGcode4runBoundary} from "../../../../reducers/writeAndDraw";

class Index extends React.Component {
    actions = {
        // Traces the edge of the job so it can be checked against the material before it is drawn.
        runBoundary: () => {
            this.props.startTask(getGcode4runBoundary(), false);
        }
    };

    render() {
        return (
            <div>
                <DeviceControl
                    showLevel={true}
                    showRunBoundary={true}
                    runBoundary={this.actions.runBoundary}
                    frontEnd={FRONT_END.PEN}
                    gcode={this.props.gcode}
                />
            </div>
        )
    }
}

const mapStateToProps = (state) => ({gcode: state.writeAndDraw.gcode});

const mapDispatchToProps = (dispatch) => {
    return {
        startTask: (gcode, isAckChange) => dispatch(gcodeSendActions.startTask(gcode, isAckChange)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Index);
