// Named access to the settings blob, mirroring the server's server/src/settings.js.
//
// The settings tree is the app's central data structure, but it has no schema: every consumer
// used to spell out `settings.transformation.children.width.default_value`, which made the shape
// impossible to grep for and let a rename become a find-and-replace across two bundles. Reading
// and writing through a dotted path gives one place to change.

/** The node at 'transformation.width' etc.; the root settings object is the parent of the first key. */
const nodeAt = (settings, path) => {
    if (!settings) return undefined;
    let node = {children: settings};
    for (const key of path.split('.')) {
        node = node && node.children ? node.children[key] : undefined;
        if (!node) return undefined;
    }
    return node;
};

// A default_value that is itself a token ('#work_speed#') is not a value to compute with; the
// caller's fallback is the honest answer.
const isPlaceholder = (value) => typeof value === 'string' && (value.includes('#') || value.includes('%'));

const valueAt = (settings, path) => {
    const node = nodeAt(settings, path);
    if (!node || node.default_value === undefined || node.default_value === null) return undefined;
    if (isPlaceholder(node.default_value)) return undefined;
    return node.default_value;
};

export const getSetting = (settings, path) => valueAt(settings, path);

/** Any leaf field other than default_value, e.g. 'minimum_value' or 'label'. */
export const settingField = (settings, path, field, fallback) => {
    const node = nodeAt(settings, path);
    return node && node[field] !== undefined ? node[field] : fallback;
};

/** The category node itself, for structural questions ("is there a trace section?"). */
export const settingNode = (settings, path) => nodeAt(settings, path);

export const settingsNumber = (settings, path, fallback) => {
    const value = valueAt(settings, path);
    if (value === undefined) return fallback;
    const number = Number(value);
    return isFinite(number) ? number : fallback;
};

export const settingsBool = (settings, path, fallback) => {
    const value = valueAt(settings, path);
    return value === undefined ? fallback : !!value;
};

export const settingsString = (settings, path, fallback) => {
    const value = valueAt(settings, path);
    return value === undefined ? fallback : String(value);
};

/**
 * Write a setting by path. Returns false when the path does not exist, so a typo in a key name
 * is not silently swallowed the way an assignment into a missing branch would be.
 */
export const setSetting = (settings, path, value) => {
    const keys = path.split('.');
    const leaf = keys.pop();
    const parent = keys.length ? nodeAt(settings, keys.join('.')) : {children: settings};
    if (!parent || !parent.children || !parent.children[leaf]) return false;
    parent.children[leaf].default_value = value;
    return true;
};
