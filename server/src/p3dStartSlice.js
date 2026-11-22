import fs from 'fs';
import path from 'path';
import {
    CACHE_DIR,
    P3D_DIR_CONFIG_PRINT_SETTINGS,
    P3D_DIR_CONFIG_MATERIAL_SETTINGS,
    P3D_DIR_CONFIG,
    P3D_FILE_CONFIG_MACHINE_SETTING
} from './init.js';
import {CURA_ENGINE_RELEASE_PAGE, engineStatus, spawnEngine} from './curaEngine.js';
import {log} from '../../shared/log.mjs';

// data: {stlUrl, materialSettingFilename, printSettingFilename, id}; stlUrl like
// http://localhost:9000/cache/1591695065752.stl
const preHandle = (data) => {
    const {stlUrl, materialSettingFilename, printSettingFilename} = data;
    const materialSettingFilePath = path.join(P3D_DIR_CONFIG_MATERIAL_SETTINGS, materialSettingFilename);
    const printSettingFilePath = path.join(P3D_DIR_CONFIG_PRINT_SETTINGS, printSettingFilename);

    const configFilename = "active.def.json";
    const configFilePath = path.join(P3D_DIR_CONFIG, configFilename);

    if (!fs.existsSync(materialSettingFilePath)) {
        log.warn("materialSettingFilePath not exist");
        return;
    }
    if (!fs.existsSync(printSettingFilePath)) {
        log.warn("printSettingFilePath not exist");
        return;
    }

    const contentMaterialSetting = JSON.parse(fs.readFileSync(materialSettingFilePath, 'utf8'));
    const contentPrintSetting = JSON.parse(fs.readFileSync(printSettingFilePath, 'utf8'));
    const contentMachineSetting = JSON.parse(fs.readFileSync(P3D_FILE_CONFIG_MACHINE_SETTING, 'utf8'));

    contentPrintSetting.settings.material = contentMaterialSetting.material;
    contentPrintSetting.settings.machine_settings = contentMachineSetting.machine_settings;

    fs.writeFileSync(configFilePath, JSON.stringify(contentPrintSetting, null, 2));

    const items = stlUrl.split("/");
    const modelName = items[items.length - 1];
    const modelPath = path.join(CACHE_DIR, modelName);

    const now = new Date();
    const gcodeName = [now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()].join("") + ".gcode";
    const gcodePath = path.join(CACHE_DIR, gcodeName);

    return {configPath: configFilePath, modelPath, gcodePath, gcodeName}
};

const callCuraEngine = (modelPath, activatedSettingPath, gcodePath) => {
    // CuraEngine 5.x skips a setting's own value when it has children (Arachne's
    // min_wall_line_width, top_bottom_thickness, ...), so ask it to read those too.
    return spawnEngine(
        ['slice', '-v', '-p', '--force-read-parent', '-j', activatedSettingPath, '-o', gcodePath, '-l', modelPath]
    );
};

// data: {stlUrl, materialSettingFilename, printSettingFilename, id}
const p3dStartSlice = (data, onProgress, onSucceed, onError) => {
    log.debug('server start slicing')

    let configPath, modelPath, gcodePath, gcodeName;
    try {
        ({configPath, modelPath, gcodePath, gcodeName} = preHandle(data));
    } catch (err) {
        log.error('slice setup failed:', err);
        onError(`Slice setup failed: ${err.message}`);
        return;
    }
    log.debug(configPath, modelPath, gcodePath, gcodeName)

    let progress = 0, filamentLength, filamentWeight, printTime;
    if (engineStatus().state !== 'ready') {
        // The 3D print panel disables slicing until the engine is installed, so this is the guard
        // for a direct socket call, not the normal path. Never crash: report why and link the page.
        onError(`CuraEngine is not installed. Download it from ${CURA_ENGINE_RELEASE_PAGE} ` +
            `(3D Print panel > Download CuraEngine).`);
        return;
    }
    if (!fs.existsSync(configPath)) {
        onError(`Slice Error: file not exist ->  ${configPath}`);
        return;
    }
    if (!fs.existsSync(modelPath)) {
        onError(`Slice Error: file not exist -> ${modelPath}`);
        return;
    }

    const engineProcess = callCuraEngine(modelPath, configPath, gcodePath);

    // CuraEngine 5.x logs to stdout, 4.6.2 to stderr; parse both.
    const handleOutput = (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const item of lines) {
            // CuraEngine 5.x logs through spdlog, so values carry a "[timestamp] [level]"
            // prefix instead of starting the line.
            const layer = item.match(/layer (\d+) of (\d+)/);
            if (layer) {
                const done = (Number(layer[1]) + 1) / Number(layer[2]);
                if (done > progress) {
                    progress = done;
                    onProgress(Math.min(done, 0.99));
                }
                continue;
            }
            const filamentAt = item.indexOf(';Filament used: ');
            if (filamentAt !== -1) {
                filamentLength = Number(item.slice(filamentAt + 16).replace('m', '').trim());
                filamentWeight = Math.PI * (1.75 / 2) * (1.75 / 2) * filamentLength * 1.24;
                continue;
            }
            const timeAt = item.indexOf('Print time (s):');
            if (timeAt !== -1) {
                printTime = Number(item.slice(timeAt + 15).trim()) * 1.07; // empirical factor
            }
        }
    };
    engineProcess.stdout.on('data', handleOutput);
    engineProcess.stderr.on('data', handleOutput);

    engineProcess.on('error', (err) => {
        log.error('failed to start CuraEngine:', err);
        onError(`Failed to start CuraEngine: ${err.message}`);
    });

    engineProcess.on('close', (code) => {
        if (filamentLength && filamentWeight && printTime) {
            onProgress(1);
            onSucceed({
                gcodeName,
                printTime,
                filamentLength,
                filamentWeight,
                gcodePath
            });
            return;
        }
        // Nothing parsed from the engine output: report it rather than leave the client
        // waiting forever for a result that will never come.
        const message = `Slicing produced no result (exit code ${code}; ` +
            `filament=${filamentLength}, printTime=${printTime})`;
        log.error(message);
        onError(message);
    });
};

export default p3dStartSlice;
