// Testing failed - This is a saving point/commit. Going to consider and try a revamp from using WebSockets to using WebRTC and peer.js for session/room creation, 
// connection and playback communication. Good luck man. 

(function() {
    let isInParty = false;
    let peerId = null;
    let peer = null;
    let connection = null;

    // Initialize the PeerJs instance
    function initializePeer() {
        console.log('initializePeer called'); // For testing 
        peer = new Peer();
        peer.on('open', (id) => {
            console.log(`Peer initialized with ID: ${id}`);
        });

        peer.on('connection', (conn) => {
            connection = conn;
            console.log(`Connected to peer: ${conn.peer}`);
            setupConnectionListeners(connection);
        });

        peer.on('error', (err) => {
            console.error('PeerJs initialization error:', err);
            alert(`PeerJS Error: ${err.message}`);    
        });
    }

    // Connect to another peer by ID
    function connectToPeer(peerId) {
        if (!peer) {
            console.error('Peer not initialized');
            return;
        }

        connection = peer.connect(peerId);
        setupConnectionListeners(connection);
    }

    function setupConnectionListeners(conn) {
        conn.on('data', (data) => {
            console.log('Received data:', data);
            handlePeerData(data); // Handle incoming video actions
        });

        conn.on('open', () => {
            console.log('Connection opened with peer:', conn.peer);
        });

        conn.on('close', () => {
            console.log('Connection closed with peer:', conn.peer);
        });

        conn.on('error', (err) => {
            console.error('PeerJS Connection Error:', err);
        });
    }

    // Send messages to the connected peer
    function sendPeerMessage(type, currentTime) {
        if (connection && connection.open) {
            connection.send({ type, currentTime });
            console.log(`Sent message: ${type} with data: ${currentTime}`);
        } else {
            console.warn('No open connection to send message');
        }
    }

    // Set up listeners for peer connection 
    function setupPeerListeners(callback) {
        if (connection) {
            connection.on('data', callback);
        }
    }
    
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
        console.log('Message received:', message);
    
        if (message.action === 'startParty') {
            if (!peer) {
                console.log('Initializing PeerJS...');
                initializePeer();
    
                peer.once('open', (id) => {
                    console.log('PeerJS open event triggered');
                    const inviteLink = `${window.location.origin}?peerId=${id}`;
                    console.log('Generated invite link:', inviteLink);
                    sendResponse({ success: true, inviteLink });
                    console.log('Response sent for startParty:', { success: true, inviteLink });
                });
    
                peer.on('error', (err) => {
                    console.error('PeerJS Error:', err);
                    sendResponse({ success: false, error: err.message });
                    console.log('Response sent for PeerJS error:', { success: false, error: err.message });
                });
    
                return true; // Inform Chrome this is an async response
            } else {
                console.log('Peer already initialized');
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