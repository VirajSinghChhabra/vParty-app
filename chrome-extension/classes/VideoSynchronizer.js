// Shifting all video sync related things into this file for better clarity and error handling.
class VideoSynchronizer {
    constructor(player, room) {
        this.videoPlayer = player;
        this.room = room;
        this.syncThreshold = 2000; 
        this.isHandlingCommand = false;
        this.syncInterval = null;

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

        this.room.on('disconnected', () => {
            console.log('Disconnected, cleaning up synchronizer');
            this.cleanup();
        });
    }

    setupHostListeners() {
        // Listen for sync requests from clients
        this.room.on('REQUEST_SYNC', async () => {
            if (!this.room.connectionOpen) return;
            
            try {
                const currentTime = await this.videoPlayer.getCurrentTime();
                const isPaused = await this.videoPlayer.isPaused();
                
                console.log('Host: Sending current state for sync request:', {
                    currentTime,
                    isPaused
                });

                this.room.sendCommand('VIDEO_STATE', {
                    currentTime,
                    isPaused,
                    event: 'sync',
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('Error handling sync request:', error);
            }
        });

        // Listen for video events
        ['play', 'pause', 'seeking', 'seeked'].forEach(event => {
            this.videoPlayer.addEventListener(event, async () => {
                if (this.isHandlingCommand) return;
                
                try {
                    const currentTime = await this.videoPlayer.getCurrentTime();
                    const isPaused = await this.videoPlayer.isPaused();
                    
                    console.log(`Host: Broadcasting ${event} event:`, {
                        currentTime,
                        isPaused
                    });

                    this.room.sendCommand('VIDEO_STATE', {
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
    }

    setupClientListeners() {
        // Initial sync request
        setTimeout(() => this.requestSync(), 1000);
        
        // Regular sync checks
        this.syncInterval = setInterval(() => {
            if (this.room.connectionOpen && !this.isHandlingCommand) {
                this.requestSync();
            }
        }, 5000);

        // Listen for state updates from host
        this.room.on('VIDEO_STATE', async (data) => {
            if (!data || typeof data.currentTime !== 'number') {
                console.error('Invalid video state data:', data);
                return;
            }

            try {
                this.isHandlingCommand = true;
                const currentTime = await this.videoPlayer.getCurrentTime();
                const timeDiff = Math.abs(currentTime - data.currentTime);

                console.log('Time comparison:', {
                    currentTime,
                    hostTime: data.currentTime,
                    difference: timeDiff,
                    threshold: this.syncThreshold
                });

                if (timeDiff > this.syncThreshold) {
                    console.log('Time difference exceeds threshold, syncing to:', data.currentTime);
                    await this.videoPlayer.seek(data.currentTime);
                }

                const isPaused = await this.videoPlayer.isPaused();
                if (isPaused !== data.isPaused) {
                    console.log(`Adjusting play state to match host (isPaused: ${data.isPaused})`);
                    if (data.isPaused) {
                        await this.videoPlayer.pause();
                    } else {
                        await this.videoPlayer.play();
                    }
                }
            } catch (error) {
                console.error('Error handling video state update:', error);
            } finally {
                this.isHandlingCommand = false;
            }
        });
    }

    requestSync() {
        if (!this.room.isHost && this.room.connectionOpen) {
            console.log('Client: Requesting sync from host');
            this.room.sendCommand('REQUEST_SYNC', {
                timestamp: Date.now()
            });
        }
    }

    cleanup() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        if (this.videoPlayer) {
            ['play', 'pause', 'seeking', 'seeked'].forEach(event => {
                this.videoPlayer.removeEventListener(event, this.eventHandlers?.[event]);
            });
        }
        
        this.eventHandlers = {};
        console.log('VideoSynchronizer cleaned up');
    }
}