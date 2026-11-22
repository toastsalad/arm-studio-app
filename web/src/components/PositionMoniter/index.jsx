import React from 'react';
import socketClientManager from "../../socket/socketClientManager";
import {FRONT_END_POSITION_MONITOR} from "../../constants";
import styles from './styles.css'
import {ConfigTitle} from "../Config";
import {withTranslation} from 'react-i18next';
import {Row, Col} from 'antd';
import {connect} from 'react-redux';

class Index extends React.Component {
    state = {
        x: 0,
        y: 0,
        z: 0,
        e: 0
    };

    componentDidMount() {
        this._listener = socketClientManager.addServerListener(
            FRONT_END_POSITION_MONITOR, (position) => {
                const tracker = this.props.jobTracker;
                if (tracker && tracker.active && tracker.offloaded) return;
                this.setState(position);
            }
        );
    }

    componentDidUpdate(prevProps) {
        const tracker = this.props.jobTracker;
        const position = tracker && tracker.position;
        if (!tracker || !tracker.active || !position) return;
        const old = prevProps.jobTracker && prevProps.jobTracker.position;
        if (!old || old.x !== position.x || old.y !== position.y || old.z !== position.z) {
            this.setState({x: position.x, y: position.y, z: position.z});
        }
    }

    componentWillUnmount() {
        if (this._listener) {
            socketClientManager.removeServerListener(FRONT_END_POSITION_MONITOR, this._listener);
            this._listener = null;
        }
    }

    render() {
        const state = this.state;
        const {t} = this.props;

        return (
            <div className={styles.bkg}>
                <ConfigTitle text={t("Axes")} style={{margin: 0}}/>
                <div className={styles.axes}>
                    <Row className={styles.border_down}>
                        <Col span={2} push={1} className={styles.border_right}>
                            <span className={styles.text}>X</span>
                        </Col>
                        <Col span={20} push={1} className={styles.value}>
                            <span className={styles.text}>{`${state.x} mm`}</span>
                        </Col>
                    </Row>
                    <Row className={styles.border_down}>
                        <Col span={2} push={1} className={styles.border_right}>
                            <span className={styles.text}>Y</span>
                        </Col>
                        <Col span={20} push={1} className={styles.value}>
                            <span className={styles.text}>{`${state.y} mm`}</span>
                        </Col>
                    </Row>
                    <Row className={styles.border_down}>
                        <Col span={2} push={1} className={styles.border_right}>
                            <span className={styles.text}>Z</span>
                        </Col>
                        <Col span={20} push={1} className={styles.value}>
                            <span className={styles.text}>{`${state.z} mm`}</span>
                        </Col>
                    </Row>
                    <Row>
                        <Col span={2} push={1} className={styles.border_right}>
                            <span className={styles.text}>E</span>
                        </Col>
                        <Col span={20} push={1} className={styles.value}>
                            <span className={styles.text}>{`${state.e} mm`}</span>
                        </Col>
                    </Row>
                </div>
            </div>
        )
    }
}

const mapStateToProps = (state) => {
    return {jobTracker: state.jobTracker};
};

export default connect(mapStateToProps)(withTranslation()(Index))
