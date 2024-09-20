(function() {
    let currentVideoId = null;

    // Function to detect if a video is playing
    function detectVideo() {
        const video = document.querySelector('video');
        return video && !video.paused;
    }

    // FUnction to get the current video ID 
    function getVideoId() {
        const url = window.location.href;
        const match = url.match(/\/watch\/(\d+)/);
        return match ? match[1] : null;
    }

    // Function to check if video is playing
    function checkIfVideoIsPlaying() {
        const video = document.querySelector('video');
        if (video && !video.paused && !video.ended) {
            // if video is playing, send a message to the popup
            chrome.runtime.sendMessage({ videoPlaying: true });
        } else {
            // If no video or it's paused/ended, notify popup
            chrome.runtime.sendMessage({ videoPlaying: false });
        }
    }

    // Check video status and send video ID if playong 
    function checkVideoStatus() {
        if (detectVideo()) {
            const videoId = getVideoId();
            if (videoId != currentVideoId) {
                currentVideoId = videoId;
                chrome.runtime.sendMessage({ videoPlaying: true, videoId });
            }
        } else {
            chrome.runtime.sendMessage({ videoPlaying: false });
        }
    }

    // Listen for messages from popup.js
    chrome.runtime.onMessage.addEventListener((message, sender, sendResponse) => {
        if (message.action === 'startParty') {
            sendResponse({ videoId: currentVideoId });
        } else if (message.action === 'disconnectParty') {
            sendResponse ({ success: true });
        }
    });

    // Run the check when the page is loaded and everytime a video is played/paused
    window.onload = checkIfVideoIsPlaying;
    document.addEventListener('play', checkIfVideoIsPlaying, true);
    document.addEventListener('pause', checkIfVideoIsPlaying, true)
    document.addEventListener('ended', checkIfVideoIsPlaying, true)

    // Poll every second to check video status
    setInterval(checkVideoStatus, 1000);
})();