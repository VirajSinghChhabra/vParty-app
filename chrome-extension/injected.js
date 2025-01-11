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

                console.log('Netflix player initialized:', {
                    sessionId: mainPlayerSessionId,
                    currentTime,
                    isPaused
                });

                // Send ready message with initial state
                window.postMessage({
                    type: 'NETFLIX_PLAYER_READY',
                    sessionId: mainPlayerSessionId
                }, '*');

                // Set up message listener for player commands
                window.addEventListener('message', handlePlayerCommands);
                return;
            }
        } catch (error) {
            console.error('Error initializing Netflix API:', error);
            if (++attempts < maxAttempts) {
                setTimeout(initializeNetflixAPI, interval);
            }
        }
    }


    async function handlePlayerCommands(event) {
        if (event.source !== window || !player) return;
    
        try {
            const { type, time } = event.data;
            let response = null;
    
            switch (type) {
                case 'NETFLIX_GET_TIME':
                    const currentTime = player.getCurrentTime();
                    const isPaused = player.isPaused();
                    response = {
                        type: 'NETFLIX_TIME_UPDATE',
                        currentTime,
                        isPaused,
                        timestamp: Date.now()
                    };
                    console.log('Time update:', { currentTime, isPaused });
                    break;
    
                case 'NETFLIX_SEEK':
                    await player.seek(time);
                    response = {
                        type: 'NETFLIX_SEEK_COMPLETE',
                        currentTime: player.getCurrentTime(),
                        timestamp: Date.now()
                    };
                    console.log('Seek completed to:', time);
                    break;
    
                case 'NETFLIX_PLAY':
                    await player.play();
                    response = {
                        type: 'NETFLIX_PLAY_COMPLETE',
                        timestamp: Date.now()
                    };
                    console.log('Play command executed');
                    break;
    
                case 'NETFLIX_PAUSE':
                    await player.pause();
                    response = {
                        type: 'NETFLIX_PAUSE_COMPLETE',
                        timestamp: Date.now()
                    };
                    console.log('Pause command executed');
                    break;
            }
    
            if (response) {
                window.postMessage(response, '*');
            }
        } catch (error) {
            console.error('Error executing command:', error);
            window.postMessage({
                type: 'NETFLIX_ERROR',
                error: error.message,
                timestamp: Date.now()
            }, '*');
        }
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
                        // timeFormatted: formatTime(time)
                    });
                    await player.seek(time);
                    const newTime = await player.getCurrentTime();
                    console.log('Seek completed:', {
                        time: newTime,
                        // timeFormatted: formatTime(newTime)
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