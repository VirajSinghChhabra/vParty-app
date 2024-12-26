// Testing failed - This is a saving point/commit. Going to consider and try a revamp from using WebSockets to using WebRTC and peer.js for session/room creation, 
// connection and playback communication. Good luck man. 

(function() {
    let currentVideoId = null;
    let isInParty = false;
    let sessionId = null;
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

    // Attach video event listeners to sync playback
    function setupVideoListeners() {
        const video = detectVideo();
        if (!video) return;  

        video.addEventListener('play', () => sendPeerMessage('play', video.currentTime));
        video.addEventListener('pause', () => sendPeerMessage('pause', video.currentTime));
        video.addEventListener('seeked', () => sendPeerMessage('seek', video.currentTime));
    }

    // Handle incoming messages from peers
    function handlePeerData(data) {
        const video = detectVideo();
        if (!video) return;

        if (data.type === 'play') {
            video.currentTime = data.data;
            video.play();
        } else if (data.type === 'pause') {
            video.currentTime = data.data;
            video.pause();
        } else if (data.type === 'seek') {
            video.currentTime = data.data;
        }
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
    // To ensure the message is coming from the correct source
    window.addEventListener('message', (event) => {
        if (event.source !== window || event.data.type !== 'FROM_PAGE') return;
        console.log('Token received in content.js', event.data.token);

        // Forward to background.js
        chrome.runtime.sendMessage(event.data, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error sending message to background:', chrome.runtime.lastError.message);
            } else {
                console.log('Response from background:', response);
            }
        })
    });

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
            }
        });
    }

    // Run the check when the page is loaded and everytime a video is played/paused
    window.addEventListener('load', () => {
        initializePeer();
        peerId = new URLSearchParams(window.location.search).get('peerId');
        if (peerId) {
            connectToPeer(peerId);
        }
        joinSessionFromStorage();
        joinSessionOnLoad()
        setupVideoListeners();
        setupPeerListeners(handlePeerData);
        console.log('Content script initialized');
    });

    // Poll every second to check video status
    setInterval(checkVideoStatus, 1000);
})();