import React from 'react';
import {connect} from 'react-redux';
import DeviceControl from "../../../_deviceControl/Index.jsx"
import {FRONT_END} from "../../../../utils/workAreaUtils";

class Index extends React.Component {
    render() {
        return (
            <div>
                <DeviceControl
                    showLevel={true}
                    frontEnd={FRONT_END.P3D}
                    gcode={this.props.gcode}
                />
            </div>
        )
    }
}

const mapStateToProps = (state) => ({gcode: state.p3dModel.result});

export default connect(mapStateToProps)(Index);
