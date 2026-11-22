import React from "react";
import { Row, Col } from 'antd'
import {actions as gcodeSendActions} from "../../../../reducers/gcodeSend";
import {connect} from 'react-redux';
import socketClientManager from "../../../../socket/socketClientManager";
import { TEMPERATURE_MONITOR, TAP_P3D } from "../../../../constants";
import {withTranslation} from 'react-i18next';

class TemperatureDisplay extends React.Component {
  state = {
    currentTemperature: '0.00',

    targetTemperature: '0.00',

    timer: null
  }

  actions = {
    getTemperature: () => {
      this.props.startTask('M105', false)
    }
  }

  componentDidMount() {
    this._listener = socketClientManager.addServerListener(
        TEMPERATURE_MONITOR, (temperature) => {
            try {
              temperature = temperature.replace(/\s+/g, ''); // Strip spaces, e.g. okT:-15.00/0.00@:0
              temperature = temperature.split(':')[1] // -15.00/0.00@
              temperature = temperature.replace('@', '') //  -15.00/0.00
              const res = temperature.split('/') || []
              this.setState({
                currentTemperature: res[0] || this.state.currentTemperature,
                targetTemperature: res[1] || this.state.targetTemperature
              })
            } catch (error) {
              console.error(error)
            }
        }
    );
  }

  componentWillUnmount() {
    if (this._listener) {
      socketClientManager.removeServerListener(TEMPERATURE_MONITOR, this._listener);
      this._listener = null;
    }
    if (this.state.timer) {
      clearInterval(this.state.timer);
    }
  }

  componentDidUpdate () {
    const { timer } = this.state
    const { tap, path, jobState } = this.props
    // The bridge owns the ack loop during an offloaded job. An M105 poll would
    // be rejected as busy, or worse, desync the job if it were forwarded.
    const bridgeBusy = ['running', 'paused', 'stopping', 'finishing'].includes(jobState)

    if (timer && (tap !== TAP_P3D || !path || bridgeBusy)) {
      clearInterval(this.state.timer)
      this.setState({
        timer: null
      })

      return
    }

    if (!timer && (tap === TAP_P3D && path && !bridgeBusy)) {
      this.setState({
        timer: setInterval(() => {
          this.actions.getTemperature()
        }, 2000)
      })
    }
  }

  render () {
    const { currentTemperature, targetTemperature } = this.state
    const { t } = this.props

    return (
      <div 
        style={{
          background: 'var(--app-surface-bg)',
          border: '1px solid var(--app-border)',
          boxShadow: '0 2px 0 rgb(0 0 0 / 2%)'
        }}>
        <Row
          style={{
            height: '32px',
            padding: '0 16px 0 16px',
            boxSizing: 'border-box',
            borderBottom: '1px solid var(--app-border)'
          }}>
          <Col 
            span={10}
            style={{
              lineHeight: '32px'
            }}>
              <span>{t("Current Temperature")}</span>
          </Col>
          <Col 
            span={14}
            style={{
              lineHeight: '32px'
            }}>
              <div style={{ textAlign: 'right' }}>{`${currentTemperature}°C`}</div>
          </Col>
        </Row>
        <Row
          style={{
            height: '32px',
            padding: '0 16px 0 16px',
            boxSizing: 'border-box'
          }}>
            <Col 
              span={10}
              style={{
                lineHeight: '32px'
              }}>
                <span>{t("Target Temperature")}</span>
            </Col>
            <Col 
              span={14}
              style={{
                lineHeight: '32px'
              }}>
                <div style={{ textAlign: 'right' }}>{`${targetTemperature}°C`}</div>
            </Col>
        </Row>
      </div>
    )
  }
}

const mapStateToProps = (state) => {
  const { tap } = state.taps
  const { path, job } = state.serialPort
  return { tap, path, jobState: job && job.state };
};

const mapDispatchToProps = (dispatch) => {
  return {
      startTask: (gcode, isAckChange) => dispatch(gcodeSendActions.startTask(gcode, isAckChange))
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(TemperatureDisplay));