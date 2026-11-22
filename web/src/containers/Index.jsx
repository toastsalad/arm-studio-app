import React from 'react';
import Taps from './taps/Index.jsx';
import {connect} from 'react-redux';

class Index extends React.Component {
    render() {
        return (
            <div>
                <Taps/>
            </div>
        )
    }
}

const mapStateToProps = (state) => {
    return {};
};

export default connect(mapStateToProps)(Index);
