import React from 'react';
import DeviceControl from '../../../_deviceControl/Index.jsx'
import front_end_control from '../../lib/settings/front_end_control.json';
import movement from '../../lib/settings/movement.json';
import accessories from '../../lib/settings/accessories.json'
import {Space, Select, Row, Col, Radio, Slider, Tooltip} from 'antd';
import messageI18n from "../../../../utils/messageI18n";
import front_end from "../../lib/settings/front_end.json";
import {actions as gcodeSendActions} from "../../../../reducers/gcodeSend";
import Line from '../../../../components/Line/Index.jsx'

import {connect} from 'react-redux';
import NumberInput from "../../../../components/NumberInput/Index.jsx";
import {ConfigSection, ConfigText} from "../../../../components/Config";
import {withTranslation} from 'react-i18next'
import styles from './style.css'
import _ from 'lodash'

class Index extends React.Component {
    state = {
        laserPower: front_end_control.front_end.options.laser.power.default_value,
        currentFrontEnd: front_end_control.front_end.default_value,
        currentFrontEndState: front_end_control.front_end.options[front_end_control.front_end.default_value].default_value,
        currentMovementMode: 'fast_mode',

        currrentAccessory: 'sliding_rail',

        isSlidingRadilInit: false,
        
        slidingRailStepLength: accessories.sliding_rail.feat_list[1].menus[1].default_value,

        conveyorBeltStepLength: accessories.conveyor_belt.feat_list[0].menus[2].default_value,

        currentSpeed: movement.speed.default_value,

        currentRotary: front_end_control.front_end.options.rotary_air_pick.default_rotary,

        prevRotateGcodePrefix: '',

        prevSlidingGcode: { prefix: '', suffix: '' },

        rotationAngel: {
            rotary_air_pick: {
                rotary_0: 15,
                rotary_1: 15,
                rotary_2: 15
            },
            rotary_soft_gripper: {
                rotary_0: 15,
                rotary_1: 15,
                rotary_2: 15
            }
        }
    };
    actions = {
        onSelectFrontEnd: (frontEnd) => {
            const currentFrontEnd = front_end_control.front_end.options[frontEnd];

            const currentFrontEndState = currentFrontEnd.state[currentFrontEnd.default_value];

            const gcodeArr = [currentFrontEnd.gcode, currentFrontEndState.gcode];

            this.props.startTask(gcodeArr.join('\n'), false);

            this.setState({
                laserPower: front_end_control.front_end.options.laser.power.default_value,
                currentFrontEnd: frontEnd,
                currentFrontEndState: currentFrontEnd.default_value
            });
        },

        onSelectMovementMode: (movementMode) => {
            this.props.startTask(movement.mode[movementMode].gcode, false);
            this.setState({currentMovementMode: movementMode});
        },

        onSetFrontEndState: (event) => {
            const frontEndState = event.target.value;
            const currentFrontEndState = front_end_control.front_end.options[this.state.currentFrontEnd].state[frontEndState];
            this.props.startTask(currentFrontEndState.gcode, false);
            this.setState({
                currentFrontEndState: frontEndState
            });
        },

        onSetRotary: (event) => {
            this.setState({
                currentRotary: event.target.value
            })
        },

        setLaserPower: (power) => {
            this.props.startTask(`M3 S${Math.round(power * 2.55)}`, false);
            this.setState({
                laserPower: power,
                currentFrontEndState: 'state_1'//switch to  laser on
            });
        },

        onSpeedSlide: (speed) => {
            this.setState({currentSpeed: speed});
        },
        setSpeed: (speed) => {
            this.props.startTask(`G0 F${speed}`, false);
            this.setState({
                currentSpeed: speed,
            });
        },

        onRotaryButtonClick: (gcodePrefix) => {
            const gcode = `${gcodePrefix}${this.state.rotationAngel[this.state.currentFrontEnd][this.state.currentRotary]}`
            this.props.startTask(gcode, false);
            this.setState({
                prevRotateGcodePrefix: gcodePrefix
            })
        },

        setRotate: (rotate) => {
            const _rotationAngle = _.cloneDeep(this.state.rotationAngel)
            _rotationAngle[this.state.currentFrontEnd][this.state.currentRotary] = rotate
            this.setState({
                rotationAngel: _rotationAngle
            }, () => {
                if (!this.state.prevRotateGcodePrefix) return
                const gcode = `${this.state.prevRotateGcodePrefix}${rotate}`
                this.props.startTask(gcode, false);
            })
        },

        onSelectAccessory: (accessory) => {
            this.setState({
                currrentAccessory: accessory,
                isSlidingRadilInit: false
            });
            
            
            const feat_list = accessories[accessory].feat_list
            const all_meuns = feat_list.map((item) => item.menus)
            const input_menu = all_meuns.find((item) => item.title === 'step_length')
            if (!input_menu) return

            if (accessory === 'sliding_rail') {
                this.setState({ slidingRailStepLength: input_menu.default_value })
            } else {
                this.setState({ conveyorBeltStepLength: input_menu.default_value })
            }
        },

        onSlidingRailClick: (menu) => {
            if (menu.title === 'power') {
                this.props.startTask(menu.gcode, false);
                this.setState({
                    prevSlidingGcode: { prefix: '', suffix: '' },
                    isSlidingRadilInit: true
                }, () => {
                    messageI18n.success("Sliding rail initialized")
                })
            } else {
                if (!this.state.isSlidingRadilInit) {
                    messageI18n.warn("Click the Initialize button first")
                    return
                }

                const gcode = `${menu.gcode_prefix}${this.state.slidingRailStepLength}${menu.gcode_suffix}${this.state.currentSpeed}`
                this.props.startTask(`G91\n${gcode}\nG90\nM114`, false);
                this.setState({
                    prevSlidingGcode: { prefix: menu.gcode_prefix, suffix: menu.gcode_suffix }
                })
            }
        },

        onConveyorBeltClick: (menu) => {
            if (menu.title === 'stop') {
                this.props.startTask(menu.gcode, false);
                this.setState({
                    prevSlidingGcode: { prefix: '', suffix: '' }
                })
            } else {
                const gcode = `${menu.gcode_prefix}${this.state.conveyorBeltStepLength}${menu.gcode_suffix}`
                this.props.startTask(gcode, false);
                this.setState({
                    prevSlidingGcode: { prefix: menu.gcode_prefix, suffix: menu.gcode_suffix }
                })
            }
        },

        setAccessorySlidingRailStep: (stepLength) => {
            this.setState({ slidingRailStepLength: stepLength }, () => {
                const { prefix, suffix } = this.state.prevSlidingGcode
                if (!prefix || !suffix) return
                const gcode = `${prefix}${this.state.slidingRailStepLength}${suffix}`
                this.props.startTask(`G91\n${gcode}\nG90\nM114`, false);
            })
        },

        setAccessoryConveyorBeltStep: (stepLength) => {
            this.setState({ conveyorBeltStepLength: stepLength }, () => {
                const { prefix, suffix } = this.state.prevSlidingGcode
                if (!prefix || !suffix) return
                const gcode = `${prefix}${this.state.conveyorBeltStepLength}${suffix}`
                this.props.startTask(gcode, false);
            })
        }
    };

    render() {
        const {t} = this.props;
        const { isSlidingRadilInit } = this.state
        const movementModeOptions = [];
        Object.keys(movement.mode).forEach((key) => {
            movementModeOptions.push({
                value: key,
                label: t(movement.mode[key].label),
                description: t(movement.mode[key].description)
            })
        });

        const frontEndOptionsObj = front_end_control.front_end.options;

        const frontEndOptions = [];
        Object.keys(front_end_control.front_end.options).forEach((key) => {
            frontEndOptions.push({value: key, label: t(frontEndOptionsObj[key].label)})
        });

        const frontEndStateOptions = [];
        
        const frontEndState = frontEndOptionsObj[this.state.currentFrontEnd].state;

        Object.keys(frontEndState).forEach((key) => {
            frontEndStateOptions.push(
                <Radio.Button 
                    value={key} 
                    key={key}>
                    {t(frontEndState[key].label)}
                </Radio.Button>);
        });

        const frontEndRotary = frontEndOptionsObj[this.state.currentFrontEnd].rotary;

        const rotaryOptions = []
        frontEndRotary && Object.keys(frontEndRotary).forEach((key) => {
            rotaryOptions.push(
                <Radio.Button 
                    value={key} 
                    key={key}>
                    {t(frontEndRotary[key].label)}
                </Radio.Button>
            );
        })

        const frontEndAngle = frontEndOptionsObj[this.state.currentFrontEnd].angle || null;
        
        const frontEndButtons = frontEndOptionsObj[this.state.currentFrontEnd].buttons
            ? frontEndOptionsObj[this.state.currentFrontEnd].buttons
                .filter((item) => item.type === this.state.currentRotary)
            : []

        const frontEndExtras = []

        frontEndButtons && frontEndButtons.forEach((item) => {
            frontEndExtras.push(
                <Radio.Button 
                    value={item.label} 
                    key={item.order}
                    className={styles[`btn_${item.label}`]}
                    onClick={() => this.actions.onRotaryButtonClick(item.gcode)}>
                    {/* {item.label} */}
                </Radio.Button>
            )
        })

        frontEndAngle && frontEndExtras.splice(
            frontEndExtras.length === 2 ? 1 : 0, 
            0,
            <NumberInput
                key={frontEndAngle.order}
                min={frontEndAngle.minimum_value}
                max={frontEndAngle.maximum_value}
                value={this.state.rotationAngel[this.state.currentFrontEnd][this.state.currentRotary]}
                onAfterChange={this.actions.setRotate}
            />
        )

        const accessoryOptions = Object.keys(accessories).map((key) => ({
            value: key,
            label:  t(accessories[key].label)
        }))

        let accessorySlidingRail = []
        accessories['sliding_rail'].feat_list.forEach((item) => {
            accessorySlidingRail.push(
                <Row key={item.title}>
                    <Col span={10}>
                        <ConfigText text={`${t(item.title)}${item.title_suffix || ''}`}/>
                    </Col>
                    <Col span={14} align={"right"}>
                        <div className={'ant-radio-group-small'}>
                            <Space>
                                {item.menus.map((menu) => {
                                return menu.type === 'button' ? <Radio.Button 
                                    value={menu.gcode} 
                                    key={menu.title}
                                    className={styles[`btn_${menu.title}${isSlidingRadilInit ? '' : '_disable'}`]}
                                    onClick={() => this.actions.onSlidingRailClick(menu)}>
                                </Radio.Button> : <NumberInput
                                    key={menu.title}
                                    min={menu.minimum_value}
                                    max={menu.maximum_value}
                                    disabled={!isSlidingRadilInit}
                                    value={this.state.slidingRailStepLength}
                                    style={{width: '90px'}}
                                    onAfterChange={this.actions[menu.callback]}
                                />}
                                )}
                            </Space>
                        </div>
                    </Col>
                </Row>
            )
        })

        let accessoryConveyorBelt = []
        accessories['conveyor_belt'].feat_list.forEach((item) => {
            accessoryConveyorBelt.push(
                <Row key={item.title}>
                    <Col span={8}>
                        <ConfigText text={`${t(item.title)}${item.title_suffix || ''}`}/>
                    </Col>
                    <Col span={16} align={"right"}>
                        <div className={'ant-radio-group-small'}>
                            <Space>
                                {item.menus.map((menu) => {
                                return menu.type === 'button' ? <Radio.Button 
                                    value={menu.gcode} 
                                    key={menu.title}
                                    className={styles[`btn_${menu.title}`]}
                                    onClick={() => this.actions.onConveyorBeltClick(menu)}>
                                </Radio.Button> : <NumberInput
                                    key={menu.title}
                                    min={menu.minimum_value}
                                    max={menu.maximum_value}
                                    value={this.state.conveyorBeltStepLength}
                                    style={{width: '70px'}}
                                    onAfterChange={this.actions[menu.callback]}
                                />}
                                )}
                            </Space>
                        </div>
                    </Col>
                </Row>
            )
        })

        return (
            <div>
                <DeviceControl gcode={this.props.gcode}/>
                <Line/>
                <ConfigSection title={t("Motion Mode")}>
                    <Select
                        style={{width: "100%", textAlign: "center"}}
                        onChange={this.actions.onSelectMovementMode}
                        value={this.state.currentMovementMode}
                        options={movementModeOptions}
                        optionRender={(option) => (
                            <Tooltip title={option.data.description} placement="right" mouseEnterDelay={0.2}>
                                <span>{option.label}</span>
                            </Tooltip>
                        )}
                    />
                    <Tooltip title={`${t(movement.speed.description)} (${movement.speed.unit})`}
                             placement="right" mouseEnterDelay={0.25}>
                        <div className={styles.field_label}>{t(movement.speed.label)}</div>
                    </Tooltip>
                    <Row gutter={8} align="middle">
                        <Col flex="auto">
                            <Slider
                                min={movement.speed.minimum_value}
                                max={movement.speed.maximum_value}
                                step={movement.speed.step}
                                value={this.state.currentSpeed}
                                onChange={this.actions.onSpeedSlide}
                                onChangeComplete={this.actions.setSpeed}
                            />
                        </Col>
                        <Col>
                            <NumberInput
                                min={movement.speed.minimum_value}
                                max={movement.speed.maximum_value}
                                step={movement.speed.step}
                                value={this.state.currentSpeed}
                                onAfterChange={this.actions.setSpeed}
                                style={{width: "80px"}}
                            />
                        </Col>
                    </Row>
                </ConfigSection>
                <ConfigSection title={t("Front End")}>
                    <Select
                        style={{width: "100%", textAlign: "center"}}
                        onChange={this.actions.onSelectFrontEnd}
                        placeholder={t("select front end")}
                        value={this.state.currentFrontEnd}
                        options={frontEndOptions}
                    />
                    <div className={styles.field_label}>{t("Actions")}</div>
                    <Radio.Group
                        className={styles.group_full}
                        buttonStyle="solid"
                        optionType="button"
                        value={this.state.currentFrontEndState}
                        onChange={this.actions.onSetFrontEndState}>
                        {frontEndStateOptions}
                    </Radio.Group>
                    {this.state.currentFrontEnd.toLowerCase().startsWith('rotary') &&
                    <React.Fragment>
                        <div className={styles.field_label}>{t("Rotary")}</div>
                        <Radio.Group
                            className={styles.group_full}
                            buttonStyle="solid"
                            optionType="button"
                            value={this.state.currentRotary}
                            onChange={this.actions.onSetRotary}>
                            {rotaryOptions}
                        </Radio.Group>
                        <div className={styles.field_label}>{t("Rotate")}</div>
                        <div
                            className={styles.rotate_row}
                            style={{gridTemplateColumns: `repeat(${frontEndExtras.length}, 1fr)`}}>
                            {frontEndExtras}
                        </div>
                    </React.Fragment>}
                </ConfigSection>
                {/* Accessories */}
                <ConfigSection title={t("Accessories")}>
                    <Space orientation={"vertical"} style={{width: "100%"}}>
                        <Select
                            style={{width: "100%", textAlign: "center"}}
                            onChange={this.actions.onSelectAccessory}
                            value={this.state.currrentAccessory}
                            options={accessoryOptions}
                        />
                        {this.state.currrentAccessory === 'sliding_rail' &&
                        accessorySlidingRail
                        }
                        {this.state.currrentAccessory === 'conveyor_belt' &&
                        accessoryConveyorBelt
                        }
                    </Space>
                </ConfigSection>
            </div>
        )
    }
}

const mapStateToProps = (state) => ({
    gcode: state.writeAndDraw.gcode
});

const mapDispatchToProps = (dispatch) => {
    return {
        startTask: (gcode, isAckChange) => dispatch(gcodeSendActions.startTask(gcode, isAckChange)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(Index));

