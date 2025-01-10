// Shifting all video sync related things into this file for better clarity and error handling.
class VideoSynchronizer {
    constructor(player, room) {
        this.videoPlayer = player;
        this.room = room;
        this.syncThreshold = 0.5; // 500ms threshold
        this.intervalIds = new Set(); 
        this.timeoutIds = new Set(); 
        this.lastSyncTime = 0; // To track last sync time
        this.setupListeners();
    }

    setupListeners() {
        if (!this.room.isHost) {
            // Initial sync requests
            this.requestTimeSync();
            
            // More syncs with increasing delays 
            const delays = [1000, 2000, 3000, 5000];
            delays.forEach(delay => {
                const timeoutId = setTimeout(() => {
                    console.log(`Scheduled sync request after ${delay}ms`);
                    this.requestTimeSync();
                }, delay);
                this.timeoutIds.add(timeoutId);
            });

            const intervalId = setInterval(() => {
                if (Date.now() - this.lastSyncTime > 5000) {
                    console.log('Regular interval sync check triggered');
                    this.requestTimeSync();
                }
            }, 5000);
            this.intervalIds.add(intervalId);

            // Video event listeners
            const videoEvents = ['seeking', 'playing', 'pause', 'seeked'];
            videoEvents.forEach(event => {
                this.videoPlayer.addEventListener(event, () => {
                    console.log(`Video ${event} event triggered, requesting sync`);
                    this.requestTimeSync();
                });
            });
        }

        // Host event listeners
        if (this.room.isHost) {
            this.videoPlayer.addEventListener('play', async () => {
                const currentTime = await this.videoPlayer.getCurrentTime();
                console.log('Host: Play event triggered at time:', currentTime);
                this.room.sendCommand('PLAY', { currentTime });
            });
    
            this.videoPlayer.addEventListener('pause', async () => {
                const currentTime = await this.videoPlayer.getCurrentTime();
                console.log('Host: Pause event triggered at time:', currentTime);
                this.room.sendCommand('PAUSE', { currentTime });
            });
    
            this.videoPlayer.addEventListener('seek', async () => {
                const currentTime = await this.videoPlayer.getCurrentTime();
                console.log('Host: Seek event triggered at time:', currentTime);
                this.room.sendCommand('SEEK', { time: currentTime });
            });
        }

        this.room.on('timeUpdate', async (data) => {
            console.log('Received timeUpdate event with data:', data);
            await this.handleTimeUpdate(data);
        });

        this.room.on('disconnected', () => {
            console.log('Room disconnected, cleaning up...');
            this.cleanup();
        });
    }

    cleanup() {
        this.intervalIds.forEach(intervalId => {
            clearInterval(intervalId);
            console.log('Cleared interval:', intervalId);
        });
        this.intervalIds.clear();

        this.timeoutIds.forEach(timeoutId => {
            clearTimeout(timeoutId);
            console.log('Cleared timeout:', timeoutId);
        });
        this.timeoutIds.clear();

        this.room.eventHandlers = {};
    }

    requestTimeSync() {
        if (this.room.connectionOpen && !this.room.isHost) {
            console.log('Requesting time sync from host');
            this.room.sendCommand('REQUEST_TIME_SYNC', {
                timestamp: Date.now()  // helps debugging 
            });
        }
    }

    // Debugging  help from ChatGPT in handleTimeUpdate and handleHostAction, added logs for finding errors as joined user was not executing sync commands after commands exchanged.  
    async handleTimeUpdate(data) {
        if (this.room.isHost) return;
        
        try {
            console.log('Received time update:', data);
            this.lastSyncTime = Date.now();

            if (typeof data.currentTime !== 'number') {
                console.error('Invalid time update data:', data);
                return;
            }
            console.log('Attempting to seek to:', data.currentTime);
            await this.videoPlayer.seek(data.currentTime);
            
            // Handle play/pause state after seeking
            if (data.isPaused) {
                console.log('Video should be paused after sync');
                await this.videoPlayer.pause();
            } else {
                console.log('Video should play after sync');
                await this.videoPlayer.play();
            }
            
            console.log('Successfully synced to time:', data.currentTime);
        } catch (error) {
            console.error('Failed to sync time:', error);
        }
    }

    async handleHostAction(data) {
        if (this.room.isHost) return;

        try {
            const { type, currentTime } = data;
            console.log(`Processing host action: ${type} at time ${currentTime}`);

            switch (type) {
                case 'PLAY':
                    console.log('Executing play command');
                    await this.videoPlayer.seek(currentTime);
                    await this.videoPlayer.play();
                    break;
                case 'PAUSE':
                    console.log('Executing pause command');
                    await this.videoPlayer.seek(currentTime);
                    await this.videoPlayer.pause();
                    break;
                case 'SEEK':
                    console.log('Executing seek command');
                    await this.videoPlayer.seek(currentTime);
                    break;
            }
            console.log(`Successfully executed ${type} command`);
        } catch (error) {
            console.error('Failed to handle host action:', error);
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