import io from 'socket.io-client';

class SocketClientManager {
    constructor() {
        this.socketClient = null;
        this.isSocketConnected = false;
    }

    initSocketClient(serverAddress) {
        this.socketClient = io(serverAddress);
        this.socketClient.on('connect', () => {
            this.isSocketConnected = true;
        });
        this.socketClient.on('disconnect', () => {
            this.isSocketConnected = false;
        });
    }

    // Emit an event to the server through this.socketClient.
    emitToServer(eventName, data, ack) {
        if (this.isSocketConnected) {
            this.socketClient.emit(eventName, data, ack);
            return true;
        }

        return false;
    }

    // Returns the wrapper that was registered, so it can be passed back to
    // removeServerListener().
    addServerListener(eventName, listener) {
        const wrapper = (data) => {
            listener(data);
        };
        this.socketClient.on(eventName, wrapper);
        return wrapper;
    }

    removeServerListener(eventName, listener) {
        // The listener was registered through a client that may since have gone: a disposed drawing is not an
        // error, and this is the first thing dispose() calls, so throwing here used to leave drawings on the
        // canvas when Clear was pressed.
        if (!this.socketClient) return;
        this.socketClient.off(eventName, listener);
    }

    removeAllServerListener(eventName) {
        if (!this.socketClient) return;
        this.socketClient.off(eventName)
    }
}

const socketClientManager = new SocketClientManager();

export default socketClientManager;
