// Idea is to create a "Room" as a concrete thing for all peers/users to start/leave which will store all the information 
// about the connection state and peer's information, whether or not the popup is open or not. 
// The last method didn't work so i hope this does, the deadline's nearing. Extremely tired but won't quit eh. 
class Room {
    constructor(isHost, peerId = null) {
        this.isHost = isHost;
        this.peer = new Peer(this.peerId);
        this.connection = null;
        this.eventHandlers = {};
        this.connectionOpen = false;
        this.videoPlayer = null;

        // Wait for peer to be assigned ID before proceeding
        this.peer.on('open', (id) => {
            this.peerId = id;
            console.log('Received peer ID:', id);
            if (this.isHost) {
                this.emit('ready', id);
            }
        });

        this.bindEventListeners();
    }

    setVideoPlayer(player) {
        this.videoPlayer = player;
    }


    static async create() {
        return new Promise((resolve, reject) => {
            const room = new Room(true);
            room.on('ready', (peerId) => {
                room.initializeHost();
                resolve(room);
            });
            setTimeout(() => reject(new Error('Timeout creating room')), 10000);
        });
    }

    static async join(peerId) {
        return new Promise((resolve, reject) => {
            if (!peerId) {
                reject(new Error('Invalid peer ID'));
                return;
            }
            const room = new Room(false);
            room.peer.on('open', () => {
                room.initializePeer(peerId)
                    .then(() => resolve(room))
                    .catch(reject);
            });
            setTimeout(() => reject(new Error('Timeout joining room')), 10000);
        });
    }


    async initializeHost() {
        console.log('Initializing room as host...');
        this.peer.on('connection', this.handleNewConnection.bind(this));
        console.log('Room created successfully. Peer ID:', this.peerId);
    }

    async initializePeer(hostPeerId) {
        console.log(`Joining room with peer ID: ${hostPeerId}`);
        this.connection = this.peer.connect(hostPeerId);
        await new Promise((resolve) => {
            this.connection.on('open', () => {
                this.connectionOpen = true;
                this.bindConnectionListeners(this.connection);
                resolve();
            });
        });
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

    bindEventListeners() {
        this.peer.on('error', (err) => {
            console.error('Peer error:', err);
            this.emit('error', err);
        });

        this.peer.on('disconnected', () => {
            console.log('Peer disconnected');
            this.emit('disconnected');
        });
    }

    bindConnectionListeners(connection) {
        connection.on('open', () => {
            console.log('Connection opened');
            this.connectionOpen = true;
            this.emit('connected');
        });

        connection.on('close', () => {
            console.log('Connection closed');
            this.connection = null;
            this.connectionOpen = false;
            this.emit('disconnected');
        });

        connection.on('data', (data) => {
            console.log('Received data:', data);
            this.handleCommand(data);
        });
    }

    // Handle incoming commands from peers
    handleCommand(data) {
        try {
            console.log('Handling command:', data);
            
            switch (data.type) {
                case 'HOST_ACTION':
                    this.emit('hostAction', data);
                    break;
                case 'REQUEST_TIME_SYNC':
                    if (this.isHost && this.videoPlayer) {
                        this.videoPlayer.getCurrentTime().then(currentTime => {
                            this.sendCommand('TIME_UPDATE', { currentTime });
                        });
                    }
                    break;
                case 'TIME_UPDATE':
                    if (!this.isHost) {
                        this.emit('timeUpdate', data);
                    }
                    break;
            }
        } catch (error) {
            console.error('Failed to handle command:', error);
        }
    }

    // Handle send commands
    sendCommand(type, data) {
        if (!this.connectionOpen) {
            console.warn('Command delayed; connection is not open');
            return;
        }
        const message = { type, ...data };
        console.log('Sending command:', message);
        this.connection.send(message);
    }

    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }

    emit(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => handler(data));
        }
    }

    close() {
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
        this.connectionOpen = false;
        if (this.peer) {
            this.peer.destroy();
        }
    }
}