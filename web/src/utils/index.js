/* global process */
// `process` is not a browser global; isElectron() only ever touches it behind a
// `typeof` check, and webpack leaves the name alone in the bundle.

// toFixed that leaves a value with fewer fraction digits untouched.
const toFixed = (value, fractionDigits) => {
    const stringValue = '' + value;
    const pos = stringValue.indexOf('.');
    if (pos !== -1) {
        const digits = stringValue.length - pos - 1;
        if (digits > fractionDigits) {
            return Number(value.toFixed(fractionDigits));
        }
    }
    return value;
};

const radian2degree = (radian) => {
    return radian * 180 / Math.PI
};

const degree2radian = (degree) => {
    return degree * Math.PI / 180
};

const getUuid = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const random = Math.random() * 16 | 0;
        const value = char === 'x' ? random : (random & 0x3 | 0x8);
        return value.toString(16);
    });
};

const isElectron = () => {
    if (typeof window !== 'undefined' && window.process && window.process.type) return true;
    return typeof process !== 'undefined' && process.versions != null && process.versions.electron != null;
};

/*
 * Fit size to the min/max width and height restrictions:
 *   min_width/min_height and max_width/max_height divide the plane into 9 cases,
 *   and the returned size is the source scaled into the nearest legal case.
 */
const getAvailableSize = (width, height, sizeRestriction) => {
    const {min_width, max_width, min_height, max_height} = sizeRestriction;
    if (width <= min_width && height <= min_height) {
        const scaleWidth = min_width / width;
        const scaleHeight = min_height / height;
        const scale = Math.max(scaleWidth, scaleHeight);
        return {width: width * scale, height: height * scale}
    }
    if (width >= max_width && height >= max_height) {
        const scaleWidth = max_width / width;
        const scaleHeight = max_height / height;
        const scale = Math.min(scaleWidth, scaleHeight);
        return {width: width * scale, height: height * scale}
    }
    if (width >= min_width && width <= max_width &&
        height <= min_height) {
        return {width, height}
    }
    if (width >= min_width && width <= max_width &&
        height >= max_height) {
        const scale = max_height / height;
        return {width: width * scale, height: height * scale}
    }
    if (width <= min_width &&
        height >= min_height && height <= max_height) {
        return {width, height}
    }
    if (width >= max_width &&
        height >= min_height && height <= max_height) {
        const scale = max_width / width;
        return {width: width * scale, height: height * scale}
    }
    if (width >= max_width && height <= min_height) {
        const scale = max_width / width;
        return {width: width * scale, height: height * scale}
    }
    if (width <= min_width && height >= max_height) {
        const scale = max_height / height;
        return {width: width * scale, height: height * scale}
    }
    return {width, height}
};

// Filename-safe local timestamp with the given extension, e.g. "1021203045.gcode".
const getTimestampName = (ext) => {
    const now = new Date();
    return [now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()].join("") + ext;
};

// Cast to number, mapping NaN to 0.
const str2Number  = (value) =>{
    if (typeof value === 'number') {
        if (Number.isNaN(value)) {
            return 0;
        }
        return value;
    }
    const number = Number(value);
    if (Number.isNaN(number)) {
        return 0;
    }
    return number;
};

const getIsAdvance = () => {
    const advance = localStorage.getItem('ADVANCE')
    return advance
        ? Number(advance) === 1
        : false
}

export {
    toFixed,
    radian2degree,
    degree2radian,
    getUuid,
    isElectron,
    getAvailableSize,
    getTimestampName,
    str2Number,
    getIsAdvance
};
