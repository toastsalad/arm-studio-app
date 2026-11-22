/* global require */
// `require` with a template literal is how webpack is told to bundle a directory
// of images; it never reaches a runtime without webpack behind it.
import React from 'react';
import {Checkbox} from 'antd';
import ConfigRow from '../ConfigRow/Index.jsx';
import ConfigNumber from '../ConfigNumber/Index.jsx';
import ConfigText from '../ConfigText/Index.jsx';
import {fillDescription} from './fillDescriptions.js';

// The options a plotted drawing carries: travel optimisation, the hatch fill and its pattern, and
// the multi-pen ordering.
//
// Every 2D panel that plots a drawing offers these - the SVG, trace and text panels on both the
// pen and laser tabs - so they live here rather than being copied into each. What actually
// appears is decided by the settings the model carries, and those differ: a laser SVG has only a
// fill density, so the rest simply do not render.
//
// `set` takes a dotted key, matching the shape the reducers expect.

export const fillStyleImage = (key) => require(`./images/fill_${key}.svg`);

// The styles that lay lines down at an angle. Concentric, spiral, fermat, hilbert and peano carry
// their own direction, so the angle control would do nothing for them.
const ANGLED_STYLES = new Set(["parallel", "wave", "serpentine", "moire", "engrave"]);

const ConfigSvgOptions = ({t, config, updateConfig}) => {
    const set = (key, value) => updateConfig(key, value);

    const row = (setting, control) => (
        <ConfigRow key={setting.label} label={t(setting.label)} unit={setting.unit}
                   tooltip={t(setting.description || setting.label)}>
            {control}
        </ConfigRow>
    );

    const bool = (setting, key) => row(setting,
        <Checkbox checked={!!setting.default_value} onChange={(e) => set(key, e.target.checked)}/>);

    const num = (setting, key, precision = 0) => row(setting,
        <ConfigNumber min={setting.minimum_value} max={setting.maximum_value}
                      value={setting.default_value} precision={precision}
                      onChange={(value) => set(key, value)}/>);

    // The pattern picker: one button per style, drawn as a star filled with it. The settings group the
    // styles because there are eighteen of them now and they are not one family: shape fills read the
    // outline, the curves are space-filling patterns, and the shading fills want an image. A flat row
    // would hide that, and hide that the last group behaves differently on a vector shape.
    //
    // The tooltip says what the pattern is, not what it is called: the labels are single words, and a swatch
    // of a star is not enough to tell a Fermat spiral from an Archimedean one.
    const swatch = (setting, key) => (
        <button
            key={key}
            type="button"
            title={t(fillDescription(key, setting.options))}
            aria-label={t(setting.options[key])}
            onClick={() => set('fill.fill_style', key)}
            style={{
                width: "68px",
                height: "80px",
                padding: "2px",
                cursor: "pointer",
                outline: "none",
                border: setting.default_value === key ? "2px solid var(--app-accent)" : "1px solid var(--app-border)",
                borderRadius: "6px",
                backgroundColor: "var(--app-surface-bg)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
            }}>
            <img src={fillStyleImage(key)} style={{width: "50px", height: "50px", filter: "var(--app-swatch-filter)"}}/>
            <span style={{fontSize: "11px", color: "var(--app-text-secondary)", marginTop: "2px"}}>{t(setting.options[key])}</span>
        </button>
    );

    const styles = (setting) => {
        const keys = setting.options ? Object.keys(setting.options) : [];
        const groups = setting.groups && setting.groups.length ? setting.groups : [{styles: keys}];

        return (
            <div key={setting.label} style={{padding: "4px 0 8px 0"}}>
                <ConfigText text={t(setting.label)}/>
                {groups.map((group, index) => (
                    <div key={group.label || index} style={{marginTop: "6px"}}>
                        {group.label && (
                            <div style={{display: "flex", alignItems: "baseline", gap: "6px"}}>
                                <span style={{fontSize: "11px", color: "var(--app-text-secondary)"}}>{t(group.label)}</span>
                                {group.hint && (
                                    <span style={{fontSize: "10px", color: "var(--app-text-tertiary)", fontStyle: "italic"}}>
                                        {t(group.hint)}
                                    </span>
                                )}
                            </div>
                        )}
                        <div style={{display: "flex", gap: "4px", marginTop: "4px", flexWrap: "wrap"}}>
                            {group.styles.filter((key) => setting.options && setting.options[key]).map((key) => swatch(setting, key))}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const {optimize_path, connect_outlines, preserve_direction, fill, group_by_color, pause_between_colors} = config.children;
    const fillOptions = fill && fill.children ? fill.children : {};
    const fillOn = !!(fill && fill.default_value);

    // Only the styles that take them show an angle or cross-hatch; the rest take spacing alone.
    const style = fillOptions.fill_style ? fillOptions.fill_style.default_value : "parallel";
    const isParallel = style === "parallel";
    const isWave = style === "wave";
    const showAngle = ANGLED_STYLES.has(style);

    return (
        <React.Fragment>
            {optimize_path && bool(optimize_path, 'optimize_path')}
            {optimize_path && optimize_path.default_value && connect_outlines && bool(connect_outlines, 'connect_outlines')}
            {optimize_path && optimize_path.default_value && preserve_direction && bool(preserve_direction, 'preserve_direction')}
            {fill && bool(fill, 'fill')}
            {fillOn && <React.Fragment>
                {fillOptions.fill_style && styles(fillOptions.fill_style)}
                {fillOptions.fill_density && num(fillOptions.fill_density, 'fill.fill_density')}
                {showAngle && fillOptions.hatch_angle && num(fillOptions.hatch_angle, 'fill.hatch_angle')}
                {showAngle && fillOptions.cross_hatch && bool(fillOptions.cross_hatch, 'fill.cross_hatch')}
                {fillOptions.inset && bool(fillOptions.inset, 'fill.inset')}
                {fillOptions.inset && fillOptions.inset.default_value && fillOptions.inset_dist && num(fillOptions.inset_dist, 'fill.inset_dist', 2)}
                {isParallel && fillOptions.connect_ends && bool(fillOptions.connect_ends, 'fill.connect_ends')}
                {isParallel && fillOptions.connect_ends && fillOptions.connect_ends.default_value && fillOptions.hatch_scope && num(fillOptions.hatch_scope, 'fill.hatch_scope')}
                {isWave && fillOptions.wave_amplitude && num(fillOptions.wave_amplitude, 'fill.wave_amplitude', 2)}
                {isWave && fillOptions.wave_wavelength && num(fillOptions.wave_wavelength, 'fill.wave_wavelength', 2)}
                {fillOptions.jitter && bool(fillOptions.jitter, 'fill.jitter')}
                {fillOptions.jitter && fillOptions.jitter.default_value && fillOptions.jitter_amount && num(fillOptions.jitter_amount, 'fill.jitter_amount', 2)}
            </React.Fragment>}
            {group_by_color && bool(group_by_color, 'group_by_color')}
            {group_by_color && group_by_color.default_value && pause_between_colors && bool(pause_between_colors, 'pause_between_colors')}
        </React.Fragment>
    );
};

export default ConfigSvgOptions;
