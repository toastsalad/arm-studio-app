const {app, BrowserWindow, shell, Menu, globalShortcut, powerSaveBlocker, ipcMain, session} = require('electron');
const path = require('path');

const copyCommand = 'CommandOrControl+C';
const pasteCommand = 'CommandOrControl+V'

// Keep the app fully offline: only file://, data:, blob: and the bundled localhost server pass.
function setUpOfflineFilter() {
    try {
        const isLocal = (url) => {
            if (!url) return true;
            if (/^(file|data|blob|devtools|chrome-extension|about):/.test(url)) return true;
            try {
                const hostname = new URL(url).hostname;
                return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
            } catch (e) { return false; }
        };
        session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
            callback({ cancel: !isLocal(details.url) });
        });
    } catch (e) {
        console.error('Arm Studio offline filter failed:', e);
    }
}

function createWindow() {
    // No application menu: its only entries were reload/devtools.
    Menu.setApplicationMenu(null);
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 768,
        minWidth: 850,
        minHeight: 400,
        title: 'Arm Studio',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, './build-server/startLocalServer.js'),
            // The app's preload and renderer share globals (window.serverAddress)
            // and the renderer bundle is not context-isolated, so keep these.
            nodeIntegration: true,
            contextIsolation: false,
        },
        devTools: true,
    });
    mainWindow.loadFile(path.join(__dirname, './build-web/index.html'))

    // Open every external link in the default OS browser.
    mainWindow.webContents.setWindowOpenHandler(({url}) => {
        shell.openExternal(url);
        return {action: 'deny'};
    });

    return mainWindow
}

let mainWindow = null

// The server (preload) needs the userData path; Electron 14+ removed the
// renderer-side `remote` module, so provide it over sync IPC instead.
ipcMain.on('arm-studio:userData', (event) => {
    event.returnValue = app.getPath('userData');
});

// This method will be called when Electron has finished initialization and is ready to create
// browser windows.
app.whenReady().then(() => {
    setUpOfflineFilter();
    mainWindow = createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    })
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('browser-window-focus', () => {
    if (process.platform !== 'darwin' || !mainWindow) return
    globalShortcut.register(copyCommand, () => mainWindow.webContents.copy())
    globalShortcut.register(pasteCommand, () => mainWindow.webContents.paste())
})

app.on('browser-window-blur', () => {
    if (process.platform !== 'darwin') return;
    globalShortcut.unregisterAll()
})

app.on('will-quit', () => {
    if (process.platform !== 'darwin') return;
    globalShortcut.unregisterAll();
})

const blockerId = powerSaveBlocker.start('prevent-app-suspension')
console.log(`powerSaveBlocker ${powerSaveBlocker.isStarted(blockerId)}`)
