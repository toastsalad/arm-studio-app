import React from 'react';
import {connect} from 'react-redux';
import {Radio, Space, Modal, Button, Input, Divider} from 'antd';
import {actions as serialPortActions} from '../../reducers/serialPort';
import styles from './styles.css';
import {withTranslation} from 'react-i18next';
import messageI18n from '../../utils/messageI18n';
import Level from '../Level/Index.jsx';
import armCalibrationImg from './images/arm_calibration.jpg';

// Front-end module ids understood by the arm firmware (M888 Pn)
const MODULES = [
    {value: 0, label: 'Pen'},
    {value: 1, label: 'Laser'},
    {value: 2, label: 'Pump'},
    {value: 3, label: '3D'},
    {value: 6, label: 'Rotary'},
];

class Index extends React.Component {
    state = {
        showModal: false,
        module: 0,
        slopeX: '',
        slopeY: '',
    };

    write = (gcode) => this.props.serialPortWrite(gcode);

    showModal = () => {
        this.setState({showModal: true});
    };

    closeModal = () => {
        this.setState({showModal: false});
    };

    setModule = (e) => {
        const module = e.target.value;
        this.setState({module});
        this.write(`M888 P${module}\n`);
    };

    home = () => this.write('M1112\nM114\n');

    // Manual "How to re-calibrate DexArm or reset encoder values":
    //   M18 (deactivate motors) -> move Axis1/Axis2 to max -> M889 -> M1112
    disableMotors = () => this.write('M18\n');

    resetEncoder = () => this.write('M889\n');

    readSensors = () => this.write('M890\n');

    readSlopes = () => this.write('M892\n');

    readStoredLeveling = () => this.write('!level status\n');

    resetSlopes = () => this.write('M891 X0 Y0\n');

    setSlopes = () => {
        const x = parseFloat(this.state.slopeX);
        const y = parseFloat(this.state.slopeY);
        if (Number.isNaN(x) || Number.isNaN(y)) {
            messageI18n.error('Enter both X and Y slope values');
            return;
        }
        this.write(`M891 X${x} Y${y}\n`);
    };

    render() {
        const {t, leveling} = this.props;
        const state = this.state;

        const section = (title, desc, children) => (
            <div style={{marginBottom: '12px'}}>
                <div style={{fontWeight: 600}}>{title}</div>
                {desc && <div style={{opacity: 0.65, marginBottom: '6px'}}>{desc}</div>}
                {children}
            </div>
        );

        return (
            <div>
                <Button block onClick={this.showModal}>{t('Calibration')}</Button>

                <Modal
                    title={t('Calibration')}
                    open={state.showModal}
                    width={820}
                    footer={null}
                    centered={true}
                    classNames={{body: styles.modal_body}}
                    onCancel={this.closeModal}>

                    <div className={styles.scroll_area}>
                        <Space orientation="vertical" style={{width: '100%'}} size={4}>

                            {section(
                                t('1. Front-end Module'),
                                t('Tell the arm which module is currently mounted (M888).'),
                                <Radio.Group value={state.module} onChange={this.setModule} buttonStyle="solid">
                                    {MODULES.map((m) => (
                                        <Radio.Button key={m.value} value={m.value}>{t(m.label)}</Radio.Button>
                                    ))}
                                </Radio.Group>
                            )}

                            <Divider style={{margin: '4px 0'}}/>

                            {section(
                                t('2. Re-calibrate DexArm / Reset Encoder Values'),
                                t('Follow these steps if the arm got stuck during operation. This resets the encoder values.'),
                                <div>
                                    <div style={{marginTop: 6}}>
                                        <b>{t('Step')} 1:</b> {t('Send M18 to deactivate the motors.')}
                                    </div>
                                    <Button size="small" onClick={this.disableMotors} style={{marginBottom: 8}}>
                                        {t('Disable Motors (M18)')}
                                    </Button>

                                    <div>
                                        <b>{t('Step')} 2:</b> {t('Manually adjust the arm to the position below, making sure Axis 1 and Axis 2 are at their maximum position and the arm is resting on the base.')}
                                    </div>
                                    <img
                                        src={armCalibrationImg}
                                        alt={t('Arm calibration position')}
                                        style={{display: 'block', maxWidth: '100%', border: '1px solid var(--app-border)', borderRadius: 4, margin: '6px 0'}}
                                    />

                                    <div>
                                        <b>{t('Step')} 3:</b> {t('Send M889. The robot will read and save this position.')}
                                    </div>
                                    <Button size="small" onClick={this.resetEncoder} style={{marginBottom: 4}}>
                                        {t('Reset Encoder (M889)')}
                                    </Button>
                                    <Button size="small" type="link" onClick={this.readSensors}>
                                        {t('Read Sensors (M890)')}
                                    </Button>

                                    <div>
                                        <b>{t('Step')} 4:</b> {t('Send M1112. The arm will move to the HOME position (X0 Y300 Z0).')}
                                    </div>
                                    <Button size="small" onClick={this.home} style={{marginBottom: 4}}>
                                        {t('Home (M1112)')}
                                    </Button>

                                    <div style={{opacity: 0.75, marginTop: 4}}>
                                        {t('Encoder value reset completed — you can move the arm smoothly now.')}
                                    </div>
                                </div>
                            )}

                            <Divider style={{margin: '4px 0'}}/>

                            {section(
                                t('3. Bed Leveling'),
                                t('Level the build plate with the 4-point paper method (M891).'),
                                <Level showLevel={true}/>
                            )}

                            <Divider style={{margin: '4px 0'}}/>

                            {section(
                                t('4. XY Slope Compensation'),
                                t('Read the stored slope, resets it, or set it manually (M891 / M892).'),
                                <>
                                <Space wrap>
                                    <Button onClick={this.readSlopes}>{t('Read Slopes (M892)')}</Button>
                                    <Button onClick={this.readStoredLeveling}>{t('Read Stored Leveling')}</Button>
                                    <Button onClick={this.resetSlopes}>{t('Reset Slopes')}</Button>
                                    <Space.Compact>
                                        <Input placeholder="X" style={{width: 80}} value={state.slopeX}
                                               onChange={(e) => this.setState({slopeX: e.target.value})}/>
                                        <Input placeholder="Y" style={{width: 80}} value={state.slopeY}
                                               onChange={(e) => this.setState({slopeY: e.target.value})}/>
                                        <Button onClick={this.setSlopes}>{t('Set')}</Button>
                                    </Space.Compact>
                                </Space>
                                {leveling &&
                                <div style={{opacity: 0.75, marginTop: 4}}>
                                    {`${t('Stored on bridge')}: X ${Number(leveling.x || 0).toFixed(4)}  Y ${Number(leveling.y || 0).toFixed(4)}` +
                                     (leveling.firmware && leveling.firmware.x !== undefined
                                        ? `   ${t('Firmware')}: X ${Number(leveling.firmware.x).toFixed(4)}  Y ${Number(leveling.firmware.y).toFixed(4)}`
                                        : '')}
                                </div>}
                                </>
                            )}

                        </Space>
                    </div>
                </Modal>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {leveling: state.serialPort.leveling};
};

const mapDispatchToProps = (dispatch) => {
    return {
        serialPortWrite: (gcode) => dispatch(serialPortActions.write(gcode)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(Index));
