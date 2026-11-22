// The app's theme. 'system' follows the OS live, light and dark are explicit picks.
//
// The preference lives in localStorage rather than only in the store because the three.js
// canvases and the pre-mount loading screen both need the resolved theme without a store round
// trip (getIsAdvance in utils/index.js reads localStorage the same way).
export const THEME_LIGHT = 'light';
export const THEME_DARK = 'dark';
export const THEME_SYSTEM = 'system';

const STORAGE_KEY = 'THEME_PREFERENCE';
const DARK_QUERY = '(prefers-color-scheme: dark)';

// How long the change takes to fade. This is the JavaScript reader of --app-theme-transition in
// theme.css, which transitions the colours for the same length of time and is the one place to
// change the number; the canvases animate their own clear colour over it to match.
export const THEME_TRANSITION_MS = 300;

export const readStoredTheme = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === THEME_LIGHT || stored === THEME_DARK ? stored : THEME_SYSTEM;
};

export const storeTheme = (preference) => localStorage.setItem(STORAGE_KEY, preference);

export const systemPrefersDark = () => !!(window.matchMedia && window.matchMedia(DARK_QUERY).matches);

// Someone who has asked their system to cut down on motion should get the theme change without
// the cross-fade, in the CSS and on the canvases alike.
export const prefersReducedMotion = () =>
    !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

export const resolveTheme = (preference) => {
    if (preference !== THEME_SYSTEM) return preference;
    return systemPrefersDark() ? THEME_DARK : THEME_LIGHT;
};

// Follow the OS while the app is open. Returns the unsubscribe function.
export const watchSystemTheme = (onChange) => {
    if (!window.matchMedia) return () => {};
    const query = window.matchMedia(DARK_QUERY);
    const listener = (event) => onChange(event.matches ? THEME_DARK : THEME_LIGHT);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
};
