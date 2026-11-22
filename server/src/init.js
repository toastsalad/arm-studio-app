import fs from 'fs';
import path from 'path';
import electron from 'electron';
import {isElectron} from './utils/index.js';
import {log} from '../../shared/log.mjs';

let CURA_ENGINE_PATH;
const curaEngineBasePath = path.join(__dirname, '..', 'CuraEngine', '5.13.0');
const STATIC_DIR = path.join(__dirname, '..', 'static');
const BUILD_IN_FONTS_DIR = path.join(__dirname, '..', 'static', 'fonts');

// Everything the app writes goes to the user data dir: a packaged Linux build
// runs from a read-only AppImage mount, so creating a directory inside the app
// directory threw during preload load and left the window in its error state.
const USER_DATA_DIR = isElectron()
    ? electron.ipcRenderer.sendSync('arm-studio:userData')
    : path.join(__dirname, '..', 'static');

const USER_FONTS_DIR = path.join(USER_DATA_DIR, 'userFonts');
const CACHE_DIR = path.join(USER_DATA_DIR, 'cache');

const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

// Cura settings are edited in the app and rewritten for every slice, so a
// packaged build keeps a writable copy in the user data dir. Running the server
// on its own (no Electron) uses the working-tree copy in place.
const BUNDLED_P3D_DIR_CONFIG = path.join(__dirname, '..', 'CuraEngine', 'config');
const P3D_DIR_CONFIG = isElectron()
    ? path.join(USER_DATA_DIR, 'CuraEngine', 'config')
    : BUNDLED_P3D_DIR_CONFIG;
const P3D_DIR_CONFIG_MATERIAL_SETTINGS = path.join(P3D_DIR_CONFIG, 'material_settings');
const P3D_DIR_CONFIG_PRINT_SETTINGS = path.join(P3D_DIR_CONFIG, 'print_settings');
const P3D_FILE_CONFIG_MACHINE_SETTING = path.join(P3D_DIR_CONFIG, 'machine_setting', 'machine_setting.def.json');

// Copy files the user data copy does not have yet; existing files are the user's
// settings and are left alone.
const seedDirectory = (src, dest) => {
    fs.mkdirSync(dest, {recursive: true});
    for (const name of fs.readdirSync(src)) {
        const from = path.join(src, name);
        const to = path.join(dest, name);
        if (fs.statSync(from).isDirectory()) {
            seedDirectory(from, to);
        } else if (!fs.existsSync(to)) {
            fs.copyFileSync(from, to);
        }
    }
};

(() => {
    switch (process.platform) {
        case 'darwin':
            CURA_ENGINE_PATH = path.join(curaEngineBasePath, 'macOS', 'CuraEngine');
            break;
        case 'win32':
            CURA_ENGINE_PATH = path.join(curaEngineBasePath, 'Win-x64', 'CuraEngine.exe');
            break;
        case 'linux':
            CURA_ENGINE_PATH = path.join(curaEngineBasePath, 'Linux-x64', 'CuraEngine');
            break;
    }
    if (!fs.existsSync(CURA_ENGINE_PATH)) {
        log.error(`Cura Engine not found: ${CURA_ENGINE_PATH}`);
    }

    fs.mkdirSync(CACHE_DIR, {recursive: true});
    // Prune old uploads rather than clearing the whole cache: a second instance
    // starting up must not invalidate the files a running instance still refers
    // to.
    for (const name of fs.readdirSync(CACHE_DIR)) {
        const filePath = path.join(CACHE_DIR, name);
        try {
            if (Date.now() - fs.statSync(filePath).mtimeMs > MAX_CACHE_AGE_MS) {
                fs.unlinkSync(filePath);
            }
        } catch (e) { /* ignore */ }
    }
    fs.mkdirSync(USER_FONTS_DIR, {recursive: true});
    if (P3D_DIR_CONFIG !== BUNDLED_P3D_DIR_CONFIG) {
        seedDirectory(BUNDLED_P3D_DIR_CONFIG, P3D_DIR_CONFIG);
    }
})();

export {
    CURA_ENGINE_PATH,
    STATIC_DIR,
    CACHE_DIR,
    BUILD_IN_FONTS_DIR,
    USER_FONTS_DIR,
    P3D_DIR_CONFIG_PRINT_SETTINGS,
    P3D_DIR_CONFIG_MATERIAL_SETTINGS,
    P3D_DIR_CONFIG,
    P3D_FILE_CONFIG_MACHINE_SETTING,
};
