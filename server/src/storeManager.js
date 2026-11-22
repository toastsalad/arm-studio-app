import path from 'path';
import electron from 'electron'; // ipcRenderer (preload)
import {isElectron} from './utils/index.js';

class StoreManager {
    constructor() {
        //user data
        this.dir_user_data = null;

        // Software data: reset on every update
        this.path_p3d_cura_engine = null;

        if (isElectron()) {
            this.dir_user_data = electron.ipcRenderer.sendSync('arm-studio:userData');
        } else {
            this.dir_user_data = path.join(__dirname, '..', 'static');
        }

        const curaEngineBasePath = path.join(__dirname, '..', 'CuraEngine', '5.13.0');
        switch (process.platform) {
            case 'darwin':
                this.path_p3d_cura_engine = path.join(curaEngineBasePath, 'macOS', 'CuraEngine');
                break;
            case 'win32':
                this.path_p3d_cura_engine = path.join(curaEngineBasePath, 'Win-x64', 'CuraEngine.exe');
                break;
            case 'linux':
                this.path_p3d_cura_engine = path.join(curaEngineBasePath, 'Linux-x64', 'CuraEngine');
                break;
        }
    }
}

const storeManager = new StoreManager();

export default storeManager;
