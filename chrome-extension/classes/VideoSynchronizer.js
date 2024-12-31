// Shifting all video sync related things into this file for better clarity and error handling.
class VideoSynchronizer {
    constructor(videoPlayer, room) {
        this.videoPlayer = videoPlayer;
        this.room = room;
        this.syncThreshold = 0.5; // 500ms threshold
        this.setupListeners();
    }

    setupListeners() {
        if (this.room.isHost) {
            // Host sends video state changes
            this.videoPlayer.addEventListener('play', async () => {
                const currentTime = await this.videoPlayer.getCurrentTime();
                this.room.sendCommand('HOST_ACTION', { type: 'PLAY', currentTime });
            });

            this.videoPlayer.addEventListener('pause', async () => {
                const currentTime = await this.videoPlayer.getCurrentTime();
                this.room.sendCommand('HOST_ACTION', { type: 'PAUSE', currentTime });
            });

            this.videoPlayer.addEventListener('seeked', async () => {
                const currentTime = await this.videoPlayer.getCurrentTime();
                this.room.sendCommand('HOST_ACTION', { type: 'SEEK', currentTime });
            });
        } else {
            // Non-host peers check sync periodically
            setInterval(() => this.checkSync(), 5000);
        }

        // Listen for host commands and time updates
        this.room.on('hostAction', this.handleHostAction.bind(this));
        this.room.on('timeUpdate', this.handleTimeUpdate.bind(this));
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

    async handleTimeUpdate({ currentTime }) {
        if (this.room.isHost) return;
        
        const peerTime = await this.videoPlayer.getCurrentTime();
        const timeDiff = Math.abs(peerTime - currentTime);
        
        if (timeDiff > this.syncThreshold) {
            console.log(`Syncing to host time: ${currentTime} (diff: ${timeDiff}s)`);
            await this.videoPlayer.seek(currentTime);
        }
    }

    handleTimeUpdate({ currentTime }) {
        console.log('Received time update:', currentTime);
        this.syncTime({ currentTime });
    }

    // Also periodically sync video current times in case someone is left behind/new person joins
    // Although note for self - current implementation lets multiple users join, I think this setup is better for 1 to 1 watch sessions
    // Hopefully these checks don't crash netflix 
    async checkSync() {
        if (this.room.isHost || !this.room.connectionOpen) return;
        this.room.sendCommand('REQUEST_TIME_SYNC', {});
    }
}