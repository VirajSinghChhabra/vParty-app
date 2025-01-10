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

        // Wait for peer to be assigned ID before proceeding
        this.peer.on('open', (id) => {
            this.peerId = id;
            console.log('Received peer ID:', id);
            if (this.isHost) {
                this.emit('ready', id);
            }
        });
    }

    setVideoPlayer(player) {
        this.videoPlayer = player;
        console.log('Video player set:', !!player);
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
        this.peer.on('connection', (conn) => {
            console.log('Received connection from peer');
            if (this.connection) {
                conn.close();
                return;
            }
            this.connection = conn;
            this.bindConnectionListeners(conn);
        });
    }

    async initializePeer(hostPeerId) {
        console.log(`Connecting to host: ${hostPeerId}`);
        const conn = this.peer.connect(hostPeerId, {
            reliable: true
        });
        
        return new Promise((resolve, reject) => {
            conn.on('open', () => {
                this.connection = conn;
                this.connectionOpen = true;
                this.bindConnectionListeners(conn);
                resolve();
            });
            
            conn.on('error', reject);
            
            // Add timeout
            setTimeout(() => reject(new Error('Connection timeout')), 10000);
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
    async handleCommand(data) {
        try {
            console.log('Handling command:', data);
            switch (data.type) {
                case 'REQUEST_TIME_SYNC':
                    if (this.isHost && this.videoPlayer) {
                        try {
                            const currentTime = await this.videoPlayer.getCurrentTime();
                            const isPaused = await this.videoPlayer.isPaused();
                            console.log('Host sending time update:', { currentTime, isPaused });
                            
                            if (this.connection && this.connectionOpen) {
                                this.sendCommand('TIME_UPDATE', {
                                    currentTime,
                                    isPaused,
                                    timestamp: Date.now()
                                });
                                console.log('Time update sent to peer');
                            } else {
                                console.error('Cannot send time update - no connection');
                            }
                        } catch (error) {
                            console.error('Error getting current time:', error);
                        }
                    }
                    break;
    
                case 'TIME_UPDATE':
                    if (!this.isHost && this.videoPlayer) {
                        try {
                            console.log('Peer received time update:', data);
                            await this.videoPlayer.seek(data.currentTime);
                            console.log('Successfully seeked to time:', data.currentTime);
                            
                            if (data.isPaused) {
                                await this.videoPlayer.pause();
                                console.log('Video paused after sync');
                            } else {
                                await this.videoPlayer.play();
                                console.log('Video played after sync');
                            }
                        } catch (error) {
                            console.error('Failed to sync time and state:', error);
                        }
                    }
                    break;
        
                case 'PLAY':
                    if (!this.isHost && this.videoPlayer) {
                        try {
                            await this.videoPlayer.play();
                            console.log('Video played by command');
                        } catch (error) {
                            console.error('Failed to play:', error);
                        }
                    }
                    break;
    
                case 'PAUSE':
                    if (!this.isHost && this.videoPlayer) {
                        try {
                            await this.videoPlayer.pause();
                            console.log('Video paused by command');
                        } catch (error) {
                            console.error('Failed to pause:', error);
                        }
                    }
                    break;
    
                case 'SEEK':
                    if (!this.isHost && this.videoPlayer) {
                        try {
                            await this.videoPlayer.seek(data.time);
                            console.log('Video seeked to:', data.time);
                        } catch (error) {
                            console.error('Failed to seek:', error);
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error('Failed to handle command:', error);
        }
    }

    // Handle send commands
    sendCommand(type, data) {
        if (!this.connection || !this.connectionOpen) {
            console.error('Cannot send command - no active connection');
            return;
        }
        const message = { type, ...data };
        console.log('Sending command:', message);
        try {
            this.connection.send(message);
            console.log('Command sent successfully');
        } catch (error) {
            console.error('Failed to send command:', error);
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
            this.eventHandlers[event].forEach(handler => handler(data));
        }
    }

    close() {
        if (this.connection) {
            this.connection.close();
            this.connection = null;
            this.connectionOpen = false;
        }
        if (this.peer) {
            this.peer.destroy();
        }
        this.emit('disconnected');
    }
}
