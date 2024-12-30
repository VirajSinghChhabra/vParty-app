(function () {
    // Safely check if netflix.appContext is available
    if (typeof netflix !== 'undefined' && netflix.appContext) {
        const videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
        const playerSessionId = videoPlayer.getAllPlayerSessionIds()[0];
        const player = videoPlayer.getVideoPlayerBySessionId(playerSessionId);

        // Expose player API methods for use by the content script
        window.netflixPlayerAPI = {
            getCurrentTime: () => player.getCurrentTime(),
            seek: (time) => player.seek(time),
            play: () => player.play(),
            pause: () => player.pause(),
        };
    }
})();