// Testing failed - This is a saving point/commit. Going to consider and try a revamp from using WebSockets to using WebRTC and peer.js for session/room creation, 
// connection and playback communication. Good luck man. 

import { initializePeer, connectToPeer, sendPeerMessage, setupPeerListeners } from './peer.js';

(function() {
    let currentVideoId = null;
    let isInParty = false;
    let sessionId = null;
    let socket = null;
    let peerId = null;

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

    // Function to send video actions with sessionId
function sendVideoAction(type, data) {
    if (isInParty && socket) {
        socket.emit('videoAction', { sessionId, action: { type, data } });
    }
}

// Listen for video events
function setupVideoListeners() {
    const video = detectVideo();

    if (video) {
        video.addEventListener('play', () => sendPeerMessage('play', video.currentTime));
        video.addEventListener('pause', () => sendPeerMessage('pause', video.currentTime));
        video.addEventListener('seeked', () => sendPeerMessage('seek', video.currentTime));
        video.hasListeners = true;
    } else return; 
}

    // Function to listen for video actions
    function handleVideoAction(action) {
        const video = detectVideo();
        if (video) {
            if (action.type === 'play') {
                video.currentTime = action.data;
                video.play();
            } else if (action.type === 'pause') {
                video.currentTime = action.data;
                video.pause();
            } else if (action.type === 'seek') {
                video.currentTime = action.data;
            }
        }
    }
    
    
    function connectSocket() {
        if (socket) {
            console.warn('Socket already initialized. Avoiding duplicate connections.');
            return;
        }

        socket = io('http://localhost:3000');

        socket.on('connect', () => {
            console.log('Connected to server');
            if (sessionId) {
                socket.emit('joinSession', sessionId);
            }
            // setupVideoListeners();
        });
    
        socket.on('disconnect', () => {
            console.warn('Disconnected from server.');
            socket = null;
        });
    
        socket.io.on('reconnect', (attemptNumber) => {
            console.log(`Reconnected after ${attemptNumber} attempts`);
            if (sessionId) {
                socket.emit('joinSession', sessionId);
            }
        });
    
        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
        });
        socket.on('videoAction', (action) => {
            console.log('Video action received:', action);
            handleVideoAction(action);
        });
    }

    // Extract sessionId from invite link and trigger joinSession
    function extractSessionId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('sessionId');
    }

    function joinSessionOnLoad() {
        const sessionId = extractSessionId();
        if (sessionId) {
            console.log(`Joining session from invite link: ${sessionId}`);
            joinSession(sessionId);
        }
    }

    // Sync state on join (request state from backend)
    function joinSession(sessionId) {
        // Retrieve token from Chrome's local storage
        chrome.storage.local.get(['token'], (result) => {
            const token = result.token;
    
            if (!token) {
                console.error('No token found. Please log in.');
                return;
            }
    
            // Proceed with the fetch call using the retrieved token
            fetch(`http://localhost:3000/session/${sessionId}/join`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    syncVideoToState(data.videoId, data.currentTime, data.isPlaying);
                    isInParty = true;
                    connectSocket();
                } else {
                    console.error('Failed to join session:', data.error);
                }
            })
            .catch(error => {
                console.error('Error joining session:', error);
            });
        });
    }

    function syncVideoToState(videoId, currentTime, isPlaying) {
        const video = detectVideo();
        if (video) {
            if (currentVideoId !== videoId) {
                console.warn('Video mismatch. Ensure you are on the correct page.');
            } else {
                video.currentTime = currentTime;
                isPlaying ? video.play() : video.pause();
            }
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
                        sendResponse({ success: true, sessionId: sessionId, videoId: currentVideoId }); 
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

    // Join the session from local storage
    function joinSessionFromStorage() {
        chrome.storage.local.get(['sessionId'], function(result) {
            if (result.sessionId) {
                sessionId = result.sessionId;
                isInParty = true;
                // Send a join request to background.js and sync video state
                chrome.runtime.sendMessage({ action: 'joinParty', sessionId }, function(response) {
                    if (response && response.success) {
                        console.log('Joined session successfully.');
                        syncVideoState(response.videoId); // Sync the video state with the session data
                    } else {
                        console.error('Failed to join the session.');
                    }
                });
                connectSocket(); // Join the WebSocket session
            }
        });
    }

    // Run the check when the page is loaded and everytime a video is played/paused
    window.addEventListener('load', () => {
        joinSessionFromStorage();
        joinSessionOnLoad()
        setupVideoListeners();
    });

    // Poll every second to check video status
    setInterval(checkVideoStatus, 1000);
})();