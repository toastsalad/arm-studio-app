import fs from 'fs';
import os from 'os';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import childProcess from 'child_process';
import {CURA_ENGINE_PATH, CURA_ENGINE_VERSION} from './init.js';
import {log} from '../../shared/log.mjs';

// CuraEngine is AGPL-3.0, so it is not shipped with this app. On first use of 3D printing the
// user is offered a download of Ultimaker's own release; the release asset is checked against a
// SHA-256 recorded here and only the slicer engine and the libraries it links against are kept.
//
// Only Ultimaker's release page is contacted, only when the user clicks Download (see the
// P3D_ENGINE_INSTALL handler in start-server.js). Everything else in the app stays offline.

export const CURA_ENGINE_RELEASE_PAGE =
    `https://github.com/Ultimaker/Cura/releases/tag/${CURA_ENGINE_VERSION}`;

// The whole Cura release is the only official distribution that carries the engine, so the
// download is the platform installer and the engine is unpacked out of it.
const RELEASE_BASE = `https://github.com/Ultimaker/Cura/releases/download/${CURA_ENGINE_VERSION}`;

const ASSETS = {
    linux: {
        filename: `ArmStudio-CuraEngine-${CURA_ENGINE_VERSION}-linux.AppImage`,
        url: `${RELEASE_BASE}/UltiMaker-Cura-${CURA_ENGINE_VERSION}-linux-X64.AppImage`,
        sha256: '100f068127b2598167f00ba4db0e0699ded45adf97bbab2d22ff171a1e1ecc40',
        bytes: 334154232,
        // sha256 of the engine binary inside the release, checked again after unpacking.
        engineSha256: '949df48874258ff342b5369853515a93d52fa79448aab050d28ceffe16537f4b',
    },
    win32: {
        filename: `ArmStudio-CuraEngine-${CURA_ENGINE_VERSION}-windows.exe`,
        url: `${RELEASE_BASE}/UltiMaker-Cura-${CURA_ENGINE_VERSION}-win64-X64.exe`,
        sha256: '6edb3c4394e6e4ec6b6b00f3e96d70e1ea53652c57a9626b58f8fda56e291aa6d',
        bytes: 165382744,
        engineSha256: '36e36d4618cd09a0cd8802a565c2cdbe54804eb750ac84303a0c6d6f784afde2',
    },
};

// The files the engine needs beyond itself: its own shared libraries on Linux, the MSVC runtime
// and the same libraries as DLLs on Windows. Names as the release lays them out.
const LINUX_PATTERNS = ['CuraEngine', 'libArcus.so*', 'libpolyclipping.so*', 'libtbb*.so*',
    'libssl.so.3', 'libcrypto.so.3'];
const WIN_FILES = ['CuraEngine.exe', 'Arcus.dll', 'polyclipping.dll', 'tbb12.dll', 'tbbbind_2_5.dll',
    'tbbmalloc.dll', 'tbbmalloc_proxy.dll', 'MSVCP140.dll', 'MSVCP140_ATOMIC_WAIT.dll',
    'VCRUNTIME140.dll', 'VCRUNTIME140_1.dll'];

// Where an installed copy of the same Cura release keeps the engine, so a user who already has
// Cura does not have to download it again.
const INSTALLED_CURA_DIRS = () => {
    if (process.platform === 'win32') {
        const names = [`UltiMaker Cura ${CURA_ENGINE_VERSION}`, `UltiMaker Cura ${CURA_ENGINE_VERSION.split('.').slice(0, 2).join('.')}`];
        const roots = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)'],
            process.env['LocalAppData'] && path.join(process.env['LocalAppData'], 'Programs')].filter(Boolean);
        const dirs = [];
        for (const root of roots) for (const name of names) dirs.push(path.join(root, name));
        return dirs;
    }
    return [`${process.env.HOME || ''}/.local/share/applications/CuraEngine-${CURA_ENGINE_VERSION}`];
};

const listeners = new Set();
const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

let installing = null;
let installProgress = {received: 0, total: 0};
let lastError = null;

const notify = () => {
    const status = engineStatus();
    for (const listener of listeners) {
        try {
            listener(status);
        } catch (e) { /* a closed socket must not break the install */ }
    }
};

const isUsableEngine = (enginePath) => {
    if (!enginePath) return false;
    try {
        // Anything smaller than a megabyte is a truncated download or a placeholder file.
        return fs.statSync(enginePath).isFile() && fs.statSync(enginePath).size > 1024 * 1024;
    } catch (e) {
        return false;
    }
};

const engineSubdir = () => path.dirname(CURA_ENGINE_PATH);

export const engineStatus = () => {
    const status = {
        version: CURA_ENGINE_VERSION,
        downloadPage: CURA_ENGINE_RELEASE_PAGE,
        platformSupported: !!ASSETS[process.platform],
        // Bytes of the release asset, so the UI can warn about the size before the click.
        downloadBytes: ASSETS[process.platform] ? ASSETS[process.platform].bytes : 0,
    };
    if (installing) {
        const total = installProgress.total || status.downloadBytes;
        return {
            ...status,
            state: 'downloading',
            progress: total ? Math.min(installProgress.received / total, 0.99) : 0,
            received: installProgress.received,
            total,
        };
    }
    if (isUsableEngine(CURA_ENGINE_PATH)) return {...status, state: 'ready'};
    if (lastError) return {...status, state: 'error', error: lastError};
    return {...status, state: 'missing'};
};

const run = (command, args, options = {}) => new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, args, {...options, stdio: ['ignore', 'ignore', 'pipe']});
    let stderr = '';
    child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`${path.basename(command)} did not finish within 10 minutes`));
    }, 10 * 60 * 1000);
    child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
    });
    child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) return resolve();
        reject(new Error(`${path.basename(command)} exited with code ${code}: ${stderr.trim().slice(-400)}`));
    });
});

const sha256File = (filePath) => new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
        .on('data', (chunk) => hash.update(chunk))
        .on('error', reject)
        .on('end', () => resolve(hash.digest('hex')));
});

const download = (url, destPath, onProgress, redirectsLeft = 10) => new Promise((resolve, reject) => {
    const request = https.get(url, {headers: {'User-Agent': `ArmStudio/${CURA_ENGINE_VERSION}`}}, (response) => {
        const {statusCode, headers} = response;
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
            response.resume();
            if (redirectsLeft <= 0) {
                reject(new Error('Too many redirects downloading CuraEngine'));
                return;
            }
            resolve(download(new URL(headers.location, url).toString(), destPath, onProgress, redirectsLeft - 1));
            return;
        }
        if (statusCode !== 200) {
            response.resume();
            reject(new Error(`Download failed: HTTP ${statusCode} from ${url}`));
            return;
        }
        const total = Number(headers['content-length']) || 0;
        const hash = crypto.createHash('sha256');
        const out = fs.createWriteStream(destPath);
        let received = 0;
        let settled = false;
        const fail = (error) => {
            if (settled) return;
            settled = true;
            out.destroy();
            fs.rm(destPath, {force: true}, () => reject(error));
        };
        response.on('data', (chunk) => {
            hash.update(chunk);
            received += chunk.length;
            onProgress(received, total);
        });
        response.on('error', fail);
        out.on('error', fail);
        out.on('finish', () => {
            if (settled) return;
            settled = true;
            resolve({sha256: hash.digest('hex'), bytes: received});
        });
        response.pipe(out);
    });
    request.on('error', reject);
    request.setTimeout(120000, () => request.destroy(new Error('Download timed out')));
});

const copyTreeFlat = (sourceDir, destDir, keep) => {
    fs.mkdirSync(destDir, {recursive: true});
    for (const name of fs.readdirSync(sourceDir)) {
        if (!keep(name)) continue;
        const from = path.join(sourceDir, name);
        // The release lays some libraries out as symlinks; copy the target under the soname so the
        // install does not depend on symlinks surviving the copy.
        const real = fs.realpathSync(from);
        if (!fs.statSync(real).isFile()) continue;
        fs.copyFileSync(real, path.join(destDir, name));
    }
};

const unpackLinux = async (assetPath, workDir) => {
    fs.chmodSync(assetPath, 0o755);
    const extractDir = path.join(workDir, 'extract');
    fs.mkdirSync(extractDir, {recursive: true});
    // The AppImage's own runtime unpacks its squashfs image; this needs no FUSE and no extra tool.
    for (const pattern of LINUX_PATTERNS) {
        await run(assetPath, ['--appimage-extract', pattern], {cwd: extractDir});
    }
    const root = path.join(extractDir, 'squashfs-root');
    copyTreeFlat(root, engineSubdir(), (name) => /^(CuraEngine|lib.+\.so.*)$/.test(name));
    fs.chmodSync(CURA_ENGINE_PATH, 0o755);
};

const unpackWindows = async (assetPath, workDir) => {
    const target = path.join(workDir, 'install');
    // NSIS silent install into a temporary directory; /D must be the last argument and unquoted.
    await run(assetPath, ['/S', `/D=${target}`], {cwd: workDir});
    if (!fs.existsSync(path.join(target, 'CuraEngine.exe'))) {
        throw new Error('The Cura installer did not produce CuraEngine.exe (it may need administrator rights)');
    }
    fs.mkdirSync(engineSubdir(), {recursive: true});
    for (const name of WIN_FILES) {
        const from = path.join(target, name);
        if (fs.existsSync(from)) fs.copyFileSync(from, path.join(engineSubdir(), name));
    }
};

// An installed Cura of the same version already has the engine; use it instead of downloading.
const adoptInstalledCura = () => {
    if (!CURA_ENGINE_PATH) return false;
    const exe = process.platform === 'win32' ? 'CuraEngine.exe' : 'CuraEngine';
    for (const dir of INSTALLED_CURA_DIRS()) {
        const candidate = path.join(dir, exe);
        if (!isUsableEngine(candidate)) continue;
        fs.mkdirSync(engineSubdir(), {recursive: true});
        if (process.platform === 'win32') {
            for (const name of WIN_FILES) {
                const from = path.join(dir, name);
                if (fs.existsSync(from)) fs.copyFileSync(from, path.join(engineSubdir(), name));
            }
        } else {
            fs.copyFileSync(candidate, CURA_ENGINE_PATH);
            fs.chmodSync(CURA_ENGINE_PATH, 0o755);
        }
        log.info(`using the CuraEngine from the Cura installation at ${dir}`);
        return isUsableEngine(CURA_ENGINE_PATH);
    }
    return false;
};

const downloadAndUnpack = async (asset) => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'armstudio-cura-'));
    const assetPath = path.join(workDir, asset.filename);
    try {
        installProgress = {received: 0, total: asset.bytes};
        notify();
        let lastEmit = 0;
        const result = await download(asset.url, assetPath, (received, total) => {
            installProgress = {received, total: total || asset.bytes};
            const now = Date.now();
            if (now - lastEmit > 250) {
                lastEmit = now;
                notify();
            }
        });
        if (result.sha256 !== asset.sha256) {
            throw new Error(`CuraEngine download is corrupt: expected SHA-256 ${asset.sha256}, got ${result.sha256}`);
        }
        if (process.platform === 'win32') {
            await unpackWindows(assetPath, workDir);
        } else {
            await unpackLinux(assetPath, workDir);
        }
        const unpacked = await sha256File(CURA_ENGINE_PATH);
        if (unpacked !== asset.engineSha256) {
            fs.rmSync(path.dirname(CURA_ENGINE_PATH), {recursive: true, force: true});
            throw new Error(`CuraEngine unpacked to an unexpected binary (SHA-256 ${unpacked})`);
        }
        log.info(`CuraEngine ${CURA_ENGINE_VERSION} installed at ${CURA_ENGINE_PATH}`);
    } finally {
        fs.rmSync(workDir, {recursive: true, force: true});
    }
};

export const installEngine = () => {
    if (installing) return installing;
    lastError = null;
    const run = async () => {
        try {
            if (!ASSETS[process.platform]) {
                throw new Error(`CuraEngine downloads are not set up for ${process.platform}`);
            }
            if (!adoptInstalledCura()) {
                await downloadAndUnpack(ASSETS[process.platform]);
            }
        } catch (error) {
            lastError = error.message;
            log.error('CuraEngine install failed:', error);
        } finally {
            // Cleared before the status is read, or the caller sees its own install still running.
            installing = null;
            notify();
        }
        return engineStatus();
    };
    installing = run();
    notify();
    return installing;
};

// The Linux binary in Ultimaker's release names its loader as a relative path ("lib64/..."), which
// only resolves from inside an extracted AppImage. Run it through the system loader with the
// installed libraries first instead of relying on the working directory.
export const spawnEngine = (args) => {
    const engineDir = engineSubdir();
    if (process.platform === 'linux') {
        const loader = ['/lib64/ld-linux-x86-64.so.2',
            '/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2', '/lib/ld-linux-x86-64.so.2',
            '/usr/lib64/ld-linux-x86-64.so.2'].find((candidate) => fs.existsSync(candidate));
        if (loader) {
            return childProcess.spawn(loader, ['--library-path', engineDir, CURA_ENGINE_PATH, ...args]);
        }
    }
    return childProcess.spawn(CURA_ENGINE_PATH, args, {
        cwd: engineDir,
        env: {...process.env, LD_LIBRARY_PATH: engineDir + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : '')},
    });
};

export {subscribe};
