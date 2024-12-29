class ConnectionManager {
    constructor(room) {
        this.room = room;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 2000; // Start with 2 seconds
        this.setupConnectionHandlers();
    }

    setupConnectionHandlers() {
        this.room.on('disconnected', () => this.handleDisconnection());
        this.room.on('error', (error) => this.handleError(error));
        this.room.on('connected', () => this.handleReconnection());
    }

    handleDisconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.attemptReconnect(), this.getNextDelay());
        } else {
            console.log('Max reconnection attempts reached');
            this.room.emit('permanentDisconnect');
        }
    }

    async attemptReconnect() {
        this.reconnectAttempts++;
        
        try {
            if (this.room.isHost) {
                await Room.create();
            } else {
                await Room.join(this.room.peerId);
            }
        } catch (error) {
            console.error('Reconnection attempt failed:', error);
            this.handleDisconnection();
        }
    }

    handleReconnection() {
        console.log('Successfully reconnected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 2000; // Reset delay
    }

    handleError(error) {
        console.error('Connection error:', error);
        if (error.type === 'network' || error.type === 'peer-unavailable') {
            this.handleDisconnection();
        }
    }

    getNextDelay() {
        // Exponential backoff with a maximum of 10 seconds
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000);
        return this.reconnectDelay;
    }

    reset() {
        this.reconnectAttempts = 0;
        this.reconnectDelay = 2000;
    }
}