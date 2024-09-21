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

    // Extract session ID from the url
    function getSessionIDFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('sessionID');
    }

    // Send sessionID to background script or popup for syncing 
    const sessionID = getSessionIDFromURL();
    if (sessionID) {
        chrome.runtime.sendMessage({ sessionID: sessionID });
    }

    // Listen for messages from popup.js
    chrome.runtime.onMessage.Listener((message, sender, sendResponse) => {
        if (message.action === 'startParty') {
            sendResponse({ videoId: currentVideoId });
        } else if (message.action === 'disconnectParty') {
            sendResponse ({ success: true });
        }

        if (message.action === 'toggleSidebar') {
            // Logic to open the chat sidebar
            if (message.open) {
                // Code to open the sidebar
                document.getElementById('chat-sidebar').style.display = 'block';
            }
        }
    });

    // Listen for video events 
    const videoPlayer = document.querySelector('video');

    if (videoPlayer) {
        videoPlayer.addEventListener('play', () => {
            chrome.runtime.sendMessage({ action: 'videoAction', type: 'play' });
            // *** FOR TESTING
            console.log('Sent play action');
        });

        videoPlayer.addEventListener('pause', () => {
            chrome.runtime.sendMessage({ action: 'videoAction', type: 'pause'});
            // *** FOR TESTING
            console.log('Sent pause action');
        });

        videoPlayer.addEventListener('seeked', () => {
            const currentTime = videoPlayer.currentTime;
            chrome.runtime.sendMessage({ action: 'videoAction', type: 'seek', time: currentTime });
            // *** FOR TESTING
            console.log('Sent seek action');
        });
    }

    // Listen for incoming video action messages from users to control the video player on other user devices
    chrome.runtime.onMessage.addListener((message) => {
        const videoPlayer = document.querySelector('video');
        if (videoPlayer) {
            if (message.type === 'play') {
                videoPlayer.play();
            } else if (message.type === 'pause') {
                videoPlayer.pause();
            } else if (message.type === 'seek') {
                videoPlayer.currentTime = message.time;
            }
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