// Shifting all video sync related things into this file for better clarity and error handling.
class VideoSynchronizer {
    constructor(videoPlayer, room) {
        this.videoPlayer = videoPlayer;
        this.room = room;
        this.lastSyncedTime = 0;
        this.syncThreshold = 0.5; // Time difference threshold in seconds 
        this.isBuffering = false;
        this.lastStateUpdate = Date.now();
        this.setupListeners();
    }

    setupListeners() {
        if (!this.videoPlayer) {
            console.error('Video player is not defined');
            return;
        }

        let lastEventTime = 0;
        const debounceInterval = 1000; // 1 second debounce

        const shouldProcessEvent = () => {
            const now = Date.now();
            if (now - lastEventTime >= debounceInterval) {
                lastEventTime = now;
                return true;
            }
            return false;
        };

        // Listen for Netflix player events
        this.videoPlayer.addEventListener('play', (data) => {
            if (shouldProcessEvent()) {
                console.log('Play event received:', data);
                this.handleVideoPlay(data);
            }
        });

        this.videoPlayer.addEventListener('pause', (data) => {
            if (shouldProcessEvent()) {
                console.log('Pause event received:', data);
                this.handleVideoPause(data);
            };
        });

        this.videoPlayer.addEventListener('seeked', (data) => {
            if (shouldProcessEvent()) {
                console.log('Seek event received:', data);
                this.handleVideoSeeked(data);
            }
        });

        this.videoPlayer.addEventListener('buffering', (data) => {
            console.log('Buffer event received:', data);
            this.handleBuffering(data);
        });

        this.videoPlayer.addEventListener('timeupdate', (data) => {
            this.handleTimeUpdate(data);
        });

        // Listen for room events from peers
        this.room.on('play', (data) => this.syncAndPlay(data));
        this.room.on('pause', (data) => this.syncAndPause(data));
        this.room.on('seeked', (data) => this.syncTime(data));
        this.room.on('buffering', (data) => this.handlePeerBuffering(data));
        
        // Set up periodic sync check
        setInterval(() => this.checkSync(), 5000);
    }

    handleVideoPlay() {
        if (!this.room.connectionOpen) return;
        
        this.lastSyncedTime = data.currentTime;
        this.room.sendCommand('PLAY', {
            currentTime: data.currentTime,
            timestamp: Date.now()
        });
    }

    handleVideoPause() {
        if (!this.room.connectionOpen) return;

        this.lastSyncedTime = data.currentTime;
        this.room.sendCommand('PAUSE', {
            currentTime: data.currentTime,
            timestamp: Date.now()
        });
    }

    handleVideoSeeked() {
        if (!this.room.connectionOpen) return;

        this.lastSyncedTime = data.currentTime;
        this.room.sendCommand('SEEKED', {
            currentTime: data.currentTime,
            timestamp: Date.now()
        });
    }

    // ChatGPT suggestion for Buffering and timeUpdate, for more robust handling and issues when a peer gets left behind 
    handleBuffering(data) {
        if (!this.room.connectionOpen) return;

        this.isBuffering = data.isBuffering;
        this.room.sendCommand('BUFFERING', {
            isBuffering: data.isBuffering,
            currentTime: data.currentTime,
            timestamp: Date.now()
        });
    }

    handleTimeUpdate(data) {
        // Only update if time has changed significantly
        if (Math.abs(data.currentTime - this.lastSyncedTime) > this.syncThreshold) {
            this.lastSyncedTime = data.currentTime;
            this.lastStateUpdate = Date.now();
        }
    }

    handlePeerBuffering(data) {
        // If peer is buffering, we might want to pause until they catch up
        if (data.isBuffering && !this.isBuffering) {
            this.videoPlayer.pause();
        }
    }
    // Sync times for video events
    syncAndPlay(data) {
        const timeDiff = Math.abs(this.lastSyncedTime - data.currentTime);
        if (timeDiff > this.syncThreshold) {
            this.videoPlayer.seek(data.currentTime);
        }
        this.videoPlayer.play();
    }

    syncAndPause(data) {
        const timeDiff = Math.abs(this.lastSyncedTime - data.currentTime);
        if (timeDiff > this.syncThreshold) {
            this.videoPlayer.seek(data.currentTime);
        }
        this.videoPlayer.pause();
    }

    syncTime(data) {
        const timeDiff = Math.abs(this.lastSyncedTime - data.currentTime);
        if (timeDiff > this.syncThreshold) {
            this.videoPlayer.seek(data.currentTime);
            this.lastSyncedTime = data.currentTime;
        }
    }

    // Also periodically sync video current times in case someone is left behind/new person joins
    // Although note for self - current implementation lets multiple users join, I think this setup is better for 1 to 1 watch sessions
    // Hopefully these checks don't crash netflix 
    checkSync() {
        if (!this.room.connectionOpen) return;

        // Request current time from peers every 5 seconds
        this.room.sendCommand('REQUEST_TIME', {
            currentTime: this.lastSyncedTime,
            timestamp: Date.now()
        });
    }
}