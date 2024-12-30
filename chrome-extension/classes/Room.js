// Idea is to create a "Room" as a concrete thing for all peers/users to start/leave which will store all the information 
// about the connection state and peer's information, whether or not the popup is open or not. 
// The last method didn't work so i hope this does, the deadline's nearing. Extremely tired but won't quit eh. 
class Room {
    constructor(peerId, peer, connection = null) {
        this.peerId = peerId;
        this.peer = peer;
        this.connection = connection;
        this.isHost = connection === null;
        this.connectionCallbacks = new Map();
        this.bindEventListeners();
        this.connectionManager = new ConnectionManager(this);
    }

    bindEventListeners() {
        this.peer.on('error', (err) => {
            console.error('Peer error:', err);
            this.emit('error', err);
        });

        this.peer.on('disconnected', () => {
            console.log('Peer disconnected');
            this.emit('disconnected');
        });

        if (!this.connection) {
            this.peer.on('connection', this.handleNewConnection.bind(this));
        } else {
            this.bindConnectionListeners(this.connection);
        }
    }

    handleNewConnection(connection) {
        if (this.connection && this.connection.open) {
            console.log('Rejecting new connection - already connected');
            connection.close();
            return;
        }

        console.log('New connection received');
        this.connection = connection;
        this.bindConnectionListeners(connection);
    }

    bindConnectionListeners(connection) {
        connection.on('open', () => {
            console.log('Connection opened');
            this.emit('connected');
        });

        connection.on('close', () => {
            console.log('Connection closed');
            this.connection = null;
            this.emit('connectionClosed');
        });

        connection.on('data', (data) => {
            this.emit('data', data);
        });
    }

    send(data) {
        if (this.connection && this.connection.open) {
            this.connection.send(data);
        }
    }

    on(event, callback) {
        if (!this.connectionCallbacks.has(event)) {
            this.connectionCallbacks.set(event, []);
        }
        this.connectionCallbacks.get(event).push(callback);
    }

    emit(event, data) {
        const callbacks = this.connectionCallbacks.get(event) || [];
        callbacks.forEach(callback => callback(data));
    }

    close() {
        if (this.connection) {
            this.connection.close();
        }
        this.peer.destroy();
    }

    get isConnected() {
        return this.connection && this.connection.open;
    }

    static async create() {
        return new Promise((resolve, reject) => {
            const peer = new Peer();
            peer.on('open', (id) => {
                resolve(new Room(id, peer));
            });
            peer.on('error', reject);
        });
    }

    static async join(hostPeerId) {
        return new Promise((resolve, reject) => {
            const peer = new Peer();
            peer.on('open', (id) => {
                const connection = peer.connect(hostPeerId);
                resolve(new Room(hostPeerId, peer, connection));
            });
            peer.on('error', reject);
        });
    }
}