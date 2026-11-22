import React, {PureComponent} from 'react';
import Tooltip from '../Tooltip/Index.jsx';
import noop from 'lodash/noop';
import {Space, Popconfirm} from 'antd';
import styles from './styles.css';
import {getUuid} from "../../utils";

const tooltipId = getUuid();

class Index extends PureComponent {
    // True while the Clear confirmation is open. The button's own tooltip is anchored to the same corner and
    // painted over the confirmation, hiding its text and part of OK, so it is detached while it is on screen.
    state = {
        confirming: false
    };

    render() {
        let {operations = {}, enabledInfo, visibleInfo, tipInfo, clearPopConfirmInfo} = this.props;
        const {exportModels = noop, undo = noop, redo = noop, layFlat = noop, duplicate = noop, del = noop, clear = noop, toggleTravel = noop} = operations;
        if (!enabledInfo) {
            enabledInfo = {
                exportModels: true,
                undo: true,
                redo: true,
                layFlat: true,
                duplicate: true,
                del: true,
                clear: true,
                toggleTravel: true
            };
        }
        if (!visibleInfo) {
            visibleInfo = {
                exportModels: true,
                undo: true,
                redo: true,
                layFlat: true,
                duplicate: true,
                del: true,
                clear: true,
                toggleTravel: true
            };
        }
        if (!tipInfo) {
            tipInfo = {
                exportModels: "Export models",
                undo: "Undo",
                redo: "Redo",
                layFlat: "Lay flat",
                duplicate: "Duplicate",
                del: "Delete",
                clear: "Clear",
                toggleTravel: "Hide travel moves"
            };
        }
        if (!clearPopConfirmInfo) {
            clearPopConfirmInfo = {
                cancelText: "NO",
                okText: "OK",
                // "Are you sure?" over an empty-looking button is what reads as "nothing happened". Say what
                // the button removes, and how much of it.
                title: "Clear all drawings?",
                description: "Everything on the canvas will be removed."
            };
        }
        return (
            <div className={styles.div_root}>
                <Tooltip
                    id={tooltipId}
                    place="left"
                />
                <Space orientation={"vertical"} size={0}>
                    {visibleInfo.del &&
                    <button
                        data-tooltip-id={tooltipId}
                        data-tooltip-content={tipInfo.del}
                        disabled={!enabledInfo.del}
                        onClick={del}
                        className={styles.btn_delete}
                    />
                    }
                    {visibleInfo.clear &&
                    // The confirmation hangs off the button itself. It used to be a sibling with no anchor, so
                    // it was positioned against the surrounding box and appeared at the top-left of the canvas,
                    // a long way from the button and easy to read as "clicking Clear did nothing". As the
                    // trigger it also closes on a click anywhere else, which the controlled version did not.
                    <Popconfirm
                        placement="left"
                        title={clearPopConfirmInfo.title}
                        description={clearPopConfirmInfo.description}
                        okText={clearPopConfirmInfo.okText}
                        cancelText={clearPopConfirmInfo.cancelText}
                        onConfirm={() => clear()}
                        onOpenChange={(open) => this.setState({confirming: open})}
                    >
                        <button
                            className={styles.btn_clear}
                            disabled={!enabledInfo.clear}
                            {...(this.state.confirming ? {} : {
                                'data-tooltip-id': tooltipId,
                                'data-tooltip-content': tipInfo.clear,
                            })}
                        />
                    </Popconfirm>
                    }
                    {visibleInfo.toggleTravel &&
                    <button
                        data-tooltip-id={tooltipId}
                        data-tooltip-content={tipInfo.toggleTravel}
                        disabled={!enabledInfo.toggleTravel}
                        onClick={toggleTravel}
                        aria-pressed={!!this.props.showTravel}
                        aria-label={tipInfo.toggleTravel}
                        className={`${styles.btn_travel} ${this.props.showTravel ? '' : styles.btn_travel_off}`}
                    />
                    }
                    {visibleInfo.duplicate &&
                    <button
                        data-tooltip-id={tooltipId}
                        data-tooltip-content={tipInfo.duplicate}
                        disabled={!enabledInfo.duplicate}
                        onClick={duplicate}
                        className={styles.btn_duplicate}
                    />
                    }
                    {visibleInfo.exportModels &&
                    <button
                        data-tooltip-id={tooltipId}
                        data-tooltip-content={tipInfo.exportModels}
                        disabled={!enabledInfo.exportModels}
                        onClick={exportModels}
                        className={styles.btn_export}
                    />
                    }
                    {visibleInfo.layFlat &&
                    <button
                        data-tooltip-id={tooltipId}
                        data-tooltip-content={tipInfo.layFlat}
                        disabled={!enabledInfo.layFlat}
                        onClick={layFlat}
                        className={styles.btn_lay_flat}
                    />
                    }
                    {visibleInfo.undo &&
                    <button
                        data-tooltip-id={tooltipId}
                        data-tooltip-content={tipInfo.undo}
                        onClick={undo}
                        className={styles.btn_undo}
                    />
                    }
                    {visibleInfo.redo &&
                    <button
                        data-tooltip-id={tooltipId}
                        data-tooltip-content={tipInfo.redo}
                        onClick={redo}
                        className={styles.btn_redo}
                    />
                    }
                    {this.props.children}
                </Space>
            </div>
        );
    }
}

export default Index;
