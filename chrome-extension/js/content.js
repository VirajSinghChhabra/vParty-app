// Testing failed - This is a saving point/commit. Going to consider and try a revamp from using WebSockets to using WebRTC and peer.js for session/room creation, 
// connection and playback communication. Good luck man. 

(function() {
    let CONNECTION_STATE = {
        isConnected: false,
        peerId: null,
        hostId: null,
        lastKnownTime: 0
    };

    // Sync threshold to prevent sync loops 
    const SYNC_THRESHOLD = 0.5; // seconds
    let lastSyncTime = 0;

    // Detect if video is playing
    function detectVideo() {
        const video = document.querySelector('video');
        console.log('Video element detected:', !!video);
        return video;
    }

    // Get the current video ID 
    function getVideoId() {
        const url = window.location.href;
        const match = url.match(/watch\/(\d+)/);
        return match ? match[1] : null;
    }

    // Initialize peer with error handling
    async function initializePeer() {
        try {
            console.log('Initializing PeerJS...');
            
            peer = new Peer();
    
            return new Promise((resolve, reject) => {
                peer.on('open', (id) => {
                    console.log(`Peer initialized with ID: ${id}`);
                    CONNECTION_STATE.isConnected = true;
                    CONNECTION_STATE.peerId = id;
                    // Store connection state
                    chrome.storage.local.set({ 
                        connectionState: CONNECTION_STATE 
                    }, () => {
                        console.log('Connection state stored');
                    });
                    isInParty = true;
                    resolve(id);
                });
    
                peer.on('error', (err) => {
                    console.error('PeerJS error:', err);
                    CONNECTION_STATE.isConnected = false;
                    chrome.storage.local.set({ 
                        connectionState: CONNECTION_STATE 
                    });
                    reject(err);
                });
    
                setTimeout(() => reject(new Error('PeerJS initialization timeout')), 5000);
            });
        } catch (error) {
            console.error('Failed to initialize PeerJS:', error);
            throw error;
        }
    }

    // Connect to another peer by ID
    function connectToPeer(peerId) {
        if (!peer) {
            console.error('Peer not initialized');
            return;
        }
    
        connection = peer.connect(peerId);
        CONNECTION_STATE.hostId = peerId;
    
        connection.on('open', () => {
            console.log('Connection opened with peer:', peerId);
            CONNECTION_STATE.isConnected = true;
            chrome.storage.local.set({ 
                connectionState: CONNECTION_STATE 
            });
            isInParty = true;
            chrome.runtime.sendMessage({ action: 'partyJoined' });
        });
    
        setupConnectionListeners(connection);
    }

    // Setup connection listeners
    function setupConnectionListeners(conn) {
        conn.on('data', (data) => {
            console.log('Received data:', data);
            handlePeerData(data); // Handle incoming video actions
        });

        conn.on('open', () => {
            console.log('Connection opened with peer:', conn.peer);
            isInParty = true;
        });

        conn.on('close', () => {
            console.log('Connection closed with peer:', conn.peer);
            isInParty = false;
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
            isInParty = false;
        });
    }

    // Send messages to the connected peer
    function sendPeerMessage(type, currentTime) {
        if (connection && connection.open) {
            connection.send({ type, currentTime });
            console.log(`Sent message: ${type} at time ${currentTime}`);
        } else {
            console.warn('No open connection to send message');
            console.log('Connection status:', connection ? connection.open : 'No connection');
        }
    }
    

    // Set up listeners for peer connection 
    function setupPeerListeners(callback) {
        if (connection) {
            connection.on('data', callback);
        }
    }

    // Attach video event listeners to sync playback
    function setupVideoListeners() {
    const video = detectVideo();
    if (!video) return;

    // ChatGPT help for debouncedSync, video time sync as I couldn't solve how to sync the videos to the exact time. 
    // Debounce function to prevent too frequent updates
    let syncTimeout;
    const debouncedSync = (type, time) => {
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            sendPeerMessage(type, time);
        }, 100);
    };

    video.addEventListener('play', () => {
        if (Date.now() - lastSyncTime > 1000) { // To prevent duplicate events *** Only for basic implementation, the issue would probably still occur on repetitive events. 
            debouncedSync('play', video.currentTime);
            lastSyncTime = Date.now();
        }
    });

    video.addEventListener('pause', () => {
        if (Date.now() - lastSyncTime > 1000) {
            debouncedSync('pause', video.currentTime);
            lastSyncTime = Date.now();
        }
    });

    video.addEventListener('seeked', () => {
        debouncedSync('seek', video.currentTime);
    });

    // Periodic sync check
    setInterval(() => {
        if (CONNECTION_STATE.isConnected && video.played) {
            sendPeerMessage('sync', video.currentTime);
        }
    }, 5000); // Checking every 5 seconds 
}


    // Handle data received from a peer
    function handlePeerData(data) {
        const video = detectVideo();
        if (!video) return;
    
        const timeDiff = Math.abs(video.currentTime - data.currentTime); 
    
        switch(data.type) {
            case 'play':
                if (timeDiff > SYNC_THRESHOLD) {
                    video.currentTime = data.currentTime;
                }
                video.play();
                break;
            case 'pause':
                if (timeDiff > SYNC_THRESHOLD) {
                    video.currentTime = data.currentTime;
                }
                video.pause();
                break;
            case 'seek':
                video.currentTime = data.currentTime;
                break;
            case 'sync':
                if (timeDiff > SYNC_THRESHOLD) {
                    video.currentTime = data.currentTime;
                }
                break;
        }
    
    }

    // Handle party session Start, Join, Disconnect and Status features
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Message received in content script:', message);

        if (message.action === 'getPartyStatus') {
                const status = {
                    hasVideo: !!detectVideo(),
                    isInParty: !!(peer && connection && connection.open),
                };
                console.log('Sending party status:', status);
                sendResponse(status);
                return true; // Keeps the message channel open -- This is important 
            }

        if (message.action === 'getCurrentTime') {
            const video = detectVideo();
            const currentTime = video ? Math.floor(video.currentTime) : 0;
            sendResponse({ currentTime });
            return true;
        }

        if (message.action === 'startParty') {
            const video = detectVideo();
            const videoId = getVideoId();
            const time = video ? Math.floor(video.currentTime) : 0;

            initializePeer()
                .then(id => {
                    const inviteLink = `${window.location.origin}/watch/${videoId}?t=${time}&peerId=${id}`;
                    console.log('Party started, invite link:', inviteLink);
                    sendResponse({ success: true, inviteLink });
                })
                .catch(error => {
                    console.error('Failed to start party:', error);
                    sendResponse({ success: false, error: error.message });
                });
            return true; 
        }

    
        if (message.action === 'disconnectParty') {
            if (peer) {
                peer.destroy();
                isInParty = false;
                peer = null;
                connection = null;
                console.log('Disconnected from party');
                sendResponse({ success: true });
            } else {
                console.log('No active party to disconnect');
                sendResponse({ success: false, error: 'No active party to disconnect' });
            }
            return true;
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

    // Currently, the issue is that after the the host sends an invite link which is joined by another peer, 
    // the host would naturally click off the popup, which is leading to disconnection between the peers and 
    // the video sync ofcourse doesn't work because of this. 
    // *** Test fix 
    // Connection state recovery in page load 
    window.addEventListener('load', () => {
        chrome.storage.local.get(['connectionState'], function(result) {
            if (result.connectionState && result.connectionState.isConnected) {
                console.log('Recovering connection state:', result.connectionState);
                if (result.connectionState.hostId) {
                    // We were a client, reconnect to host
                    initializePeer().then(() => {
                        connectToPeer(result.connectionState.hostId);
                    });
                } else if (result.connectionState.peerId) {
                    // We were a host, reinitialize
                    initializePeer();
                }
            }
        });
        // Set up video synchronization
        setupVideoListeners();
    });

    // Expose functions to the global scope 
    window.detectVideo = detectVideo;
    window.initializePeer = initializePeer;
    window.handlePeerData = handlePeerData;
})();