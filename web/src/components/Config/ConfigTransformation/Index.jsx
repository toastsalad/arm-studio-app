import React, {PureComponent} from 'react';
import styles from './styles.css';
import Tooltip from '../../../containers/Tooltip/Index.jsx';
import {ConfigNumber, ConfigRow, ConfigSection, ConfigSelect} from '../index.js';
import {getUuid} from '../../../utils';

const tooltipId = getUuid();

// Shared by the laser and write & draw panels. previewOnMove says whether an X/Y edit should
// trigger a preview (the write & draw plotter needs one to re-emit its toolpath).
class ConfigTransformation extends PureComponent {
    render() {
        const {t, model, transformation, isLockScale, previewOnMove} = this.props;
        if (!model || !transformation) {
            return null;
        }
        const update = this.props.updateTransformation;
        const {width, height, rotation, x, y, flip_model} = transformation.children;

        const flipModelOptions = [];
        Object.keys(flip_model.options).forEach((key) => {
            flipModelOptions.push({label: t(key), value: flip_model.options[key]})
        });

        // slider={false} on width/height: their max is Number.MAX_SAFE_INTEGER, which no slider
        // can span, so those two keep a plain box.
        const numberRow = (setting, tooltip, max, onChange, slider = true) => (
            <ConfigRow
                label={t(setting.label)} unit={setting.unit}
                tooltip={t(tooltip)}
                tooltipId={tooltipId}>
                <ConfigNumber
                    min={setting.minimum_value}
                    max={max}
                    value={setting.default_value}
                    slider={slider}
                    onChange={onChange}/>
            </ConfigRow>
        );

        return (
            <div>
                <Tooltip
                    id={tooltipId}
                    place="left"
                />
                <ConfigSection title={t(transformation.label)}>
                    {/* A <button> rather than an <input>: the artwork is drawn on ::before, which
                        an input does not render. */}
                    <button
                        type="button"
                        className={isLockScale ? styles.btn_lock : styles.btn_unlock}
                        onClick={this.props.toggleIsLockScale}
                    />
                    {numberRow(width, 'Width of the picture.', Number.MAX_SAFE_INTEGER, (value) => update("width", value, true), false)}
                    {numberRow(height, 'Height of the picture.', Number.MAX_SAFE_INTEGER, (value) => update("height", value, true), false)}
                    {numberRow(rotation, 'Rotate of the picture.', rotation.maximum_value, (value) => update("rotation", value, true))}
                    {numberRow(x, 'X offset of the picture.', x.maximum_value, (value) => update("x", value, previewOnMove))}
                    {numberRow(y, 'Y offset of the picture.', y.maximum_value, (value) => update("y", value, previewOnMove))}
                    <ConfigRow
                        label={t(flip_model.label)}
                        tooltip={t('Flip the selected picture vertically, horizontally or in both directions.')}
                        tooltipId={tooltipId}>
                        <ConfigSelect options={flipModelOptions} value={flip_model.default_value}
                                      onChange={(value) => update("flip_model", value, true)}/>
                    </ConfigRow>
                </ConfigSection>
            </div>
        );
    }
}

export default ConfigTransformation;
