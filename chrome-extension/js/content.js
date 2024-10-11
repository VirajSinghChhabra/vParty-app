(function() {
    let currentVideoId = null;
    let isInParty = false;
    let sessionId = null;
    let socket = null;

    // Function to detect if a video is playing
    function detectVideo() {
        return document.querySelector('video');
    }

    // Function to get the current video ID 
    function getVideoId() {
        const url = window.location.href;
        const match = url.match(/watch\/(\d+)/);
        return match ? match[1] : null;
    }

    // Check video status and send video ID if playing 
    function checkVideoStatus() {
        const video = detectVideo();
        const videoId = getVideoId();

        if (video && videoId !== currentVideoId) {
            currentVideoId = videoId;
            chrome.runtime.sendMessage({ action: 'videoDetected', videoId: currentVideoId });
        } else if (!videoId) {
            chrome.runtime.sendMessage({ action: 'videoNotDetected' });
        }
    }

    // Listen for video events 
    function setupVideoListeners() {
        const video = detectVideo();
        if (video && !video.hasListeners) {
            video.addEventListener('play', () => sendVideoAction('play'));
            video.addEventListener('pause', () => sendVideoAction('pause'));
            video.addEventListener('seeked', () => sendVideoAction('seek', video.currentTime));
            video.hasListeners = true;
        }
    }

    // Function to send video actions with sessionId
    function sendVideoAction(type, data) {
        if (isInParty && socket) {
            socket.emit('videoAction', { sessionId, action: { type, data } });
        }
    }

    // Function to listen for video actions
    function handleVideoAction(action) {
        const video = detectVideo();
        if (video) {
            if (action.type === 'play') video.play();
            else if (action.type === 'pause') video.pause();
            else if (action.type === 'seek') video.currentTime = action.data;
        }
    }

    // Handle party session Start, Join and Disconnect features
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'startParty') {
            chrome.storage.local.get(['token'], function(result) {
                if (result.token) {
                    fetch('http://localhost:3000/session', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${result.token}`
                        },
                        body: JSON.stringify({ videoId: currentVideoId })
                    })
                    .then(response => response.json())
                    .then(data => {
                        sessionId = data.sessionId;
                        isInParty = true;
                        connectSocket();
                        sendResponse({ success: true, sessionId }); 
                    })
                    .catch(error => sendResponse({ success: false, error: 'Failed to create session' }));
                } else {
                    sendResponse({ success: false, error: 'User not logged in' });
                }
            });
            return true;
        } 

        if (message.action === 'joinParty') {
            chrome.storage.local.get(['token'], function(result) {
                if (result.token) {
                    fetch(`http://localhost:3000/session/${message.sessionId}/join`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${result.token}`
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            sessionId = message.sessionId;
                            isInParty = true;
                            connectSocket();
                            sendResponse({ success: true, videoId: data.videoId });
                        } else {
                            sendResponse({ success: false, error: data.error });
                        }
                    })
                    .catch(error => sendResponse({ success: false, error: 'Failed to join session' }));
                } else {
                    sendResponse({ success: false, error: 'User not logged in' });
                }
            });
            return true;
        }

        if (message.action === 'disconnectParty') {
            isInParty = false;
            sessionId = null;
            if (socket) {
                socket.disconnect();
                socket = null;
            }
            sendResponse({ success: true });
        }

        if (message.action === 'videoAction') {
            handleVideoAction(message.actionData);
        }

        if (message.action === 'getPartyStatus') {
            sendResponse({
                hasVideo: !!detectVideo(),
                isInParty: isInParty
            });
        }
    });

    function connectSocket() {
        socket = io('http://localhost:3000');
        socket.on('connect', () => {
            socket.emit('joinSession', sessionId);
        });
        socket.on('videoAction', handleVideoAction);
    }

    // Listen for login messages from frontend/main.js and forward to background.js
    window.addEventListener('message', function(event) {
        if (event.source != window)
            return;

        if (event.data.type && (event.data.type == 'FROM_PAGE')) {
            console.log('Content script received: ' + event.data);
            // Forward the message to the background script // 
            // Start code block - ChatGPT help since after multiple nights of debugging (I figured out other login and token related bugs)
            // I couldn't figure out why the token was not being sent over from login.html local storage to other tabs localstorage.
            chrome.runtime.sendMessage(event.data, function(response) {
                console.log('Response from background: ', response);
                // Send a confirmation back to the page 
                window.postMessage({ type: 'FROM_EXTENSION', message: 'Token stored successfully' }, '*');
            });
        }
    }, false);

    // Listen for messages from background.js
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'tokenStored') {
            // Forward this message to the page 
            window.postMessage({ type: 'FROM_EXTENSION', action: 'tokenStored' }, '*');
        }
    });
            // End code block - ChatGPT help 

    // Run the check when the page is loaded and everytime a video is played/paused
    window.addEventListener('load', () => {
        checkIfVideoIsPlaying();
        setupVideoListeners();
    });

    // Poll every second to check video status
    setInterval(checkVideoStatus, 1000);
    setInterval(setupVideoListeners, 1000);
})();