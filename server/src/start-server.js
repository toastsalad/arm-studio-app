/* global window */
// In Electron this file runs as a preload script, where `window` is shared with
// the renderer (see electron/main.js); under the dev server it does not exist.
import fs from 'fs';
import path from 'path';
import http from "http";
import _ from 'lodash';
import {Server as SocketIoServer} from 'socket.io';
import Koa from 'koa';
import koaBody from 'koa-body';
import Router from 'koa-router';
import serve from 'koa-static';
import {pipeline} from 'stream/promises';
import {getImageSize, getUniqueFilename, isElectron} from './utils/index.js';
import serialPortManager from './serialPortManager.js';
import generateToolPathLines from './toolPath/generateToolPathLines.js';
import {tracedSvgPathFor, isTracing} from './toolPath/plotterHelperBridge.js';
import gcodeSender from './gcode/gcodeSender.js';
import bridgeJobSender from './gcode/bridgeJobSender.js';
import {createBridgeStream} from './gcode/bridgeStream.mjs';
import deviceStateMonitor from './deviceStateMonitor.js';
import frontEndPositionMonitor from "./frontEndPositionMonitor";
import p3dStartSlice from './p3dStartSlice.js';
import {checkFileExist} from "./utils/fsUtils";
import storeManager from './storeManager.js';
import {
    SERIAL_PORT_PATH_UPDATE,
    SERIAL_PORT_GET_OPENED,
    SERIAL_PORT_OPEN,
    SERIAL_PORT_CLOSE,
    SERIAL_PORT_ERROR,
    SERIAL_PORT_DATA,
    SERIAL_PORT_WRITE,
    NETWORK_DEVICE_DISCOVER,
    NETWORK_DEVICE_UPDATE,
    NETWORK_DEVICE_INFO,
    NETWORK_JOB_STATUS,
    NETWORK_LEVELING_STATUS,
    TOOL_PATH_GENERATE_LASER,
    TOOL_PATH_GENERATE_WRITE_AND_DRAW,
    TOOL_PATH_EXPORT_TRACED_SVG,

    GCODE_SENDER_STATUS_CHANGE,
    GCODE_SENDER_PROGRESS_CHANGE,
    GCODE_SENDER_START,
    GCODE_SENDER_STOP,
    GCODE_SENDER_PAUSE,
    GCODE_SENDER_RESUME,
    GCODE_SENDER_ABORT,
    GCODE_SENDER_REFUSE,
    P3D_CONFIG_MATERIAL_SETTINGS_FETCH,
    P3D_CONFIG_MATERIAL_SETTING_UPDATE,
    P3D_CONFIG_PRINT_SETTINGS_FETCH,
    P3D_CONFIG_PRINT_SETTING_UPDATE,
    P3D_SLICE_START,
    P3D_SLICE_STATUS,
    FRONT_END_POSITION_MONITOR,
    TEMPERATURE_MONITOR,
} from "./constants.js"
import {
    STATIC_DIR,
    CACHE_DIR,
    BUILD_IN_FONTS_DIR,
    USER_FONTS_DIR,
    P3D_DIR_CONFIG_PRINT_SETTINGS,
    P3D_DIR_CONFIG_MATERIAL_SETTINGS
} from './init.js';
import SVGParser from './SVGParser/index.js';
import {trimViewBoxToContent} from './SVGParser/trimViewBox.js';
import {log} from '../../shared/log.mjs';

let serverCacheAddress; // set once the port is known
// Tell the bridge when a desktop ack loop owns the arm (see bridgeStream.mjs).
const bridgeStream = createBridgeStream((command) => serialPortManager.write(command));
let app = new Koa();
let router = new Router();
let httpServer = http.createServer(app.callback());
// Large Write & Draw toolpaths arrive as one gcode string; engine.io's 1 MB
// maxHttpBufferSize default silently closes the socket past that, and the disconnect
// handler then tears down the serial listeners so the arm appears to disconnect.
let socketIoServer = new SocketIoServer(httpServer, { maxHttpBufferSize: 256 * 1024 * 1024 });

// Save an upload to cache/ and return its url and path.
const saveFileToCacheDir = async (file) => {
    const filename = getUniqueFilename(file.originalFilename);
    const filePath = path.join(CACHE_DIR, filename);
    // Wait for the write to land: the caller hands this URL straight to the client (which
    // fetches it immediately) and to the slicer, so returning early serves a truncated model.
    await pipeline(fs.createReadStream(file.filepath), fs.createWriteStream(filePath));
    return {url: serverCacheAddress + filename, filePath};
};

const saveFontFile = async (fontFile) => {
    const fontName = fontFile.originalFilename;
    const fontPath = path.join(USER_FONTS_DIR, fontName);
    // Wait for the write before the caller lists or reads the font back.
    await pipeline(fs.createReadStream(fontFile.filepath), fs.createWriteStream(fontPath));
    return fontName;
}

const listFonts = () => {
    const buildInFontsPath = fs.readdirSync(BUILD_IN_FONTS_DIR);
    const userFontsPath = fs.readdirSync(USER_FONTS_DIR);
    const buildInFonts = [];
    const userFonts = [];
    for (const filename of buildInFontsPath) {
        const isSvgFont = filename.toLowerCase().endsWith('svg');
        const fontName = filename.slice(0, filename.indexOf('.'));

        buildInFonts.push({isSvgFont, fontName, path: '/fonts/' + filename});
    }
    for (const filename of userFontsPath) {
        const isSvgFont = filename.toLowerCase().endsWith('svg');
        const fontName = filename.slice(0, filename.indexOf('.'));
        userFonts.push({isSvgFont, fontName, path: '/userFonts/' + filename});
    }
    return {buildInFonts, userFonts};
}

const setupHttpServer = () => {
    // file: {size, path, name, type, mtime}
    router.post('/uploadFile', async (ctx) => {
        const file = ctx.request.files.file;
        const {url} = await saveFileToCacheDir(file);
        log.info("upload file ok: " + file.originalFilename + " -> " + url)
        return ctx.body = {url};
    });
    router.post('/uploadImage', async (ctx) => {
        const file = ctx.request.files.file;
        const {url, filePath} = await saveFileToCacheDir(file);
        let width = 0, height = 0;
        // getImageSize can be inaccurate for SVG, so parse its dimensions directly.
        if (filePath.endsWith(".svg") || filePath.endsWith(".SVG")) {
            const svgParser = new SVGParser();
            const result = await svgParser.parseFile(file.filepath);
            width = result.width;
            height = result.height;
            // Drawings usually declare a canvas far larger than the artwork on it. Crop the cached
            // copy to the ink so the model, its handles and the plotted scale follow the drawing
            // rather than the empty margin around it.
            const cropped = trimViewBoxToContent(fs.readFileSync(filePath, 'utf8'), result);
            if (cropped) {
                fs.writeFileSync(filePath, cropped.svg);
                width = cropped.width;
                height = cropped.height;
                log.info("cropped svg to content: " + Math.round(result.width) + 'x' + Math.round(result.height)
                    + " -> " + Math.round(width) + 'x' + Math.round(height));
            }
        } else {
            const result = getImageSize(file.filepath);
            width = result.width;
            height = result.height;
        }
        log.info("upload image ok: " + file.originalFilename + " size: " + width + 'x' + height + " -> " + url);
        return ctx.body = {url, width, height};
    });

    router.post('/font/upload', async (ctx) => {
        let fontName = '';
        if (ctx.request.files) {
            fontName = await saveFontFile(ctx.request.files.file);
        }
        const {buildInFonts, userFonts} = listFonts()
        return ctx.body = {
            fontName,
            buildInFonts,
            userFonts
        };
    }).post('/font/list', (ctx) => {
        return ctx.body = listFonts();
    }).post('/font/delete', (ctx) => {
        let font = ctx.request.body.font;
        if (!font) font = null;
        if (font) {
            // The client passes the served path ('/userFonts/name.ttf'); the file
            // itself lives in the user data dir, never in the bundle.
            const fontPath = path.join(USER_FONTS_DIR, path.basename(font))
            if (checkFileExist(fontPath)) {
                fs.unlinkSync(fontPath);
            } else {
                font = null;
            }
        }
        const {buildInFonts, userFonts} = listFonts()
        return ctx.body = {
            fontName: font,
            buildInFonts,
            userFonts
        };
    });

    app.use(async (ctx, next) => {
        ctx.set('Access-Control-Allow-Origin', '*');
        await next();
    });
    app.use(async (ctx, next) => {
        log.debug(`${ctx.request.method} ${ctx.request.url}`);
        await next();
    });
    app.use(koaBody({multipart: true}));
    // Uploads are served from CACHE_DIR, which lives in the user data dir and so is not
    // covered by serve(STATIC_DIR).
    app.use(async (ctx, next) => {
        if (!ctx.path.startsWith('/cache/')) return next();
        const filePath = path.join(CACHE_DIR, path.basename(ctx.path));
        try {
            if (!fs.statSync(filePath).isFile()) return next();
        } catch (e) {
            return next();
        }
        ctx.type = path.extname(filePath);
        ctx.body = fs.createReadStream(filePath);
        await next();
    });
    // Uploaded fonts live in the user data dir too, so serve them explicitly.
    app.use(async (ctx, next) => {
        if (!ctx.path.startsWith('/userFonts/')) return next();
        const filePath = path.join(USER_FONTS_DIR, path.basename(ctx.path));
        try {
            if (!fs.statSync(filePath).isFile()) return next();
        } catch (e) {
            return next();
        }
        ctx.type = path.extname(filePath);
        ctx.body = fs.createReadStream(filePath);
        await next();
    });
    app.use(serve(STATIC_DIR));
    app.use(router.routes());
    app.use(router.allowedMethods());
};

const readP3dConfigMaterialSettingsSync = () => {
    const contents = [];
    const filenames = fs.readdirSync(P3D_DIR_CONFIG_MATERIAL_SETTINGS);
    filenames.forEach((filename) => {
        const filePath = path.join(P3D_DIR_CONFIG_MATERIAL_SETTINGS, filename);
        const content = fs.readFileSync(filePath, 'utf8');
        contents.push(JSON.parse(content))
    });
    return contents;
};

const readP3dConfigPrintSettingsSync = () => {
    const contents = [];
    const filenames = fs.readdirSync(P3D_DIR_CONFIG_PRINT_SETTINGS);
    filenames.forEach((filename) => {
        const filePath = path.join(P3D_DIR_CONFIG_PRINT_SETTINGS, filename);
        const content = fs.readFileSync(filePath, 'utf8');
        contents.push(JSON.parse(content))
    });
    return contents;
};

const setupSocket = () => {
    socketIoServer.on(
        'connection',
        socket => {
            log.info('socket io server -> connect');

            // The serial/position/sender singletons are shared across connections, so their
            // listeners must not be wiped wholesale on disconnect: track the ones added for
            // this socket and remove only those.
            const bindings = [];
            const bind = (emitter, event, handler) => {
                emitter.on(event, handler);
                bindings.push([emitter, event, handler]);
            };

            socket.on('disconnect', () => {
                log.info('socket io server -> disconnect');
                socket.removeAllListeners();
                for (const [emitter, event, handler] of bindings) {
                    emitter.removeListener(event, handler);
                }
            });

            bind(serialPortManager, SERIAL_PORT_PATH_UPDATE, (paths) => {
                socket.emit(SERIAL_PORT_PATH_UPDATE, paths);
            });

            frontEndPositionMonitor.registerListeners();
            bind(frontEndPositionMonitor, FRONT_END_POSITION_MONITOR, (position) => {
                log.debug('socket emit postion', position)
                socket.emit(FRONT_END_POSITION_MONITOR, position);
            });

            bind(frontEndPositionMonitor, TEMPERATURE_MONITOR, (temperature) => {
                log.debug('socket emit temperature', temperature)
                socket.emit(TEMPERATURE_MONITOR, temperature);
            });

            socket.on(SERIAL_PORT_GET_OPENED, () => {
                const portPath = serialPortManager.getOpened();
                socket.emit(SERIAL_PORT_GET_OPENED, portPath);
            });

            socket.on(SERIAL_PORT_OPEN, portPath => {
                serialPortManager.open(portPath)
                // Any job from the previous connection is gone with it; recover instead of
                // leaving the sender wedged mid-queue.
                log.info('gcodeSender reset to idle')
                gcodeSender.reset()
            });
            socket.on(SERIAL_PORT_CLOSE, () => serialPortManager.close());
            socket.on(SERIAL_PORT_WRITE, data => serialPortManager.write(data));

            socket.on(NETWORK_DEVICE_DISCOVER, () => serialPortManager.discover());
            bind(serialPortManager, NETWORK_DEVICE_UPDATE, (devices) => {
                socket.emit(NETWORK_DEVICE_UPDATE, devices);
            });
            // The bridge's arm link can change at any time, so this is repeated for as long as
            // the socket is open.
            bind(serialPortManager, NETWORK_DEVICE_INFO, (info) => {
                socket.emit(NETWORK_DEVICE_INFO, info);
            });

            bind(serialPortManager, SERIAL_PORT_OPEN, (portPath) => {
                socket.emit(SERIAL_PORT_OPEN, portPath);
                bridgeJobSender.onSerialOpen();
            });
            bind(serialPortManager, SERIAL_PORT_CLOSE, (portPath) => {
                socket.emit(SERIAL_PORT_CLOSE, portPath);
                bridgeJobSender.onSerialClose();
            });
            bind(serialPortManager, SERIAL_PORT_ERROR, (error) => {
                socket.emit(SERIAL_PORT_ERROR, error);
            });
            bind(serialPortManager, SERIAL_PORT_DATA, (data) => {
                socket.emit(SERIAL_PORT_DATA, data);
            });

            socket.on(GCODE_SENDER_START, (data) => {
                const {gcode, isAckChange, isLaser, taskId, offload, mode} = data;
                const path = serialPortManager.getOpened();
                const network = /^tcp:\/\//i.test(path || '');
                if (offload && isAckChange && network) {
                    if (isLaser && deviceStateMonitor.isLaserCoverOpened) {
                        socket.emit(GCODE_SENDER_REFUSE, {msg: 'Laser cover opened, please close first'});
                        return;
                    }
                    bridgeJobSender.start({gcode, isLaser, mode, taskId});
                    return;
                }
                if (isAckChange && network) {
                    // The desktop owns the ack loop; keep the bridge's trim/level controls locked.
                    bridgeStream.begin();
                }
                gcodeSender.start(gcode, isAckChange, isLaser, taskId)
            });
            socket.on(GCODE_SENDER_PAUSE, () => {
                if (bridgeJobSender.active) bridgeJobSender.pause();
                else gcodeSender.pause();
            });
            socket.on(GCODE_SENDER_RESUME, () => {
                if (bridgeJobSender.active) bridgeJobSender.resume();
                else gcodeSender.resume();
            });
            socket.on(GCODE_SENDER_STOP, () => {
                if (bridgeJobSender.active) bridgeJobSender.stop();
                else gcodeSender.stop();
            });
            socket.on(GCODE_SENDER_ABORT, () => {
                if (bridgeJobSender.active) bridgeJobSender.abort();
                else serialPortManager.write('M410\n');
            });

            bind(gcodeSender, GCODE_SENDER_STATUS_CHANGE, (data) => {
                socket.emit(GCODE_SENDER_STATUS_CHANGE, data);
                if (data.curStatus === 'idle') bridgeStream.end();
            });
            bind(gcodeSender, GCODE_SENDER_PROGRESS_CHANGE, (data) => {
                socket.emit(GCODE_SENDER_PROGRESS_CHANGE, data);
            });
            bind(gcodeSender, GCODE_SENDER_REFUSE, (data) => {
                socket.emit(GCODE_SENDER_REFUSE, data);
                bridgeStream.end();
            });

            bind(bridgeJobSender, GCODE_SENDER_STATUS_CHANGE, (data) => {
                socket.emit(GCODE_SENDER_STATUS_CHANGE, data);
            });
            bind(bridgeJobSender, GCODE_SENDER_PROGRESS_CHANGE, (data) => {
                socket.emit(GCODE_SENDER_PROGRESS_CHANGE, data);
            });
            bind(bridgeJobSender, GCODE_SENDER_REFUSE, (data) => {
                socket.emit(GCODE_SENDER_REFUSE, data);
            });
            bind(serialPortManager, NETWORK_JOB_STATUS, (data) => {
                socket.emit(NETWORK_JOB_STATUS, data);
            });
            bind(serialPortManager, NETWORK_LEVELING_STATUS, (data) => {
                socket.emit(NETWORK_LEVELING_STATUS, data);
            });

            socket.on(
                TOOL_PATH_GENERATE_LASER,
                async (data) => {
                    log.debug(TOOL_PATH_GENERATE_LASER)
                    const {url, settings, toolPathId, fileType} = data;
                    try {
                        const toolPathLines = await generateToolPathLines(fileType, url, settings, false);
                        socket.emit(TOOL_PATH_GENERATE_LASER, {toolPathLines, toolPathId});
                    } catch (e) {
                        log.error(TOOL_PATH_GENERATE_LASER + " failed:", e);
                        socket.emit(TOOL_PATH_GENERATE_LASER, {toolPathLines: [], toolPathId, error: String(e && e.message || e)});
                    }
                }
            );
            // Hand back the SVG the tracer produced for the last preview, so the app can offer to save it.
            socket.on(
                TOOL_PATH_EXPORT_TRACED_SVG,
                (data, ack) => {
                    const {url} = data || {};
                    let svg = null, error = null;
                    const file = url ? tracedSvgPathFor(url) : null;
                    if (!file) {
                        error = isTracing(url)
                            ? 'Still tracing this image. Wait for the preview to finish, then export again.'
                            : 'Nothing has been traced for this image yet.';
                    } else {
                        try {
                            svg = fs.readFileSync(file, 'utf8');
                        } catch (e) {
                            error = 'Traced SVG is no longer on disk: ' + (e && e.message || e);
                        }
                    }
                    if (typeof ack === 'function') ack({svg, error});
                }
            );
            socket.on(
                TOOL_PATH_GENERATE_WRITE_AND_DRAW,
                async (data) => {
                    log.debug(TOOL_PATH_GENERATE_WRITE_AND_DRAW)
                    const {url, settings, toolPathId, fileType} = data;
                    try {
                        const toolPathLines = await generateToolPathLines(fileType, url, settings, true);
                        socket.emit(TOOL_PATH_GENERATE_WRITE_AND_DRAW, {toolPathLines, toolPathId});
                    } catch (e) {
                        if (e && e.superseded) {
                            log.debug(TOOL_PATH_GENERATE_WRITE_AND_DRAW + " superseded by a newer preview");
                            return;
                        }
                        log.error(TOOL_PATH_GENERATE_WRITE_AND_DRAW + " failed:", e);
                        socket.emit(TOOL_PATH_GENERATE_WRITE_AND_DRAW, {toolPathLines: [], toolPathId, error: String(e && e.message || e)});
                    }
                }
            );

            socket.on(P3D_CONFIG_MATERIAL_SETTINGS_FETCH, () => {
                const contents = readP3dConfigMaterialSettingsSync();
                socket.emit(P3D_CONFIG_MATERIAL_SETTINGS_FETCH, contents);
            });
            socket.on(P3D_CONFIG_MATERIAL_SETTING_UPDATE, (data) => {
                const {filename, keyChain, value} = data;
                const filePath = path.join(P3D_DIR_CONFIG_MATERIAL_SETTINGS, filename);
                const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                _.set(content, keyChain, value);
                fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
                const contentNew = readP3dConfigMaterialSettingsSync();
                socket.emit(P3D_CONFIG_MATERIAL_SETTINGS_FETCH, contentNew);
            });

            socket.on(P3D_CONFIG_PRINT_SETTINGS_FETCH, () => {
                const contents = readP3dConfigPrintSettingsSync();
                socket.emit(P3D_CONFIG_PRINT_SETTINGS_FETCH, contents);
            });
            socket.on(P3D_CONFIG_PRINT_SETTING_UPDATE, (data) => {
                const {filename, keyChain, value} = data;
                const filePath = path.join(P3D_DIR_CONFIG_PRINT_SETTINGS, filename);
                const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                _.set(content, keyChain, value);
                fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
                const contentNew = readP3dConfigPrintSettingsSync();
                socket.emit(P3D_CONFIG_PRINT_SETTINGS_FETCH, contentNew);
            });

            // data: {stlUrl, materialSettingFilename, printSettingFilename, id}
            socket.on(P3D_SLICE_START, (data) => {
                const {id} = data;
                p3dStartSlice(
                    data,
                    (progress) => {
                        socket.emit(P3D_SLICE_STATUS, {progress, id});
                    },
                    (result) => {
                        socket.emit(P3D_SLICE_STATUS, {result, id});
                    },
                    (err) => {
                        socket.emit(P3D_SLICE_STATUS, {err, id});
                    }
                );
            });
        }
    );
};

const startListen = () => {
    // Electron picks a free port; dev serves http://localhost:9000
    if (isElectron()) {
        httpServer.on('listening', () => {
            const {port, address} = httpServer.address();
            serverCacheAddress = `http://localhost:${port}/cache/`;
            window.serverAddress = `http://localhost:${port}`;
            window.serverCacheAddress = `http://localhost:${port}/cache/`;
            window.serverFontsAddress = `http://localhost:${port}/fonts/`;
            log.info('server address: ' + window.serverAddress);
            log.info('server cache address: ' + window.serverCacheAddress);
            log.info('server fonts address: ' + window.serverFontsAddress);
        });
        httpServer.listen(0);
    } else {
        const port = 9000;
        httpServer.listen(port);
        serverCacheAddress = `http://localhost:${port}/cache/`;
        log.info('server address: ' + `http://localhost:${port}`);
        log.info('server cache address: ' + `http://localhost:${port}/cache/`);
        log.info('server fonts address: ' + `http://localhost:${port}/fonts/`);
    }
};

const startServer = () => {
    // Say which level is in force, so a quiet log is never mistaken for a broken one.
    log.info(`log level: ${log.level} (set ARMS_LOG to error, warn, info or debug)`);
    setupHttpServer();
    setupSocket();
    startListen();
};

export default startServer;
