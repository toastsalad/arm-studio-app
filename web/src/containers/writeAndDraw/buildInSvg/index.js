/* global require */
// `require` with a template literal is webpack's context form; see ConfigSvgOptions.
let buildInSvgArray = [];
export const getBuildInSvgArray = () => {
    if (buildInSvgArray.length === 0) {
        for (let i = 1; i <= 32; i++) {
            let url = require(`./${i}.svg`);
            buildInSvgArray.push(url);
        }
    }
    return buildInSvgArray;
}

export const base64ToBlob = (uri) => {
    let byteString;
    if (uri.split(',')[0].indexOf('base64') >= 0) {
        byteString = atob(uri.split(',')[1]);
    } else {
        byteString = unescape(uri.split(',')[1]);
    }
    const mimeString = uri
        .split(',')[0]
        .split(':')[1]
        .split(';')[0];

    const uint8Array = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
    }
    return new Blob([uint8Array], {type: mimeString});
}
