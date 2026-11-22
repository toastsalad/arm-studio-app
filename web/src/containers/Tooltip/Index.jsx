import React, {PureComponent} from 'react';
import {Tooltip} from 'react-tooltip';
import styles from './styles.css';
import {connect} from 'react-redux';

// react-tooltip v6: anchors use data-tooltip-id / data-tooltip-content.
class Index extends PureComponent {
    render() {
        const {isTooltipDisplayed, place, ...rest} = this.props;
        // Honour the "settings visibility" toggle: no tooltip element -> nothing shows.
        if (!isTooltipDisplayed) {
            return null;
        }
        return (
            <Tooltip
                className={styles.style_default}
                place={place || 'top'}
                delayShow={200}
                {...rest}/>
        );
    }
}

const mapStateToProps = (state) => {
    const {isTooltipDisplayed} = state.persistentData;
    return {isTooltipDisplayed};
};

export default connect(mapStateToProps)(Index);
