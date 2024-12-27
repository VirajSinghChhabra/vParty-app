// Testing failed - This is a saving point/commit. Going to consider and try a revamp from using WebSockets to using WebRTC and peer.js for session/room creation, 
// connection and playback communication. Good luck man. 

(function() {
    let currentVideoId = null;
    let isInParty = false;
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

    // Attach video event listeners to sync playback
    function setupVideoListeners() {
        const video = detectVideo();
        if (!video) return;  

        video.addEventListener('play', () => sendPeerMessage('play', video.currentTime));
        video.addEventListener('pause', () => sendPeerMessage('pause', video.currentTime));
        video.addEventListener('seeked', () => sendPeerMessage('seek', video.currentTime));
    }

    // Handle data received from a peer
    function handlePeerData(data) {
        const video = detectVideo();
        if (!video) return;

        if (data.type === 'play') {
            video.currentTime = data.currentTime;
            video.play();
        } else if (data.type === 'pause') {
            video.currentTime = data.currentTime;
            video.pause();
        } else if (data.type === 'seek') {
            video.currentTime = data.currentTime;
        }
    }

    // Handle party session Start, Join, Disconnect and Status features
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'startParty') {
            if (!peer) {
                initializePeer();
                peer.once('open', (id) => {
                    console.log(`Party started with Peer ID: ${id}`);
                    const inviteLink = `${window.location.origin}?peerId=${id}`;
                    sendResponse({ success: true, inviteLink });
                });
                return true;
            } else {
                sendResponse({ success: false, error: 'Party already started' });
            }
        }

        if (message.action === 'disconnectParty') {
            if (peer) {
                peer.disconnect();
                console.log('Disconnected from the party.');
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: 'No active party to disconnect' });
            }
        }

        if (message.action === 'getPartyStatus') {
            sendResponse({
                hasVideo: !!detectVideo(),
                isInParty: !!(peer && connection && connection.open)
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

    // Run the check when the page is loaded and everytime a video is played/paused
    window.addEventListener('load', () => {
        initializePeer();

        // Connect to a peer if a peer ID is provided in the URL
        peerId = new URLSearchParams(window.location.search).get('peerId');
        if (peerId) {
            console.log('Connecting to host peer:', peerId);
            connectToPeer(peerId);
        }

        // Set up video synchronization
        setupVideoListeners();

        console.log('Content script initialized');
    });

    // Expose functions to the global scope 
    window.detectVideo = detectVideo;
    window.handlePeerData = handlePeerData;
})();