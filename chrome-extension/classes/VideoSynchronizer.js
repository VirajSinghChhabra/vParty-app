// Shifting all video sync related things into this file for better clarity and error handling.
class VideoSynchronizer {
    constructor(player, room) {
        this.videoPlayer = player;
        this.room = room;
        this.syncThreshold = 0.5; // 500ms threshold
        this.intervalIds = new Set(); 
        this.timeoutIds = new Set(); 
        this.setupListeners();
    }

    setupListeners() {
        if (!this.room.isHost) {
            // Initial sync requests
            for (let i = 0; i < 3; i++) {
                const timeoutId = setTimeout(() => this.requestTimeSync(), i * 1000);
                this.timeoutIds.add(timeoutId);
            }
            
            // Regular sync interval
            const intervalId = setInterval(() => this.requestTimeSync(), 5000);
            this.intervalIds.add(intervalId);
        }

        this.room.on('timeUpdate', async (data) => {
            if (this.room.isHost) return;
            
            try {
                const currentTime = data.currentTime;
                console.log('Syncing to host time:', currentTime);
                await this.videoPlayer.seek(currentTime);
            } catch (error) {
                console.error('Failed to sync time:', error);
            }
        });

        this.room.on('disconnected', () => {
            console.log('Room disconnected, cleaning up...');
            this.cleanup();
        });
    }

    cleanup() {
        // Clear all intervals
        this.intervalIds.forEach(intervalId => {
            clearInterval(intervalId);
            console.log('Cleared interval:', intervalId);
        });
        this.intervalIds.clear();

        // Clear all timeouts
        this.timeoutIds.forEach(timeoutId => {
            clearTimeout(timeoutId);
            console.log('Cleared timeout:', timeoutId);
        });
        this.timeoutIds.clear();

        // Remove event listeners if needed
        this.room.eventHandlers = {};
    }

    requestTimeSync() {
        if (this.room.connectionOpen && !this.room.isHost) {
            console.log('Requesting time sync from host');
            this.room.sendCommand('REQUEST_TIME_SYNC', {});
        }
    }

    handleTimeUpdate({ currentTime }) {
        if (this.room.isHost) return;
        
        console.log('Received time update:', currentTime);
        this.videoPlayer.seek(currentTime)
            .then(() => this.videoPlayer.play()) // Auto-play after sync
            .catch(err => console.error('Failed to sync time:', err));
    }

    async handleHostAction(data) {
        if (this.room.isHost) return;

        const { type, currentTime } = data;
        console.log(`Handling host ${type} at time ${currentTime}`);

        switch (type) {
            case 'PLAY':
                await this.videoPlayer.seek(currentTime);
                await this.videoPlayer.play();
                break;
            case 'PAUSE':
                await this.videoPlayer.seek(currentTime);
                await this.videoPlayer.pause();
                break;
            case 'SEEK':
                await this.videoPlayer.seek(currentTime);
                break;
        }
    }

    // Also periodically sync video current times in case someone is left behind/new person joins
    // Although note for self - current implementation lets multiple users join, I think this setup is better for 1 to 1 watch sessions
    // Hopefully these checks don't crash netflix 
    async checkSync() {
        if (this.room.isHost || !this.room.connectionOpen) return;
        this.room.sendCommand('REQUEST_TIME_SYNC', {});
    }
}