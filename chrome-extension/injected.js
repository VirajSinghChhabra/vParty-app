(function () {
    const maxAttempts = 20; // Retry up to 20 times
    const interval = 500; // Wait 500ms between retries
    let attempts = 0;
    let player = null;

    function initializeNetflixAPI() {
        try {
            if (typeof netflix !== 'undefined' && netflix.appContext?.state?.playerApp) {
                const videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
                const playerSessionIds = videoPlayer.getAllPlayerSessionIds();
                console.log('Player session IDs:', playerSessionIds);

                if (!playerSessionIds || playerSessionIds.length === 0) {
                    throw new Error('Player session IDs unavailable');
                }

                const playerSessionId = playerSessionIds[0];
                player = videoPlayer.getVideoPlayerBySessionId(playerSessionId);

                // Set up event listeners for the Netflix player
                setupPlayerEventListeners(player);

                // Post initialization data to content.js
                window.postMessage({
                    type: 'NETFLIX_PLAYER_API_READY',
                    sessionId: playerSessionId,
                    currentTime: player.getCurrentTime(),
                }, '*');

                console.log('Netflix player API initialized successfully');
                return;
            }

            console.warn('Netflix appContext or player API not available. Retrying...');
        } catch (error) {
            console.error('Error initializing Netflix player API:', error);
        }

        if (++attempts < maxAttempts) {
            setTimeout(initializeNetflixAPI, interval);
        } else {
            console.error('Failed to initialize Netflix player API after maximum retries.');
        }
    }

    function setupPlayerEventListeners(player) {
        // Listen for native Netflix player events
        const events = ['play', 'pause', 'seek', 'playing', 'waiting', 'seeked'];
        
        events.forEach(eventName => {
            player.addEventListener(eventName, () => {
                window.postMessage({
                    type: `NETFLIX_${eventName.toUpperCase()}`,
                    currentTime: player.getCurrentTime(),
                    isPaused: player.isPaused(),
                    playerState: {
                        isPlaying: !player.isPaused(),
                        isBuffering: player.isBuffering(),
                        timestamp: Date.now()
                    }
                }, '*');
            });
        });
    
        // Handle timeupdate event
        let lastTime = 0;
        setInterval(() => {
            const currentTime = player.getCurrentTime();
            if (Math.abs(currentTime - lastTime) > 0.1) { // so it will only be sent if time changed significantly
                window.postMessage({
                    type: 'NETFLIX_TIMEUPDATE',
                    currentTime: currentTime,
                    timestamp: Date.now()
                }, '*');
                lastTime = currentTime;
            }
        }, 250); // Check every 250ms
    }

    // Listen for messages from content.js
    window.addEventListener('message', (event) => {
        if (event.source !== window || !player) return;

        const { type, time } = event.data;

        try {
            switch (type) {
                case 'NETFLIX_SEEK':
                    console.log('Seeking to time:', time);
                    player.seek(time);
                    break;

                case 'NETFLIX_PLAY':
                    console.log('Playing the video');
                    player.play();
                    break;

                case 'NETFLIX_PAUSE':
                    console.log('Pausing the video');
                    player.pause();
                    break;

                case 'NETFLIX_GET_TIME':
                    window.postMessage({
                        type: 'NETFLIX_TIME_UPDATE',
                        currentTime: player.getCurrentTime(),
                        isPaused: player.isPaused(),
                        timestamp: Date.now()
                    }, '*');
                    break;

                case 'NETFLIX_GET_STATE':
                    window.postMessage({
                        type: 'NETFLIX_STATE_UPDATE',
                        currentTime: player.getCurrentTime(),
                        isPaused: player.isPaused(),
                        isBuffering: player.isBuffering(),
                        timestamp: Date.now()
                    }, '*');
                    break;
            }
        } catch (error) {
            console.error('Error handling player command:', type, error);
            window.postMessage({
                type: 'NETFLIX_ERROR',
                error: error.message,
                command: type,
                timestamp: Date.now()
            }, '*');
        }
    });

    initializeNetflixAPI();
})();