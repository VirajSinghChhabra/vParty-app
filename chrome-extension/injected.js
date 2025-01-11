(function () {
    let player = null;
    const maxAttempts = 20; // Retry up to 20 times
    const interval = 500; // Wait 500ms between retries
    let attempts = 0;
    let isHandlingCommand = false;

    function initializeNetflixAPI() {
        try {
            console.log('Attempting to initialize Netflix API...');
            if (typeof netflix !== 'undefined' && netflix.appContext?.state?.playerApp) {
                const videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
                const playerSessionIds = videoPlayer.getAllPlayerSessionIds();
                console.log('All player session IDs:', playerSessionIds);

                // IMP fix for preview video being mistaken as the video for sync time updates 
                // Filter out motion-billboard players
                const mainPlayerSessionId = playerSessionIds.find(id => id.startsWith('watch'));
                
                if (!mainPlayerSessionId) {
                    throw new Error('Main video player not found');
                }

                console.log('Selected player session ID:', mainPlayerSessionId);
                player = videoPlayer.getVideoPlayerBySessionId(mainPlayerSessionId);
                
                if (!player) {
                    throw new Error('Failed to get player instance');
                }

                // Verify we got the correct player
                const currentTime = player.getCurrentTime();
                const isPaused = player.isPaused();
                const duration = player.getDuration();

                console.log('Netflix player API initialized:', {
                    sessionId: mainPlayerSessionId,
                    currentTime,
                    isPaused,
                    duration,
                    timeFormatted: formatTime(currentTime)
                });

                setupPlayerEventListeners(player);

                window.postMessage({
                    type: 'NETFLIX_PLAYER_API_READY',
                    sessionId: mainPlayerSessionId,
                    currentTime,
                    isPaused
                }, '*');

                return;
            }
        } catch (error) {
            console.error('Error initializing Netflix API:', error);
            if (++attempts < maxAttempts) {
                setTimeout(initializeNetflixAPI, interval);
            }
        }
    }

    function formatTime(seconds) {
        if (typeof seconds !== 'number' || isNaN(seconds)) return '0:00:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function setupPlayerEventListeners(player) {
        let lastTimeUpdate = null;
        let lastTimeUpdateSent = 0;
        const timeUpdateInterval = 250; // 250ms intervals between updates

        setInterval(async () => {
            if (isHandlingCommand) return; // skip if handling command already 

            try {
                const currentTime = await player.getCurrentTime();
                const isPaused = await player.isPaused();
                
                const now = Date.now();
                if (currentTime !== lastTimeUpdate && now - lastTimeUpdateSent >= timeUpdateInterval) {
                    console.log('Time update:', {
                        currentTime,
                        timeFormatted: formatTime(currentTime),
                        isPaused
                    });

                    window.postMessage({
                        type: 'NETFLIX_TIMEUPDATE',
                        currentTime,
                        isPaused,
                        timestamp: now
                    }, '*');

                    lastTimeUpdate = currentTime;
                    lastTimeUpdateSent = now;
                }
            } catch (error) {
                console.error('Error in time update check:', error);
            }
        }, timeUpdateInterval);

        // Handle player events
        const events = ['play', 'pause', 'seeking', 'seeked'];
        events.forEach(eventName => {
            player.addEventListener(eventName, async () => {
                if (isHandlingCommand) {
                    console.log(`Skipping ${eventName} event - triggered by command`);
                    return;
                }

                try {
                    const currentTime = await player.getCurrentTime();
                    const isPaused = await player.isPaused();
                    console.log(`Natural ${eventName} event:`, {
                        currentTime,
                        timeFormatted: formatTime(currentTime),
                        isPaused
                    });
                    
                    window.postMessage({
                        type: `NETFLIX_${eventName.toUpperCase()}`,
                        currentTime,
                        isPaused,
                        timestamp: Date.now()
                    }, '*');
                } catch (error) {
                    console.error(`Error handling ${eventName} event:`, error);
                }
            });
        });
    }

    // Handle commands from content script
    window.addEventListener('message', async (event) => {
        if (event.source !== window || !player) return;

        const { type, time } = event.data;
        console.log('Received command:', event.data);

        try {
            isHandlingCommand = true;
            switch (type) {
                case 'NETFLIX_SEEK':
                    console.log('Executing seek command:', {
                        time,
                        timeFormatted: formatTime(time)
                    });
                    await player.seek(time);
                    const newTime = await player.getCurrentTime();
                    console.log('Seek completed:', {
                        time: newTime,
                        timeFormatted: formatTime(newTime)
                    });
                    break;

                case 'NETFLIX_PLAY':
                    console.log('Executing play command');
                    await player.play();
                    break;

                case 'NETFLIX_PAUSE':
                    console.log('Executing pause command');
                    await player.pause();
                    break;

                case 'NETFLIX_GET_TIME':
                    const currentTime = await player.getCurrentTime();
                    const isPaused = await player.isPaused();
                    console.log('Current state:', {
                        currentTime,
                        timeFormatted: formatTime(currentTime),
                        isPaused
                    });
                    window.postMessage({
                        type: 'NETFLIX_TIME_UPDATE',
                        currentTime,
                        isPaused,
                        timestamp: Date.now()
                    }, '*');
                    break;
            }
        } catch (error) {
            console.error('Error executing command:', type, error);
            window.postMessage({
                type: 'NETFLIX_ERROR',
                error: error.message,
                command: type,
                timestamp: Date.now()
            }, '*');
        } finally {
            isHandlingCommand = false;
        }
    });

    console.log('Starting Netflix API initialization...');
    initializeNetflixAPI();
})();