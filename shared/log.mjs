/**
 * One logger with four levels.
 *
 * The server used `console.log` for everything it did -- every G-code line it sent, every position it emitted on
 * the socket, every preview it started -- and `console.error` for failures. On a running plot that is a wall of
 * text in which the one line that matters cannot be found, and there was no way to ask for less. A failed write
 * and a successful one looked equally important because neither had a level.
 *
 * ARMS_LOG sets the level: error, warn, info (default) or debug. An unknown value falls back to info and says so,
 * rather than silently behaving like the default.
 */
const ORDER = {error: 0, warn: 1, info: 2, debug: 3};
const DEFAULT_LEVEL = 'info';

/**
 * Build a logger. The env var and the sink are arguments so a test can drive it without touching either.
 */
export const createLog = (requestedLevel = process.env.ARMS_LOG, sink = console) => {
    const requested = String(requestedLevel || '').trim().toLowerCase();
    const known = Object.prototype.hasOwnProperty.call(ORDER, requested);
    const level = known ? requested : DEFAULT_LEVEL;
    if (requested && !known) {
        sink.error(`ARMS_LOG='${requestedLevel}' is not one of: ${Object.keys(ORDER).join(', ')}; using '${level}'`);
    }

    const threshold = ORDER[level];
    const at = (name, args) => {
        if (ORDER[name] <= threshold) sink[name](...args);
    };

    return {
        level,
        error: (...args) => at('error', args),
        warn: (...args) => at('warn', args),
        info: (...args) => at('info', args),
        debug: (...args) => at('debug', args),
    };
};

export const log = createLog();
