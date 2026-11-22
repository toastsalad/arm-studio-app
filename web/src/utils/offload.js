// Whether full jobs should be handed to the bridge instead of streamed.
// Persisted like the other UI preferences (theme, advance, work heights).
const KEY = 'OFFLOAD_JOBS';

export const isOffloadEnabled = () => localStorage.getItem(KEY) === '1';

export const setOffloadEnabled = (value) => {
    localStorage.setItem(KEY, value ? '1' : '0');
};
