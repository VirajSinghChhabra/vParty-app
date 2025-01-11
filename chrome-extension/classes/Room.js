// Idea is to create a "Room" as a concrete thing for all peers/users to start/leave which will store all the information 
// about the connection state and peer's information, whether or not the popup is open or not. 
// The last method didn't work so i hope this does, the deadline's nearing. Extremely tired but won't quit eh. 
class Room {
    constructor(isHost, peerId = null) {
        this.isHost = isHost;
        this.peer = new Peer();
        this.connection = null;
        this.eventHandlers = {};
        this.connectionOpen = false;
        this.videoPlayer = null;
        this.isInParty = false;
        this.connectionPromise = null;

        // Wait for peer to be assigned ID before proceeding
        this.peer.on('open', (id) => {
            this.peerId = id;
            console.log('Room: Peer connection initialized with ID:', id);
            if (this.isHost) {
                this.emit('ready', id);
            }
        });

        this.peer.on('error', (error) => {
            console.error('Room: Peer connection error:', error);
            this.emit('error', error);
        });
    }

    setVideoPlayer(player) {
        this.videoPlayer = player;
        console.log('Room: Video player set:', !!player);
    }

    static async create() {
        return new Promise((resolve, reject) => {
            const room = new Room(true);
            room.on('ready', (peerId) => {
                room.initializeHost()
                    .then(() => {
                        room.isInParty = true;
                        resolve(room);
                    })
                    .catch(reject);
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
                    .then(() => {
                        room.isInParty = true;
                        resolve(room);
                    })
                    .catch(reject);
            });
            setTimeout(() => reject(new Error('Timeout joining room')), 10000);
        });
    }

    async initializeHost() {
        console.log('Room: Initializing as host');
        this.peer.on('connection', (conn) => {
            console.log('Room: Received connection from peer:', conn.peer);
            if (this.connection) {
                console.log('Room: Rejecting additional connection - already connected');
                conn.close();
                return;
            }
            this.handleNewConnection(conn);
        });
    }

    async initializePeer(hostPeerId) {
        console.log('Room: Connecting to host:', hostPeerId);
        this.connectionPromise = new Promise((resolve, reject) => {
            const conn = this.peer.connect(hostPeerId, {
                reliable: true
            });
            
            conn.on('open', () => {
                this.handleNewConnection(conn);
                this.connectionOpen = true;
                console.log('Room: Connection fully established');
                resolve();
            });
            
            conn.on('error', (error) => {
                console.error('Room: Connection error:', error);
                reject(error);
            });

            setTimeout(() => reject(new Error('Connection timeout')), 10000);
        });
        return this.connectionPromise;
    }

    handleNewConnection(connection) {
        console.log('Room: Setting up new connection');
        this.connection = connection;
        this.bindConnectionListeners(connection);
    }

    bindConnectionListeners(connection) {
        connection.on('open', () => {
            console.log('Room: Connection opened');
            this.connectionOpen = true;
            this.emit('connected');
        });

        connection.on('close', () => {
            console.log('Room: Connection closed');
            this.connectionOpen = false;
            this.connection = null;
            this.isInParty = false;
            this.emit('disconnected');
        });

        connection.on('data', (data) => {
            console.log('Room: Received data:', data);
            this.handleCommand(data);
        });

        connection.on('error', (error) => {
            console.error('Room: Connection error:', error);
            this.emit('error', error);
        });
    }

    // Handle incoming commands from peers 
    // Modified to only emit the event for VideoSynchronizer to handle cause event handling was messy
    async handleCommand(data) {
        if (!this.isInParty) {
            console.log('Room: Ignoring command - not in party');
            return;
        }

        try {
            console.log('Room: Processing command:', data);
            
            switch (data.type) {
                case 'REQUEST_TIME_SYNC':
                    this.emit('REQUEST_TIME_SYNC', data);
                    break;

                case 'TIME_UPDATE':
                    this.emit('timeUpdate', data);
                    break;

                case 'PLAY':
                case 'PAUSE':
                case 'SEEK':
                    if (!this.isHost && this.videoPlayer) {
                        this.emit('hostCommand', data);
                    }
                    break;

                default:
                    console.warn('Room: Unknown command type:', data.type);
                    break;
            }
        } catch (error) {
            console.error('Room: Failed to handle command:', error);
        }
    }

    // Handle send commands
    async sendCommand(type, data) {
        if (!this.isInParty) {
            console.log('Room: Not sending command - not in party');
            return;
        }

        // Wait for connection if we're still connecting
        if (this.connectionPromise) {
            try {
                await this.connectionPromise;
            } catch (error) {
                console.error('Room: Failed to establish connection:', error);
                return;
            }
        }

        if (!this.connection || !this.connectionOpen) {
            console.error('Room: Cannot send command - no active connection');
            return;
        }
        
        const message = { type, ...data };
        console.log('Room: Sending command:', message);
        
        try {
            this.connection.send(message);
            console.log('Room: Command sent successfully');
        } catch (error) {
            console.error('Room: Failed to send command:', error);
        }
    }

    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }

    emit(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Room: Error in ${event} event handler:`, error);
                }
            });
        }
    }

    close() {
        console.log('Room: Closing room');
        this.isInParty = false;
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
        if (this.peer) {
            this.peer.destroy();
        }
        this.connectionOpen = false;
        this.emit('disconnected');
    }
}