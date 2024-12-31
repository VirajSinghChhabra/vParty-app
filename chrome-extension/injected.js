(function () {
    const maxAttempts = 20; // Retry up to 20 times
    const interval = 500; // Wait 500ms between retries
    let attempts = 0;

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
                const player = videoPlayer.getVideoPlayerBySessionId(playerSessionId);

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

    // Listen for Netflix player events
    player.addEventListener('play', () => {
        window.postMessage({
            type: 'NETFLIX_PLAY',
            currentTime: player.getCurrentTime()
        }, '*');
    });

    player.addEventListener('pause', () => {
        window.postMessage({
            type: 'NETFLIX_PAUSE',
            currentTime: player.getCurrentTime()
        }, '*');
    });

    player.addEventListener('seek', () => {
        window.postMessage({
            type: 'NETFLIX_SEEK',
            currentTime: player.getCurrentTime()
        }, '*');
    });

    // Listen for messages from content.js
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;

        const { type, time } = event.data;

        switch (type) {
            case 'NETFLIX_SEEK':
                console.log('Seeking to time:', time);
                if (player) player.seek(time);
                break;

            case 'NETFLIX_PLAY':
                console.log('Playing the video');
                if (player) player.play();
                break;

            case 'NETFLIX_PAUSE':
                console.log('Pausing the video');
                if (player) player.pause();
                break;

            default:
                // Unrecognized message
                break;
        }
    });

    initializeNetflixAPI();
})();