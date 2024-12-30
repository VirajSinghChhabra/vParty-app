// Idea is to create a "Room" as a concrete thing for all peers/users to start/leave which will store all the information 
// about the connection state and peer's information, whether or not the popup is open or not. 
// The last method didn't work so i hope this does, the deadline's nearing. Extremely tired but won't quit eh. 
class Room {
    constructor(isHost, peerId = null) {
        this.isHost = isHost;
        this.peerId = peerId || this.generatePeerId();
        this.peer = new Peer(this.peerId);
        this.connection = null;
        this.eventHandlers = {};
        this.connectionOpen = false;

        this.bindEventListeners();
    }

    static async create() {
        const room = new Room(true);
        await room.initializeHost();
        return room;
    }

    static async join(peerId) {
        const room = new Room(false, peerId);
        await room.initializePeer();
        return room;
    }

    async initializeHost() {
        console.log('Initializing room as host...');
        this.peer.on('connection', this.handleNewConnection.bind(this));
        console.log('Room created successfully. Peer ID:', this.peerId);
    }

    async initializePeer() {
        console.log(`Joining room with peer ID: ${this.peerId}`);
        this.connection = this.peer.connect(this.peerId); 
        this.bindConnectionListeners(this.connection); 
        console.log('Successfully joined room. Connection established.');
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

        // Host-specific behavior: Only listen for connections if no active connection exists 
        // This is for better functionality as current code is implemented for 1 to 1 peer session
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
            this.connectionOpen = true;
            this.emit('connected');
        });

        connection.on('close', () => {
            console.log('Connection closed');
            this.connection = null;
            this.connectionOpen = false;
            this.emit('connectionClosed');
        });

        connection.on('data', (data) => {
            console.log('Data received:', data);
            this.handleCommand(data);
        });
    }

    // Handle incoming commands from peers
    handleCommand(data) {
        try {
            const command = JSON.parse(data);
            console.log('Received command:', command);

            switch (command.type) {                         // Trigger events based on command type 
                case 'PLAY':
                    this.emit('play', command.currentTime);
                    break;
                case 'PAUSE':
                    this.emit('pause', command.currentTime);
                    break;
                case 'SEEKED':
                    this.emit('seeked', command.currentTime);
                    break;
                case 'REQUEST_CURRENT_TIME': 
                    const player = getNetflixPlayer(); 
                    const currentTime = player.getCurrentTime();
                    this.connection.send(
                        JSON.stringify({ type: 'currentTime', currentTime })
                    );
                    break;
                default:
                    console.warn('Unknown command received:', command.type);
            }
        } catch (error) {
            console.error('Failed to handle incoming command:', error);
        }
    }

    // Send commands to peers
    sendCommand(type, data) {
        if (this.connectionOpen) {
            const message = JSON.stringify({ type, ...data });
            console.log('Sending command:', message);
            this.connection.emit('data', message); 
        } else {
            console.warn('Cannot send command; connection is not open.');
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
            this.eventHandlers[event].forEach((handler) => handler(data));
        }
    }

    generatePeerId() {
        return Math.random().toString(36).substr(2, 9);
    }

    close() {
        console.log('Closing room connection...');
        if (this.connection) {
            this.connection.emit('close');
            this.connection = null;
        }
        this.connectionOpen = false;
    }

    get isConnected() {
        return this.connection && this.connection.open;
    }

}