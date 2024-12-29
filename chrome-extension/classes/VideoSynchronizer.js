// Shifting all video sync related things into this file for better clarity and error handling.
// Use type: module to export/import functions between files. 
export class VideoSynchronizer {
    constructor(video, room) {
        this.video = video;
        this.room = room;
        this.syncThreshold = 0.5;
        this.lastSyncedTime = 0;
        this.setupListeners();
    }

    setupListeners() {
        this.video.addEventListener('play', () => this.handleVideoPlay());
        this.video.addEventListener('pause', () => this.handleVideoPause());
        this.video.addEventListener('seeked', () => this.handleVideoSeeked());

        this.room.on('data', (data) => this.handlePeerMessage(data));

        // Periodic sync check
        setInterval(() => this.checkSync(), 5000);
    }

    handleVideoPlay() {
        if (!this.room.isConnected) return;
        this.room.send({
            type: 'play',
            currentTime: this.video.currentTime
        });
    }

    handleVideoPause() {
        if (!this.room.isConnected) return;
        this.room.send({
            type: 'pause',
            currentTime: this.video.currentTime
        });
    }

    handleVideoSeeked() {
        if (!this.room.isConnected) return;
        this.room.send({
            type: 'seek',
            currentTime: this.video.currentTime
        });
    }

    handlePeerMessage(data) {
        switch (data.type) {
            case 'play':
                this.syncAndPlay(data.currentTime);
                break;
            case 'pause':
                this.syncAndPause(data.currentTime);
                break;
            case 'seek':
                this.syncTime(data.currentTime);
                break;
        }
    }

    syncAndPlay(targetTime) {
        this.syncTime(targetTime);
        this.video.play();
    }

    syncAndPause(targetTime) {
        this.syncTime(targetTime);
        this.video.pause();
    }

    syncTime(targetTime) {
        if (Math.abs(this.video.currentTime - targetTime) > this.syncThreshold) {
            this.video.currentTime = targetTime;
        }
        this.lastSyncedTime = targetTime;
    }

    checkSync() {
        if (!this.room.isConnected) return;
        
        if (Math.abs(this.video.currentTime - this.lastSyncedTime) > this.syncThreshold) {
            this.handleVideoSeeked();
        }
    }
}