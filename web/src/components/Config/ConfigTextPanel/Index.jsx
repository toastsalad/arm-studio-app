import React, {PureComponent} from 'react';
import {Input} from 'antd';
import ConfigSection from '../ConfigSection/Index.jsx';
import ConfigRow from '../ConfigRow/Index.jsx';
import ConfigNumber from '../ConfigNumber/Index.jsx';
import ConfigSelect from '../ConfigSelect/Index.jsx';
import ConfigSvgOptions from '../ConfigSvgOptions/Index.jsx';

// Typed text is rendered to an SVG of glyph outlines and then plotted exactly like a drawing, so
// it offers the same options the SVG panel does - see ConfigSvgOptions. Only the three rows that
// describe the text itself are specific to this panel.
//
// Connected per tab by a thin wrapper, the way ConfigTransformation is.
class ConfigTextPanel extends PureComponent {
    state = {typed: null};
    typing = null;

    componentWillUnmount() {
        clearTimeout(this.typing);
    }

    /**
     * Every edit re-renders the drawing, uploads it and runs the plotter, so typing a whole word
     * would fire one of those per keystroke. Wait for a pause instead; picking a font or a size
     * applies at once, since those are single deliberate clicks.
     */
    onType = (event) => {
        const text = event.target.value;
        clearTimeout(this.typing);
        this.setState({typed: text});
        this.typing = setTimeout(() => this.props.updateConfigText('text', text), 300);
    };

    render() {
        const {t, model, config_text, config, buildInFonts, userFonts, updateConfigText, updateConfig} = this.props;
        if (!model || model.fileType !== "text" || !config_text || !config) {
            return null;
        }
        const {text, font, font_size} = config_text.children;

        // The Line* fonts are single-stroke, so they plot as one line per stroke; the rest are
        // outlines and plot as hollow letters.
        const fontOptions = [];
        for (const item of buildInFonts) {
            fontOptions.push({label: item.fontName, value: item.path});
        }
        for (const item of userFonts) {
            fontOptions.push({label: item.fontName, value: item.path, color: '#007777'});
        }

        return (
            <ConfigSection title={t(config_text.label)}>
                <ConfigRow label={t(text.label)} tooltip={t('Content of the Text.')}>
                    <Input.TextArea
                        style={{fontSize: "12px", resize: "none"}}
                        value={this.state.typed === null ? text.default_value : this.state.typed}
                        autoSize={{minRows: 1, maxRows: 4}}
                        onChange={this.onType}/>
                </ConfigRow>
                <ConfigRow label={t(font.label)} tooltip={t('Font of the Text.')}>
                    <ConfigSelect options={fontOptions} value={font.default_value}
                                  onChange={(value) => updateConfigText('font', value)}/>
                </ConfigRow>
                <ConfigRow label={t(font_size.label)} unit={font_size.unit} tooltip={t('Font size of the Text.')}>
                    <ConfigNumber
                        min={font_size.minimum_value}
                        max={font_size.maximum_value}
                        value={font_size.default_value}
                        onChange={(value) => updateConfigText('font_size', value)}/>
                </ConfigRow>
                <ConfigSvgOptions t={t} config={config} updateConfig={updateConfig}/>
            </ConfigSection>
        );
    }
}

export default ConfigTextPanel;
