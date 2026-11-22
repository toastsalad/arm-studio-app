import EventEmitter from 'events';
import net from 'net';
import os from 'os';
import {SerialPort} from 'serialport';
import {ReadlineParser} from '@serialport/parser-readline';
import {
    SERIAL_PORT_PATH_UPDATE,
    SERIAL_PORT_OPEN,
    SERIAL_PORT_CLOSE,
    SERIAL_PORT_ERROR,
    SERIAL_PORT_WRITE_OK,
    SERIAL_PORT_DATA,
    NETWORK_DEVICE_UPDATE,
    NETWORK_DEVICE_INFO,
    NETWORK_JOB_STATUS,
    NETWORK_LEVELING_STATUS,
} from "./constants.js"
import {log} from '../../shared/log.mjs';

const baudRate = 115200;

// Network bridge (ESP32 Wi-Fi <-> UART) defaults
const NET_PORT = 23;
const NET_SCAN_TIMEOUT = 700;   // fast TCP-open probe
const NET_BRIDGE_TIMEOUT = 1500; // !info probe
const NET_SCAN_CONCURRENCY = 128;
// A reply comes from the bridge itself and never reaches the arm, so this poll cannot disturb a job.
const NET_ARM_POLL_MS = 4000;
const NET_INFO_REPLY_WINDOW = 2000; // ignore a "# ...bridge..." line after this

// Network devices use the tcp://host:port scheme, so the rest of the app is transport-agnostic.
const isNetworkPath = (path) => typeof path === 'string' && /^tcp:\/\//i.test(path);

// How often the system port list is re-read, to notice a cable pulled out from under an open port.
const PORT_POLL_MS = 500;

class SerialPortManager extends EventEmitter {
    constructor() {
        super();
        this.serialPort = null;
        this.readLineParser = null;

        // network transport
        this.netSocket = null;
        this.netPath = null;
        this.netBuffer = '';
        this.discovering = false;
        this._found = [];

        // Polled rather than watched: node-serialport has no port-list event. The handle is kept in a field
        // rather than dropped, and unreferenced, so that this poll can never be the reason the process stays
        // alive after the window is gone.
        this._portPoll = setInterval(() => {
            SerialPort.list().then(
                (ports) => {
                    const paths = ports.map(item => {
                        return item.path;
                    });
                    this.emit(SERIAL_PORT_PATH_UPDATE, paths);

                    // Network paths are not in SerialPort.list(), so this only covers serial.
                    if (this.serialPort && this.serialPort.isOpen && !paths.includes(this.serialPort.path)) {
                        log.info("serial port -> close: opened port is pulled out: " + this.serialPort.path);
                        this.emit(SERIAL_PORT_CLOSE, this.serialPort.path);
                        this.serialPort = null;
                    }
                },
                (error) => {
                    this.emit(SERIAL_PORT_ERROR, error);
                }
            )
        }, PORT_POLL_MS)
        if (typeof this._portPoll.unref === 'function') this._portPoll.unref();
    }

    getOpened() {
        if (this.netSocket && !this.netSocket.destroyed) {
            return this.netPath;
        }
        if (this.serialPort && this.serialPort.isOpen) {
            return this.serialPort.path;
        }
        return null;
    }

    _openNew(path) {
        if (isNetworkPath(path)) {
            this._openNetwork(path);
            return;
        }
        this._closeNetwork();

        this.serialPort = new SerialPort({path, baudRate, autoOpen: false});
        const port = this.serialPort;

        this.readLineParser = this.serialPort.pipe(new ReadlineParser({delimiter: '\n'}));
        this.readLineParser.on('data', (data) => {
            this.emit(SERIAL_PORT_DATA, {received: data.trim()});
        });

        this.serialPort.on("open", () => {
            log.info("serial port -> open: " + port.path);
            this.emit(SERIAL_PORT_OPEN, port.path);
        });

        this.serialPort.on("close", () => {
            log.info("serial port -> close: " + port.path);
            if (this.serialPort === port) this.serialPort = null;
            this.emit(SERIAL_PORT_CLOSE, port.path);
        });

        this.serialPort.on("error", () => {
            log.info("serial port -> error: " + port.path);
            if (this.serialPort === port) this.serialPort = null;
            this.emit(SERIAL_PORT_ERROR);
        });

        this.serialPort.open((error) => {
            if (error) {
                if (this.serialPort === port) this.serialPort = null;
                this.emit(SERIAL_PORT_ERROR, error);
            }
        })
    }

    _openNetwork(path) {
        const match = /^tcp:\/\/([^:/]+):(\d+)$/i.exec(path);
        if (!match) {
            this.emit(SERIAL_PORT_ERROR, new Error('Invalid network address: ' + path));
            return;
        }
        const host = match[1];
        const port = parseInt(match[2], 10);

        // Replace whatever is currently open
        this._closeNetwork();
        if (this.serialPort) {
            const previous = this.serialPort;
            this.serialPort = null;
            try { previous.close(); } catch (e) { /* ignore */ }
        }

        this.netPath = path;
        this.netBuffer = '';
        this.netInfo = null;
        this.netInfoAskedAt = 0;
        // Consumers such as gcodeSender read serialPortManager.readLineParser, so give them a
        // parser-like emitter over TCP too.
        this.readLineParser = new EventEmitter();
        const socket = new net.Socket();
        this.netSocket = socket;
        socket.setNoDelay(true);

        // Line-buffered exactly like the ReadlineParser on the serial side.
        socket.on('data', (buffer) => {
            this.netBuffer += buffer.toString('utf8');
            let newlineAt;
            while ((newlineAt = this.netBuffer.indexOf('\n')) >= 0) {
                const line = this.netBuffer.slice(0, newlineAt).replace(/\r$/, '').trim();
                this.netBuffer = this.netBuffer.slice(newlineAt + 1);
                // A "# ...bridge ..." line right after we asked is the bridge answering about the
                // arm, not arm output, so keep it out of the G-code stream.
                if (this._isJobReply(line)) {
                    this._emitJson(NETWORK_JOB_STATUS, line.slice(6));
                    continue;
                }
                if (this._isLevelingReply(line)) {
                    this._emitJson(NETWORK_LEVELING_STATUS, line.slice(8));
                    continue;
                }
                if (this._isBridgeInfoReply(line)) {
                    this.netInfo = this._parseBridgeInfo(line, host);
                    this.netInfoAskedAt = 0;
                    this.emit(NETWORK_DEVICE_INFO, this.netInfo);
                    continue;
                }
                this.emit(SERIAL_PORT_DATA, {received: line});
                if (this.readLineParser) this.readLineParser.emit('data', line);
            }
        });

        socket.on('connect', () => {
            log.info("network port -> open: " + path);
            this.emit(SERIAL_PORT_OPEN, path);
            this._requestBridgeInfo();
            this._armPoll = setInterval(() => this._requestBridgeInfo(), NET_ARM_POLL_MS);
        });

        socket.on('close', () => {
            log.info("network port -> close: " + path);
            if (this.netSocket === socket) {
                this._stopArmPoll();
                this.netSocket = null;
                this.netPath = null;
                this.netInfo = null;
                this.emit(NETWORK_DEVICE_INFO, null);
                this.emit(SERIAL_PORT_CLOSE, path);
            }
        });

        socket.on('error', (error) => {
            log.info("network port -> error: " + path + " " + error.message);
            if (this.netSocket === socket) {
                this._stopArmPoll();
                this.netSocket = null;
                this.netPath = null;
                this.netInfo = null;
                this.emit(NETWORK_DEVICE_INFO, null);
                this.emit(SERIAL_PORT_ERROR, error);
            }
        });

        socket.connect(port, host);
    }

    _closeNetwork() {
        this._stopArmPoll();
        if (!this.netSocket) return;
        const socket = this.netSocket;
        const path = this.netPath;
        this.netSocket = null;
        this.netPath = null;
        this.netInfo = null;
        try { socket.destroy(); } catch (e) { /* ignore */ }
        // The socket's own 'close' handler skips this because netSocket is already null, so
        // announce it here or a disconnect leaves the UI showing a stale arm state.
        this.emit(NETWORK_DEVICE_INFO, null);
        if (path) this.emit(SERIAL_PORT_CLOSE, path);
    }

    _stopArmPoll() {
        if (this._armPoll) {
            clearInterval(this._armPoll);
            this._armPoll = null;
        }
        this.netInfoAskedAt = 0;
    }

    _requestBridgeInfo() {
        if (!this.netSocket || this.netSocket.destroyed || !this.netSocket.writable) return;
        this.netInfoAskedAt = Date.now();
        this.netSocket.write('!info\n');
    }

    _isJobReply(line) {
        return /^# job /.test(line);
    }

    _isLevelingReply(line) {
        return /^# level /.test(line);
    }

    _emitJson(event, text) {
        try {
            this.emit(event, JSON.parse(text));
        } catch (e) {
            log.warn('bridge reply was not JSON: ' + text);
        }
    }

    getInfo() {
        return this.netInfo;
    }

    _isBridgeInfoReply(line) {
        if (!this.netInfoAskedAt) return false;
        if (Date.now() - this.netInfoAskedAt > NET_INFO_REPLY_WINDOW) return false;
        return /^#.*\bbridge\b/i.test(line);
    }

    // "arm=up" means the bridge has the arm's serial port open, which a client cannot work out
    // for itself; firmware predating the field reports "unknown" rather than a guess.
    _parseBridgeInfo(text, ip) {
        const pick = (pattern) => {
            const match = pattern.exec(text);
            return match ? match[1] : null;
        };

        const arm = pick(/\barm=(\w+)/i);
        const dev = pick(/\bdev=(\S+)/i);
        const baud = pick(/\bbaud=(\d+)/i);
        const label = pick(/bridge\s*\(([^)]+)\)/i) || pick(/^#\s*([^\s(]+)/m);
        const portRaw = pick(/\bport=(\d+)/i);
        // Port of the bridge's own status page; older firmware does not report it.
        const web = pick(/\bweb=(\d+)/i);
        // Job API port; '-' or absent means the bridge predates the job offload.
        const jobs = pick(/\bjobs=(\d+)/i);
        const ready = pick(/\bready=(\d+)/i);
        const job = pick(/\bjob=(\w+)/i);
        const levelMatch = /\blevel=([-+]?\d*\.?\d+),([-+]?\d*\.?\d+)/i.exec(text);
        // Prefer the port the bridge reports, so a bridge typed in on a non-standard port still
        // matches the path actually open.
        const port = portRaw ? parseInt(portRaw, 10) : NET_PORT;

        return {
            path: `tcp://${ip}:${port}`,
            ip,
            label,
            port,
            baud: baud ? parseInt(baud, 10) : null,
            arm: arm ? arm.toLowerCase() : 'unknown', // 'up' | 'waiting' | 'unknown'
            dev: dev && dev !== '-' ? dev : null,
            web: web ? parseInt(web, 10) : null,
            jobs: jobs ? parseInt(jobs, 10) : null,
            ready: ready === null ? null : ready === '1',
            job: job || null,
            level: levelMatch
                ? {x: parseFloat(levelMatch[1]), y: parseFloat(levelMatch[2])}
                : null,
        };
    }

    // Open a serial path (COMx) or a network path (tcp://host:port).
    open(path) {
        const current = this.getOpened();
        if (current === path) {
            this.emit(SERIAL_PORT_OPEN, path);
            return;
        }
        if (current) {
            this.close();
        }
        this._openNew(path);
    }

    close() {
        this._closeNetwork();
        if (this.serialPort && this.serialPort.isOpen) {
            this.serialPort.close((error) => {
                if (error) {
                    this.emit(SERIAL_PORT_ERROR, error);
                }
            });
        }
    }

    //data: string|Buffer|Array<number>
    write(data) {
        if (this.netSocket && !this.netSocket.destroyed && this.netSocket.writable) {
            let payload = data;
            if (Array.isArray(data)) payload = Buffer.from(data);
            this.netSocket.write(payload, (error) => {
                if (error) {
                    log.error("network write error: " + data);
                    this.emit(SERIAL_PORT_ERROR, error);
                } else {
                    this.emit(SERIAL_PORT_WRITE_OK, data);
                }
            });
            return;
        }

        if (this.serialPort && this.serialPort.isOpen) {
            this.serialPort.write(data, (error) => {
                if (error) {
                    log.error("write error: " + data);
                    this.emit(SERIAL_PORT_ERROR, error);
                } else {
                    this.emit(SERIAL_PORT_WRITE_OK, data);
                }
            });
        } else {
            log.warn("Port is closed");
        }
    }

    // LAN scan for Wi-Fi<->UART bridges: any host on port 23 that answers the "!info" banner.
    discover() {
        if (this.discovering) return;
        this.discovering = true;
        this._found = [];

        const hosts = this._localSubnetHosts();

        this._pool(hosts, NET_SCAN_CONCURRENCY, async (ip) => {
            const open = await this._tcpOpen(ip, NET_PORT, NET_SCAN_TIMEOUT);
            if (!open) return;
            const device = await this._probeBridge(ip);
            if (device) this._found.push(device);
        }).then(() => {
            const found = this._found.slice().sort((left, right) => left.path.localeCompare(right.path));
            this.discovering = false;
            this._found = [];
            log.debug('network discover -> ' + JSON.stringify(found));
            this.emit(NETWORK_DEVICE_UPDATE, found);
        }).catch((error) => {
            this.discovering = false;
            this._found = [];
            this.emit(SERIAL_PORT_ERROR, error instanceof Error ? error : new Error(String(error)));
        });
    }

    _localSubnetHosts() {
        const prefixes = new Set();
        const ifaces = os.networkInterfaces();
        for (const name of Object.keys(ifaces)) {
            for (const info of ifaces[name] || []) {
                if (info.family !== 'IPv4' || info.internal) continue;
                const parts = info.address.split('.');
                if (parts.length !== 4) continue;
                prefixes.add(parts.slice(0, 3).join('.'));
            }
        }
        // Always include the bridge's own AP subnet, in case the PC is on Wi-Fi.
        prefixes.add('192.168.4');
        const hosts = [];
        for (const prefix of prefixes) {
            for (let i = 1; i <= 254; i++) {
                hosts.push(prefix + '.' + i);
            }
        }
        return hosts;
    }

    // Open a TCP socket to host:port, run the optional connect/data hooks, and resolve once one
    // of them finishes or the connection fails.
    _withSocket(ip, port, timeout, {onConnect, onData, failValue = false}) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            let done = false;
            const finish = (value) => {
                if (done) return;
                done = true;
                socket.destroy();
                resolve(value);
            };
            socket.setTimeout(timeout);
            socket.once('connect', () => {
                if (onConnect) onConnect(socket, finish);
                else finish(true);
            });
            if (onData) socket.on('data', (buffer) => onData(buffer, finish));
            socket.once('timeout', () => finish(failValue));
            socket.once('error', () => finish(failValue));
            socket.once('close', () => finish(failValue));
            socket.connect(port, ip);
        });
    }

    _tcpOpen(ip, port, timeout) {
        return this._withSocket(ip, port, timeout, {});
    }

    _probeBridge(ip) {
        let data = '';
        return this._withSocket(ip, NET_PORT, NET_BRIDGE_TIMEOUT, {
            failValue: null,
            onConnect: (socket) => socket.write('!info\n'),
            onData: (buffer, finish) => {
                data += buffer.toString('utf8');
                if (/bridge/i.test(data)) finish(this._parseBridgeInfo(data, ip));
            }
        });
    }

    async _pool(items, concurrency, worker) {
        const queue = items.slice();
        const run = async () => {
            while (queue.length) {
                const item = queue.shift();
                try { await worker(item); } catch (e) { /* ignore per-host errors */ }
            }
        };
        const runners = [];
        for (let i = 0; i < Math.min(concurrency, items.length); i++) runners.push(run());
        await Promise.all(runners);
    }
}

const serialPortManager = new SerialPortManager();

export default serialPortManager;
