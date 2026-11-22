// Named access to the settings blob.
//
// The settings tree is the app's central data structure but has no schema, so every consumer
// used to spell out `settings.transformation.children.width.default_value`. That threw on a
// partial file, which is why one module grew a private dec/truthy/num trio, and it made the
// shape impossible to grep for. These accessors are the single definition of "read a setting":
// a dotted path, a fallback for a missing or placeholder value, and no throw.

/** The node at 'transformation.width' etc.; the root settings object is the parent of the first key. */
const nodeAt = (settings, path) => {
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
 * The token a generated G-code uses to stand in for this setting ('#work_speed#'); the front end
 * substitutes the real value. Distinct from default_value on purpose.
 */
export const settingsPlaceholder = (settings, path, fallback) => {
    const node = nodeAt(settings, path);
    return node && typeof node.placeholder === 'string' ? node.placeholder : fallback;
};

/** True when the key is present at all, so a caller can tell "unset" from "set to the fallback". */
export const hasSetting = (settings, path) => nodeAt(settings, path) !== undefined;

/** The raw node, for the rare structural question ("does this category have children?"). */
export const settingsNode = (settings, path) => nodeAt(settings, path);
