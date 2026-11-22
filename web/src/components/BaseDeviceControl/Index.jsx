import React from 'react';
import _ from 'lodash';
import styles from './styles.css';
import {Radio, Row, Col, Modal, Form, Input, Menu, Dropdown, Tooltip, Button} from 'antd';
import PositionMonitor from '../PositionMoniter/index.jsx'
import Level from '../Level/Index.jsx'
import Calibration from '../Calibration/Index.jsx'
import {ConfigTitle} from "../Config";
import {withTranslation} from 'react-i18next';
import {antdApis} from '../../utils/antdStatic';
import messageI18n from '../../utils/messageI18n';

const CUSTOM_BUTTON_KEY = 'CUSTOM_BUTTON'
class Index extends React.Component {
    state = {
        showLevel: false,
        pointIndex: undefined,
        accuracy: 0.1,


        formRef: React.createRef(),
        
        modalVisible: false,

        customButtonName: '',

        customButtonCommand: '',

        customButtons: [],

        currentCustomButtonIndex: -1
    };

    actions = {
        openCustomButtonModal: () => {
            const { currentCustomButtonIndex } = this.state
            const existButton = currentCustomButtonIndex === -1 
                ? null 
                : this.state.customButtons[currentCustomButtonIndex]

            this.setState({
                customButtonName: existButton ? existButton.name : '',
                customButtonCommand: existButton ? existButton.command : ''
            }, () => {
                this.setState({
                    modalVisible: true 
                })
            })
        },

        closeCustomButtonModal: () => {
            this.setState({
                modalVisible: false,
                customButtonName: '',
                customButtonCommand: ''
            })

            this.state.formRef.current.resetFields()
        },

        saveCustomButton: () => {
            if (!this.state.customButtonName) {
                messageI18n.warn(this.props.t("Input custom button name"))
                return
            }

            if (!this.state.customButtonCommand) {
                messageI18n.warn(this.props.t("Input command"))
                return
            }

            const rowCount = this.state.customButtonCommand.split('\n').length
            if (rowCount > 100) {
                messageI18n.warn('Please enter commands less than 100 lines')
                return
            }

            if (this.state.currentCustomButtonIndex === -1) {
                const isExist = this.state.customButtons
                    .some((item) => item.name === this.state.customButtonName)
                
                if (isExist) {
                    messageI18n.warning(`${this.state.customButtonName} is already in use`)
                } else {
                    this.setState({
                        currentCustomButtonIndex: -1,
                        modalVisible: false,
                        customButtons: [
                            ...this.state.customButtons,
                            {
                                name: this.state.customButtonName,
                                command: this.state.customButtonCommand
                            }
                        ]
                    }, () => {
                        messageI18n.success(this.props.t("Create success"))
                        localStorage.setItem(CUSTOM_BUTTON_KEY, JSON.stringify(this.state.customButtons))
                    })
                }
                
            } else {
                const newCustomButtons = _.cloneDeep(this.state.customButtons)
                newCustomButtons[this.state.currentCustomButtonIndex].name = this.state.customButtonName
                newCustomButtons[this.state.currentCustomButtonIndex].command = this.state.customButtonCommand
                this.setState({
                    currentCustomButtonIndex: -1,
                    modalVisible: false,
                    customButtons: newCustomButtons
                }, () => {
                    localStorage.setItem(CUSTOM_BUTTON_KEY, JSON.stringify(this.state.customButtons))
                })
            }
        },

        onCustomButtonNameChange: (e) => {
            this.setState({
                customButtonName: e.target.value
            })
        },

        onCustomButtonCommandChange: (e) => {
            this.setState({
                customButtonCommand: e.target.value
            })
        },

        onCustomButtonClick: (command) => {
            this.props.startTask(command, false)
        },

        deleteCustomButton: async (index) => {
            const confirm = () => new Promise((resolve) => {
                // The themed instance when the app has mounted, the static one otherwise.
                (antdApis().modal || Modal).confirm({
                    title: this.props.t("Are you sure to delete?"),
                    onOk () {
                      resolve(true)  
                    },
                    onCancel () {
                        resolve(false)
                    }
                })
            })

            const confirmRes = await confirm()
            if (!confirmRes) return

            const newCustomButtons = _.cloneDeep(this.state.customButtons)
            if (index >= 0) {
                newCustomButtons.splice(index, 1)
            }
            this.setState({
                customButtons: newCustomButtons
            })

            localStorage.setItem(CUSTOM_BUTTON_KEY, JSON.stringify(newCustomButtons))
        }
    };

    componentDidMount () {
        let result = null
        const customCommandStr = localStorage.getItem(CUSTOM_BUTTON_KEY)
        try {
            result = JSON.parse(customCommandStr)
        } catch (error) {
            console.log(error)
        }

        this.setState({
            customButtons: result || []
        })
    }

    render() {
        const {home, leftTop, leftBottom, rightTop, rightBottom, onCustomButtonRightClick} = this.props.actions;
        const {xPlus, xMinus, yPlus, yMinus, zPlus, zMinus, z0} = this.props.actions;
        const {setStep, setWorkOrigin, goToWorkOrigin} = this.props.actions;
        const {frontEnd} = this.props;
        const {step} = this.props;
        const {showLevel} = this.props;
        const {t} = this.props;
        const gutter = 8;

        const {
            formRef,
            modalVisible, 
            customButtonCommand, 
            customButtonName,
            customButtons
        } = this.state

        const getMenus = (index) => {
            return <Menu>
                <Menu.Item onClick={() => {
                    this.setState({
                        currentCustomButtonIndex: index
                    }, () => {
                        this.actions.openCustomButtonModal()
                    })
                }}>{t('Edit')}</Menu.Item>
                <Menu.Item onClick={() => {
                    this.actions.deleteCustomButton(index)
                }}>{t('Delete')}</Menu.Item>
            </Menu>
        }

        const customButtonDoms = customButtons.map((item, index) => (
            <Col span={6} key={item.name}>
                <Dropdown overlay={getMenus(index)} trigger={['contextMenu']}>
                    <input
                        type="button"
                        onClick={() => this.actions.onCustomButtonClick(item.command)}
                        className={styles.btn_xyz}
                        value={item.name}
                        alt={['custom', index]}
                    />
                </Dropdown>
            </Col>
        ))

        const {
            openCustomButtonModal, 
            closeCustomButtonModal,
            saveCustomButton,
            onCustomButtonNameChange,
            onCustomButtonCommandChange,
            onCustomButtonClick
        } = this.actions

        return (
            <div style={{padding: "8px"}}>
                <PositionMonitor/>

                <div className={styles.section}>
                    <ConfigTitle text={t("Jog")}/>
                    <Row gutter={[gutter, gutter]}>
                        <Col span={6}>
                            <button onClick={leftTop} className={styles.btn_left_top}/>
                        </Col>
                        <Col span={6}>
                            <input type="button" onClick={yPlus} className={styles.btn_xyz} value="Y+"/>
                        </Col>
                        <Col span={6}>
                            <button onClick={rightTop} className={styles.btn_right_top}/>
                        </Col>
                        <Col span={6}>
                            <input type="button" onClick={zPlus} className={styles.btn_xyz} value="Z+"/>
                        </Col>
                        <Col span={6}>
                            <input type="button" onClick={xMinus} className={styles.btn_xyz} value="X-"/>
                        </Col>
                        <Col span={6}>
                            <input type="button" onClick={home} className={styles.btn_xyz} value="Home"/>
                        </Col>
                        <Col span={6}>
                            <input type="button" onClick={xPlus} className={styles.btn_xyz} value="X+"/>
                        </Col>
                        <Col span={6}>
                            <input type="button" onClick={z0} className={styles.btn_xyz} value="Z0"/>
                        </Col>
                        <Col span={6}>
                            <button onClick={leftBottom} className={styles.btn_left_bottom}/>
                        </Col>
                        <Col span={6}>
                            <input type="button" onClick={yMinus} className={styles.btn_xyz} value="Y-"/>
                        </Col>
                        <Col span={6}>
                            <button onClick={rightBottom} className={styles.btn_right_bottom}/>
                        </Col>
                        <Col span={6}>
                            <input type="button" onClick={zMinus} className={styles.btn_xyz} value="Z-"/>
                        </Col>
                    </Row>
                    <div className={styles.sub_label}>{`${t("Step Length")}(mm)`}</div>
                    <Radio.Group
                        value={step}
                        buttonStyle="solid"
                        onChange={setStep}
                        style={{display: "flex", width: "100%"}}>
                        <Radio.Button value={20} className={styles.btn_step}>20</Radio.Button>
                        <Radio.Button value={10} className={styles.btn_step}>10</Radio.Button>
                        <Radio.Button value={5} className={styles.btn_step}>5</Radio.Button>
                        <Radio.Button value={1} className={styles.btn_step}>1</Radio.Button>
                        <Radio.Button value={0.2} className={styles.btn_step}>0.2</Radio.Button>
                        <Radio.Button value={0.1} className={styles.btn_step}>0.1</Radio.Button>
                    </Radio.Group>
                </div>

                <div className={styles.section}>
                    <ConfigTitle text={t("Work Height")}/>
                    <Row gutter={[gutter, gutter]}>
                        <Col span={12}>
                            <Tooltip placement="top" title={t("Move to the saved work height")}>
                                <input
                                    type="button"
                                    onClick={goToWorkOrigin}
                                    className={styles.btn_action_work}
                                    value={t("Go To Work Height")}
                                />
                            </Tooltip>
                        </Col>
                        <Col span={12}>
                            <Tooltip placement="top" title={t("Save the current height as the work height")}>
                                <input
                                    type="button"
                                    onClick={setWorkOrigin}
                                    className={styles.btn_action_work}
                                    value={t("Set Work Height")}
                                />
                            </Tooltip>
                        </Col>
                    </Row>
                </div>

                {showLevel &&
                <div className={styles.section}>
                    <Level showLevel={showLevel}/>
                </div>}

                {this.props.showRunBoundary &&
                <div className={styles.section}>
                    <Tooltip placement="top" title={t("Trace the edge of the work area without drawing")}>
                        <Button block onClick={this.props.runBoundary}>{t("Run Boundary")}</Button>
                    </Tooltip>
                </div>}

                <div className={styles.section}>
                    <Calibration/>
                </div>

                <div className={styles.section}>
                    <ConfigTitle text={t("Custom Buttons")}/>
                    {customButtons.length > 0 &&
                    <Row gutter={[gutter, gutter]} style={{marginBottom: "8px"}}>
                        {customButtonDoms}
                    </Row>}
                    <input
                        type="button"
                        onClick={() => {
                            this.setState({currentCustomButtonIndex: -1}, () => {
                                openCustomButtonModal()
                            })
                        }}
                        className={styles.btn_add_custom}
                        value={t("Add Custom Button")}
                    />
                </div>

                <div className={styles.section}>
                    <Tooltip placement="top" title={t("Cancel the current job")}>
                        <Button
                            danger
                            block
                            disabled={!this.props.gcode}
                            onClick={this.props.stopTask}>
                            {t("Cancel")}
                        </Button>
                    </Tooltip>
                </div>

                {modalVisible && <Modal 
                    title={t("Custom Button")}
                    cancelText={t("Cancel")}
                    okText={t("Save")}
                    open={modalVisible}
                    forceRender={true}
                    onOk={saveCustomButton}
                    onCancel={closeCustomButtonModal}>
                        <Form
                            ref={formRef}
                            labelCol={{ span: 6 }}>
                            <Form.Item
                                label={t("Name")}
                                name="name"
                                rules={[{ 
                                    required: true,
                                    message: t("Input custom button name")
                                }]}
                                initialValue={customButtonName}>
                                <Input
                                    placeholder={t("Input custom button name")}
                                    value={customButtonName}
                                    onChange={onCustomButtonNameChange}
                                />
                            </Form.Item>
                            <Form.Item
                                label={t("Command")}
                                name="command"
                                rules={[{ 
                                    required: true,
                                    message: t("Input command")
                                }]}
                                initialValue={customButtonCommand}>
                                <Input.TextArea
                                    placeholder={t("Input command")}
                                    autoSize={{ minRows: 10 }}
                                    value={customButtonCommand}
                                    onChange={onCustomButtonCommandChange}
                                />
                            </Form.Item>
                        </Form>
                </Modal>}
            </div>
        )
    }
}

export default withTranslation()(Index);

