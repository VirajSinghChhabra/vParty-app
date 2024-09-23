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
        const match = url.match(/watch\/(\d+)/);
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
        try {
            if (detectVideo()) {
                const videoId = getVideoId();
                if (videoId !== currentVideoId) {
                    currentVideoId = videoId;
                    // Check if the extension context is valid before sending a message
                    if (chrome.runtime && chrome.runtime.sendMessage) {
                        chrome.runtime.sendMessage({ videoPlaying: true, videoId });
                    }
                }
            } else {
                chrome.runtime.sendMessage({ videoPlaying: false });
            }
        } catch (error) {
            console.error("Error in checkVideoStatus:", error);
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
    // chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    //     switch (message.action) {
    //         case 'startParty':
    //             sendResponse({ videoId: currentVideoId });
    //             break;
    //         case 'disconnectParty':
    //             sendResponse({ success: true });
    //             break;
    //         //case 'toggleSidebar':
    //         //        document.getElementById('chat-sidebar').style.display = 'block';
    //     }
    // });

    // Listen for video events 
    function setupVideoListeners() {
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
    }

    // Listen for incoming video action messages from users to control the video player on other user devices
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

        switch (message.action) {
            case 'startParty':
                sendResponse({ videoId: currentVideoId });
                break;
            case 'disconnectParty':
                sendResponse({ success: true });
                break;
            //case 'toggleSidebar':
            //        document.getElementById('chat-sidebar').style.display = 'block';
        }
    });

    // Run the check when the page is loaded and everytime a video is played/paused
    window.addEventListener('load', () => {
        checkIfVideoIsPlaying();
        setupVideoListeners();
    });

    // Poll every second to check video status
    // setInterval(checkVideoStatus, 1000);
})();