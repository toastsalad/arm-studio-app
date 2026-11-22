// Names that cross the socket.io wire live in the shared protocol module.
export * from '../../shared/protocol.mjs';

// UI-only constants, never sent over the socket.
export const TAP_LASER = "TAP_LASER";
export const TAP_P3D = "TAP_P3D";
export const TAP_SETTINGS = "TAP_SETTINGS";
export const TAP_BASIC = "TAP_BASIC";
export const TAB_WRITE_AND_DRAW = "TAB_WRITE_AND_DRAW";
export const MSG_SERIAL_PORT_CLOSE_TOAST = 'Please connect DexArm first';

// Render-method markers are embedded in G-code, not sent over the socket.
export const TOOL_PATH_RENDER_METHOD_POINT = ';TOOL_PATH_RENDER_METHOD_POINT';
