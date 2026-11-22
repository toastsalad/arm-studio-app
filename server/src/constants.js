// Names that cross the socket.io wire live in the shared protocol module.
export * from '../../shared/protocol.mjs';

// Render-method markers are embedded in G-code, not sent over the socket.
export const TOOL_PATH_RENDER_METHOD_LINE = ';TOOL_PATH_RENDER_METHOD_LINE';
export const TOOL_PATH_RENDER_METHOD_POINT = ';TOOL_PATH_RENDER_METHOD_POINT';
