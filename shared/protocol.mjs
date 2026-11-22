/**
 * The socket.io protocol shared by the server and the web bundle.
 *
 * These names cross the wire, so they must match on both sides. They used to be declared twice,
 * once in server/src/constants.js and once in web/src/constants.js, which drifted: the
 * write-ok/error names only existed on the server and the truncated event value below was
 * duplicated in both copies. They now have one home.
 *
 * Not every constant in the two packages lives here: UI-only names (`TAP_*`,
 * `TAB_WRITE_AND_DRAW`, `MSG_SERIAL_PORT_CLOSE_TOAST`) and the render-method markers that are
 * embedded in G-code rather than sent over the socket stay in their package's constants file.
 */

export const P3D_SLICE_START = 'P3D_SLICE_START';
export const P3D_SLICE_STATUS = 'P3D_SLICE_STATUS';
// CuraEngine acquisition: ask for the state, start a user-initiated download, receive progress.
export const P3D_ENGINE_STATUS = 'P3D_ENGINE_STATUS';
export const P3D_ENGINE_INSTALL = 'P3D_ENGINE_INSTALL';

export const SERIAL_PORT_PATH_UPDATE = 'SERIAL_PORT_PATH_UPDATE'
// The historical value was truncated mid-name. Web and server ship inside the
// same Electron bundle, so they cannot be version-skewed against each other; correcting the
// value on both sides at once is safe. Do not "restore" it out of compatibility caution.
export const SERIAL_PORT_GET_OPENED = 'SERIAL_PORT_GET_OPENED';  // Get opened port
export const SERIAL_PORT_OPEN = 'SERIAL_PORT_OPEN';
export const SERIAL_PORT_CLOSE = 'SERIAL_PORT_CLOSE';
export const SERIAL_PORT_ERROR = 'SERIAL_PORT_ERROR';
export const SERIAL_PORT_WRITE_ERROR = 'SERIAL_PORT_WRITE_ERROR';
export const SERIAL_PORT_WRITE_OK = 'SERIAL_PORT_WRITE_OK';
export const SERIAL_PORT_DATA = 'SERIAL_PORT_DATA';
export const SERIAL_PORT_WRITE = 'SERIAL_PORT_WRITE'; // Write raw data to the serial port (single G-code or bytes)

// client -> server: run a LAN scan; server -> client: discovered bridges, arm state
export const NETWORK_DEVICE_DISCOVER = 'NETWORK_DEVICE_DISCOVER';
export const NETWORK_DEVICE_UPDATE = 'NETWORK_DEVICE_UPDATE';
export const NETWORK_DEVICE_INFO = 'NETWORK_DEVICE_INFO';
// Bridge job and leveling replies (# job {...} / # level {...})
export const NETWORK_JOB_STATUS = 'NETWORK_JOB_STATUS';
export const NETWORK_LEVELING_STATUS = 'NETWORK_LEVELING_STATUS';

export const GCODE_SENDER_REFUSE = 'GCODE_SENDER_REFUSE'; //data: {msg}
export const GCODE_SENDER_STATUS_CHANGE = 'GCODE_SENDER_STATUS_CHANGE'; //data: {preStatus, curStatus, taskId}; status: see server/src/gcode/jobStates.mjs
export const GCODE_SENDER_PROGRESS_CHANGE = 'GCODE_SENDER_PROGRESS_CHANGE'; //data: {total, sent, taskId}

export const GCODE_SENDER_START = 'GCODE_SENDER_START';
export const GCODE_SENDER_PAUSE = 'GCODE_SENDER_PAUSE';
export const GCODE_SENDER_RESUME = 'GCODE_SENDER_RESUME';
export const GCODE_SENDER_STOP = 'GCODE_SENDER_STOP';
export const GCODE_SENDER_ABORT = 'GCODE_SENDER_ABORT'; // emergency stop for an offloaded job

export const TOOL_PATH_GENERATE_LASER = 'TOOL_PATH_GENERATE_LASER';
export const TOOL_PATH_GENERATE_WRITE_AND_DRAW = 'TOOL_PATH_GENERATE_WRITE_AND_DRAW';
// Request/response (socket.io ack) for the traced SVG behind the last preview of a raster.
export const TOOL_PATH_EXPORT_TRACED_SVG = 'TOOL_PATH_EXPORT_TRACED_SVG';

export const P3D_CONFIG_MATERIAL_SETTINGS_FETCH = 'P3D_CONFIG_MATERIAL_SETTINGS_FETCH';
export const P3D_CONFIG_MATERIAL_SETTING_UPDATE = 'P3D_CONFIG_MATERIAL_SETTING_UPDATE';

export const P3D_CONFIG_PRINT_SETTINGS_FETCH = 'P3D_CONFIG_PRINT_SETTINGS_FETCH';
export const P3D_CONFIG_PRINT_SETTING_UPDATE = 'P3D_CONFIG_PRINT_SETTING_UPDATE';

export const FRONT_END_POSITION_MONITOR = 'FRONT_END_POSITION_MONITOR';

export const TEMPERATURE_MONITOR = 'TEMPERATURE_MONITOR'
