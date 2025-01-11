// Shifting all video sync related things into this file for better clarity and error handling.
class VideoSynchronizer {
    constructor(player, room) {
        this.videoPlayer = player;
        this.room = room;
        this.syncThreshold = 2; // 2 seconds
        this.intervalIds = new Set();
        this.timeoutIds = new Set();
        this.lastSyncTime = 0;
        this.isSyncing = false;
        this.isHandlingEvent = false;
        console.log('VideoSynchronizer initialized:', {
            isHost: this.room.isHost,
            player: !!this.videoPlayer
        });
        this.setupListeners();
    }

    setupListeners() {
        if (this.room.isHost) {
            console.log('Setting up host listeners');
            this.setupHostListeners();
        } else {
            console.log('Setting up client listeners');
            this.setupClientListeners();
        }

        // Common listeners
        this.room.on('timeUpdate', async (data) => {
            await this.handleTimeUpdate(data);
        });

        this.room.on('disconnected', () => {
            console.log('Cleaning up synchronizer');
            this.cleanup();
        });
    }

    setupHostListeners() {
        console.log('Setting up host listeners');
        const videoEvents = ['play', 'pause', 'seeking', 'seeked'];

        videoEvents.forEach(event => {
            this.videoPlayer.addEventListener(event, async () => {
                if (!this.room.connectionOpen || this.isHandlingEvent) return;
                
                try {
                    const currentTime = await this.videoPlayer.getCurrentTime();
                    const isPaused = await this.videoPlayer.isPaused();
                    
                    console.log(`Host: ${event} event detected, broadcasting state:`, {
                        currentTime,
                        isPaused,
                        event
                    });

                    this.room.sendCommand('TIME_UPDATE', {
                        currentTime,
                        isPaused,
                        event,
                        timestamp: Date.now()
                    });
                } catch (error) {
                    console.error(`Error broadcasting ${event} state:`, error);
                }
            });
        });

        // Handle time sync requests from clients
        this.room.on('REQUEST_TIME_SYNC', async () => {
            if (!this.room.connectionOpen) return;
            
            try {
                const currentTime = await this.videoPlayer.getCurrentTime();
                const isPaused = await this.videoPlayer.isPaused();
                
                console.log('Host: Sending current state in response to sync request:', {
                    currentTime,
                    isPaused
                });

                this.room.sendCommand('TIME_UPDATE', {
                    currentTime,
                    isPaused,
                    event: 'sync',
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('Error handling sync request:', error);
            }
        });

        // Regular state broadcast every 5 seconds
        const broadcastInterval = setInterval(async () => {
            if (!this.room.connectionOpen) return;
            
            try {
                const currentTime = await this.videoPlayer.getCurrentTime();
                const isPaused = await this.videoPlayer.isPaused();
                
                console.log('Host: Regular state broadcast:', {
                    currentTime,
                    isPaused
                });

                this.room.sendCommand('TIME_UPDATE', {
                    currentTime,
                    isPaused,
                    event: 'periodic',
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('Error in periodic state broadcast:', error);
            }
        }, 5000);

        this.intervalIds.add(broadcastInterval);
    }

    setupClientListeners() {
        console.log('Setting up client listeners');
        
        // Initial sync with connection check
        setTimeout(() => this.performInitialSync(), 1000);
        
        // Regular sync check interval
        const syncCheckInterval = setInterval(() => {
            if (this.room.connectionOpen && !this.isHandlingEvent && 
                Date.now() - this.lastSyncTime > 5000) {
                console.log('Client: Regular sync check - requesting sync');
                this.requestTimeSync();
            }
        }, 5000);
        this.intervalIds.add(syncCheckInterval);

        // Listen for local video events
        const videoEvents = ['seeking', 'play', 'pause', 'seeked'];
        videoEvents.forEach(event => {
            this.videoPlayer.addEventListener(event, () => {
                // Only request sync if this event wasn't triggered by our sync operation
                if (!this.isHandlingEvent) {
                    console.log(`Client: Local ${event} detected (user initiated), requesting sync`);
                    this.requestTimeSync();
                } else {
                    console.log(`Client: Ignoring ${event} event - triggered by sync operation`);
                }
            });
        });
    }

    async performInitialSync() {
        if (!this.room.connectionOpen) {
            console.log('Waiting for connection to be ready...');
            const timeoutId = setTimeout(() => this.performInitialSync(), 500);
            this.timeoutIds.add(timeoutId);
            return;
        }

        try {
            this.isHandlingEvent = true;
            console.log('Performing initial sync');
            await this.requestTimeSync();
        } finally {
            this.isHandlingEvent = false;
        }
    }

    async handleTimeUpdate(data) {
        if (this.room.isHost) {
            console.log('Host: Ignoring time update');
            return;
        }

        if (!data || typeof data.currentTime !== 'number') {
            console.error('Invalid time update data:', data);
            return;
        }

        try {
            this.lastSyncTime = Date.now();
            const currentTime = await this.videoPlayer.getCurrentTime();
            const timeDiff = Math.abs(currentTime - data.currentTime);

            console.log('Time comparison:', {
                currentTime,
                hostTime: data.currentTime,
                difference: timeDiff,
                threshold: this.syncThreshold
            });

            if (timeDiff > this.syncThreshold) {
                this.isHandlingEvent = true;
                console.log('Time difference exceeds threshold, syncing to:', data.currentTime);
                
                await this.videoPlayer.seek(data.currentTime);
                
                const isPaused = await this.videoPlayer.isPaused();
                if (isPaused !== data.isPaused) {
                    if (data.isPaused) {
                        console.log('Pausing video to match host');
                        await this.videoPlayer.pause();
                    } else {
                        console.log('Playing video to match host');
                        await this.videoPlayer.play();
                    }
                }
                
                console.log('Sync completed');
            } else {
                console.log('Time difference within threshold, no sync needed');
            }
        } catch (error) {
            console.error('Error handling time update:', error);
        } finally {
            this.isHandlingEvent = false;
        }
    }

    requestTimeSync() {
        if (!this.room.isHost && this.room.connectionOpen) {
            console.log('Client: Requesting time sync from host');
            this.room.sendCommand('REQUEST_TIME_SYNC', {
                timestamp: Date.now(),
                lastSyncTime: this.lastSyncTime
            });
        } else {
            console.log('Client: Cannot request sync - no connection or is host');
        }
    }

    cleanup() {
        this.intervalIds.forEach(id => {
            clearInterval(id);
            console.log('Cleared interval:', id);
        });
        this.timeoutIds.forEach(id => {
            clearTimeout(id);
            console.log('Cleared timeout:', id);
        });
        this.intervalIds.clear();
        this.timeoutIds.clear();
    }
}