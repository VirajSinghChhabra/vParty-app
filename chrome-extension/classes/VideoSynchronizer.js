// Shifting all video sync related things into this file for better clarity and error handling.
class VideoSynchronizer {
    constructor(videoPlayer, room) {
        this.videoPlayer = videoPlayer;
        this.room = room;
        this.lastSyncedTime = 0;
        this.syncThreshold = 0.5; // Time difference threshold in seconds
        this.setupListeners();
    }

    setupListeners() {
        // Room event listeners
        this.room.on('play', (currentTime) => this.syncAndPlay(currentTime));
        this.room.on('pause', (currentTime) => this.syncAndPause(currentTime));
        this.room.on('seeked', (currentTime) => this.syncTime(currentTime));

        // Set up interval for periodic sync
        setInterval(() => this.checkSync(), 5000);
    }

    handleVideoPlay() {
        const currentTime = this.videoPlayer.getCurrentTime();
        this.lastSyncedTime = currentTime;
        this.room.sendCommand('PLAY', { currentTime });
    }

    handleVideoPause() {
        const currentTime = this.videoPlayer.getCurrentTime();
        this.lastSyncedTime = currentTime;
        this.room.sendCommand('PAUSE', { currentTime });
    }

    handleVideoSeeked() {
        const currentTime = this.videoPlayer.getCurrentTime();
        this.lastSyncedTime = currentTime;
        this.room.sendCommand('SEEKED', { currentTime });
    }

    // Sync times for video events
    syncAndPlay(targetTime) {
        this.syncTime(targetTime);
        this.videoPlayer.play();
    }

    syncAndPause(targetTime) {
        this.syncTime(targetTime);
        this.videoPlayer.pause();
    }

    syncTime(targetTime) {
        const currentTime = this.videoPlayer.getCurrentTime();
        if (Math.abs(currentTime - targetTime) > this.syncThreshold) {
            this.videoPlayer.seek(targetTime);
            this.lastSyncedTime = targetTime;
        }
    }

    // Also periodically sync video current times in case someone is left behind/new person joins
    // Although note for self - current implementation lets multiple users join, I think this setup is better for 1 to 1 watch sessions
    // Hopefully these checks don't crash netflix 
    checkSync() {
        if (!this.room.connectionOpen) return;

        const currentTime = this.videoPlayer.getCurrentTime();
        if (Math.abs(currentTime - this.lastSyncedTime) > this.syncThreshold) {
            console.log('Periodic sync needed - current time differs from last synced time');
            this.handleVideoSeeked();
        }
    }
}