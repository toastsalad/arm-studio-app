import React, {PureComponent} from 'react';
import {Button, Checkbox} from 'antd';
import messageI18n from '../../../../utils/messageI18n';
import {saveAs} from '../../../../utils/saveAs';
import {getTimestampName} from '../../../../utils/index.js';
import socketClientManager from '../../../../socket/socketClientManager';
import {TOOL_PATH_EXPORT_TRACED_SVG} from '../../../../constants.js';
import {actions as writeAndDrawActions} from '../../../../reducers/writeAndDraw';
import {connect} from 'react-redux';
import {ConfigNumber, ConfigRow, ConfigSection, ConfigText, fillStyleImage} from '../../../../components/Config';
import {fillDescription} from '../../../../components/Config/ConfigSvgOptions/fillDescriptions.js';
import {withTranslation} from 'react-i18next';

// Centerline tracing controls for raster input. Values are written into the model settings and
// forwarded to the local PlotterHelper engine by the server (see plotterHelperBridge.js).
// Only the four knobs that decide whether line art traces cleanly are surfaced here.
// The styles that lay lines down at an angle. Concentric, spiral, fermat, hilbert and peano carry
// their own direction, so the angle control would do nothing for them.
const ANGLED_STYLES = new Set(["parallel", "wave", "serpentine", "moire", "engrave"]);

class ConfigTrace extends PureComponent {
    actions = {
        setUpscale: (value) => this.props.updateConfig("trace.upscale", value),
        setWindow: (value) => this.props.updateConfig("trace.window", value),
        setThickWidth: (value) => this.props.updateConfig("trace.thick_width", value),
        setJoinGap: (value) => this.props.updateConfig("trace.join_gap", value),
        setFill: (e) => this.props.updateConfig("fill", e.target.checked),
        setFillDensity: (value) => this.props.updateConfig("fill.fill_density", value),
        // The same fill strategies as the SVG panel: the engine hatches the traced thick regions
        // with whatever style is chosen here.
        setFillStyle: (value) => this.props.updateConfig("fill.fill_style", value),
        setCrossHatch: (e) => this.props.updateConfig("fill.cross_hatch", e.target.checked),
        setHatchAngle: (value) => this.props.updateConfig("fill.hatch_angle", value),
        setInset: (e) => this.props.updateConfig("fill.inset", e.target.checked),
        setInsetDist: (value) => this.props.updateConfig("fill.inset_dist", value),
        setConnectEnds: (e) => this.props.updateConfig("fill.connect_ends", e.target.checked),
        setHatchScope: (value) => this.props.updateConfig("fill.hatch_scope", value),
        setWaveAmplitude: (value) => this.props.updateConfig("fill.wave_amplitude", value),
        setWaveWavelength: (value) => this.props.updateConfig("fill.wave_wavelength", value),
        setJitter: (e) => this.props.updateConfig("fill.jitter", e.target.checked),
        setJitterAmount: (value) => this.props.updateConfig("fill.jitter_amount", value),
        setOptimizePath: (e) => this.props.updateConfig("optimize_path", e.target.checked),
        exportTracedSvg: () => this.exportTracedSvg(),
    };

    /**
     * Ask the server for the SVG the tracer produced behind the current preview and save it, so a
     * trace can be cleaned up by hand in Inkscape.
     */
    exportTracedSvg() {
        const {model} = this.props;
        if (!model || !model.url) return;
        // No client-side "is it previewed" check: that flag is easy to get stuck false, and the
        // server knows whether it has a trace and says so precisely.
        socketClientManager.emitToServer(TOOL_PATH_EXPORT_TRACED_SVG, {url: model.url}, (response) => {
            const {svg, error} = response || {};
            if (error || !svg) {
                messageI18n.warning(error || 'No traced SVG available');
                return;
            }
            const blob = new Blob([svg], {type: 'image/svg+xml;charset=utf-8'});
            saveAs(blob, getTimestampName('.svg'));
            messageI18n.success('Traced SVG exported. Open it in Inkscape, then plot it as an SVG.');
        });
    }

    row = (o, control) => {
        const {t} = this.props;
        return (
            <ConfigRow key={o.label} label={t(o.label)} unit={o.unit} tooltip={t(o.description || o.label)}>
                {control}
            </ConfigRow>
        );
    };

    bool = (o, onChange) => this.row(o, <Checkbox checked={!!o.default_value} onChange={onChange}/>);

    num = (o, onChange, precision = 0) => this.row(o, (
        <ConfigNumber
            min={o.minimum_value}
            max={o.maximum_value}
            value={o.default_value}
            precision={precision}
            onChange={onChange}/>
    ));

    // Visual fill-style picker matching the one in ConfigSvg so the two panels read the same: one group
    // per family, because a flat row of eighteen swatches hides that the shading group behaves
    // differently on a vector shape.
    styles = (o, onChange) => {
        const {t} = this.props;
        const keys = o.options ? Object.keys(o.options) : [];
        const groups = o.groups && o.groups.length ? o.groups : [{styles: keys}];

        return (
            <div key={o.label} style={{padding: "4px 0 8px 0"}}>
                <ConfigText text={t(o.label)}/>
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
                            {group.styles.filter((key) => o.options && o.options[key]).map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    title={t(fillDescription(key, o.options))}
                                    aria-label={t(o.options[key])}
                                    onClick={() => onChange(key)}
                                    style={{
                                        width: "68px",
                                        height: "80px",
                                        padding: "2px",
                                        cursor: "pointer",
                                        outline: "none",
                                        border: o.default_value === key ? "2px solid var(--app-accent)" : "1px solid var(--app-border)",
                                        borderRadius: "6px",
                                        backgroundColor: "var(--app-surface-bg)",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}>
                                    <img src={fillStyleImage(key)} style={{width: "50px", height: "50px", filter: "var(--app-swatch-filter)"}}/>
                                    <span style={{fontSize: "11px", color: "var(--app-text-secondary)", marginTop: "2px"}}>{t(o.options[key])}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    render() {
        const {t, model, config} = this.props;
        if (!model || model.fileType !== "trace" || !config || !config.children.trace) {
            return null;
        }
        try {
            const actions = this.actions;
            const trace = config.children.trace.children;
            const fill = config.children.fill;
            const fillOptions = fill && fill.children ? fill.children : {};
            const fillOn = !!(fill && fill.default_value);
            // Only the styles that take them show angle / cross-hatch / connect-ends; the rest take
            // spacing alone, as in ConfigSvg.
            const style = fillOptions.fill_style ? fillOptions.fill_style.default_value : "parallel";
            const isParallel = style === "parallel";
            const isWave = style === "wave";
            const showAngle = ANGLED_STYLES.has(style);
            return (
                <div>
                    <ConfigSection title={t(config.children.trace.label)}>
                        {trace.upscale && this.num(trace.upscale, actions.setUpscale)}
                        {trace.window && this.num(trace.window, actions.setWindow)}
                        {trace.thick_width && this.num(trace.thick_width, actions.setThickWidth, 1)}
                        {trace.join_gap && this.num(trace.join_gap, actions.setJoinGap, 1)}
                        {fill && this.bool(fill, actions.setFill)}
                        {fillOn && <React.Fragment>
                            {fillOptions.fill_style && this.styles(fillOptions.fill_style, actions.setFillStyle)}
                            {fillOptions.fill_density && this.num(fillOptions.fill_density, actions.setFillDensity)}
                            {showAngle && fillOptions.hatch_angle && this.num(fillOptions.hatch_angle, actions.setHatchAngle)}
                            {showAngle && fillOptions.cross_hatch && this.bool(fillOptions.cross_hatch, actions.setCrossHatch)}
                            {fillOptions.inset && this.bool(fillOptions.inset, actions.setInset)}
                            {fillOptions.inset && fillOptions.inset.default_value && fillOptions.inset_dist && this.num(fillOptions.inset_dist, actions.setInsetDist, 2)}
                            {isParallel && fillOptions.connect_ends && this.bool(fillOptions.connect_ends, actions.setConnectEnds)}
                            {isParallel && fillOptions.connect_ends && fillOptions.connect_ends.default_value && fillOptions.hatch_scope && this.num(fillOptions.hatch_scope, actions.setHatchScope)}
                            {isWave && fillOptions.wave_amplitude && this.num(fillOptions.wave_amplitude, actions.setWaveAmplitude, 2)}
                            {isWave && fillOptions.wave_wavelength && this.num(fillOptions.wave_wavelength, actions.setWaveWavelength, 2)}
                            {fillOptions.jitter && this.bool(fillOptions.jitter, actions.setJitter)}
                            {fillOptions.jitter && fillOptions.jitter.default_value && fillOptions.jitter_amount && this.num(fillOptions.jitter_amount, actions.setJitterAmount, 2)}
                        </React.Fragment>}
                        {config.children.optimize_path && this.bool(config.children.optimize_path, actions.setOptimizePath)}
                        <div style={{paddingTop: "8px"}}>
                            <Button size="small" type="primary" onClick={actions.exportTracedSvg}>
                                {t('Export traced SVG')}
                            </Button>
                        </div>
                    </ConfigSection>
                </div>
            );
        } catch (e) {
            console.error("Trace config panel error:", e);
            return null;
        }
    }
}

const mapStateToProps = (state) => {
    const {model, config} = state.writeAndDraw;
    return {
        model,
        config
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateConfig: (key, value) => dispatch(writeAndDrawActions.updateConfig(key, value)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(ConfigTrace));
