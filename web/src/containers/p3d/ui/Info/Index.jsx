import React from 'react';
import {connect} from 'react-redux';
import styles from './styles.css';

// printTime is in seconds
const getPrintTimeDes = (printTime) => {
    const hours = Math.floor(printTime / 3600);
    const minutes = Math.ceil((printTime - hours * 3600) / 60);
    return (hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`);
};

class Index extends React.Component {
    render() {
        if (!this.props.result) {
            return null;
        }
        const {printTime, filamentLength, filamentWeight} = this.props.result;
        return (
            <span className={styles.stats}>
                {`${filamentLength.toFixed(1)} m / ${filamentWeight.toFixed(1)} g · ${getPrintTimeDes(printTime)}`}
            </span>
        )
    }
}

const mapStateToProps = (state) => {
    const {result} = state.p3dModel;
    return {
        result,
    };
};

export default connect(mapStateToProps)(Index);
