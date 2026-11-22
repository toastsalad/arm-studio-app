import {textToSvg} from '../../../utils/textToSvg';

/**
 * Render a text model's settings to an SVG and hand it back as a file.
 *
 * Typed text has no file of its own, so it is turned into one here and then uploaded and plotted
 * down the ordinary SVG path - which is why the text panel offers the same fill and travel
 * options the SVG panel does.
 */
export const textFile = async (configText) => {
    const {text, font, font_size} = configText.children;
    const fontUrl = window.serverAddress + font.default_value;
    const svg = await textToSvg(fontUrl, text.default_value, font_size.default_value);
    return new File([svg], 'text.svg', {type: 'image/svg+xml'});
};

export default textFile;
