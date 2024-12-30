// Shifting all video sync related things into this file for better clarity and error handling.
class VideoSynchronizer {
    constructor(videoPlayer, room) {
        this.videoPlayer = videoPlayer; 
        this.room = room;

        this.setupListeners();
    }

    setupListeners() {
        // Video event listeners
        this.video.addEventListener('play', () => this.handleVideoPlay());
        this.video.addEventListener('pause', () => this.handleVideoPause());
        this.video.addEventListener('seeked', () => this.handleVideoSeeked());

        // Room event listeners
        this.room.on('play', (currentTime) => this.syncAndPlay(currentTime));
        this.room.on('pause', (currentTime) => this.syncAndPause(currentTime));
        this.room.on('seeked', (currentTime) => this.syncTime(currentTime));

        // Periodic sync check
        setInterval(() => this.checkSync(), 5000);
    }

    handleVideoPlay() {
        this.room.sendCommand('PLAY', { currentTime: this.videoPlayer.getCurrentTime() });
    }

    handleVideoPause() {
        this.room.sendCommand('PAUSE', { currentTime: this.videoPlayer.getCurrentTime() });
    }

    handleVideoSeeked() {
        this.room.sendCommand('SEEKED', { currentTime: this.videoPlayer.getCurrentTime() });
    }

    // Syc times for video events 
    syncAndPlay(targetTime) {
        this.syncTime(targetTime);
        this.videoPlayer.play();
    }

    syncAndPause(targetTime) {
        this.syncTime(targetTime);
        this.videoPlayer.pause();
    }

    syncTime(targetTime) {
        if (Math.abs(this.videoPlayer.getCurrentTime() - targetTime) > 0.5) {
            this.videoPlayer.seek(targetTime);
        }
    }

    // Also periodically sync video current times in case someone is left behind/new person joins
    // Although note for self - current implementation lets multiple users join, I think this setup is better for 1 to 1 watch sessions
    // Hopefully these checks don't crash netflix 
    checkSync() {
        if (!this.room.connectionOpen) return;

        // Send periodic sync updates
        if (Math.abs(this.video.currentTime - this.lastSyncedTime) > this.syncThreshold) {
            console.log('Periodic sync detected; sending seek command...');
            this.handleVideoSeeked();
        }
    }
}