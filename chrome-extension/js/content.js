// Testing failed - This is a saving point/commit. Going to consider and try a revamp from using WebSockets to using WebRTC and peer.js for session/room creation, 
// connection and playback communication. Good luck man. 

(function() {
    let isInParty = false;
    let peer = null;
    let connection = null;
    let lastKnownTime = 0;
    let isHost = false;

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
    async function initializePeer(asHost = false) {
        try {
            console.log('Initializing PeerJS...');
            peer = new Peer();
            isHost = asHost;
    
            return new Promise((resolve, reject) => {
                peer.on('open', (id) => {
                    console.log(`Peer initialized with ID: ${id}`);
                    isInParty = true;
                    
                    // Store party state in local storage
                    chrome.storage.local.set({
                        partyState: {
                            isInParty: true,
                            peerId: id,
                            isHost: asHost,
                            lastKnownTime: lastKnownTime
                        }
                    });
    
                    // If host, also listen for connections
                    if (asHost) {
                        peer.on('connection', (conn) => {
                            connection = conn;
                            setupConnectionListeners(conn);
                            
                            // Send current video state to new peer
                            const video = detectVideo();
                            if (video) {
                                conn.on('open', () => {
                                    conn.send({
                                        type: 'sync',
                                        currentTime: video.currentTime,
                                        isPlaying: !video.paused
                                    });
                                });
                            }
                        });
                    }
                    
                    resolve(id);
                });
    
                peer.on('error', (err) => {
                    console.error('PeerJS error:', err);
                    isInParty = false;
                    updatePartyState(false);
                    reject(err);
                });
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
    
        connection.on('open', () => {
            console.log('Connection opened with peer:', peerId);
            isInParty = true;
            updatePartyState(true, peerId);
            chrome.runtime.sendMessage({ action: 'partyJoined' });
        });
    
        setupConnectionListeners(connection);
    }

    // To update party state (for popup to maintain state after starting/joining party)
    function updatePartyState(isActive, peerId = null) {
        chrome.storage.local.set({
            partyState: {
                isInParty: isActive,
                peerId: peerId,
                isHost: isHost,
                lastKnownTime: lastKnownTime
            }
        });
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

    // Handle data received from a peer
    function handlePeerData(data) {
        const video = detectVideo();
        if (!video) return;
    
        if (data.type === 'sync') {
            video.currentTime = data.currentTime;
            if (data.isPlaying) {
                video.play();
            } else {
                video.pause();
            }
            lastKnownTime = data.currentTime;
        } else if (data.type === 'play') {
            video.currentTime = data.currentTime;
            video.play();
            lastKnownTime = data.currentTime;
        } else if (data.type === 'pause') {
            video.currentTime = data.currentTime;
            video.pause();
            lastKnownTime = data.currentTime;
        } else if (data.type === 'seek') {
            video.currentTime = data.currentTime;
            lastKnownTime = data.currentTime;
        }
    }

    // Video listeners for updating and syncing playback 
    function setupVideoListeners() {
        const video = detectVideo();
        if (!video) return;

        video.addEventListener('play', () => {
            lastKnownTime = video.currentTime;
            sendPeerMessage('play', video.currentTime);
        });

        video.addEventListener('pause', () => {
            lastKnownTime = video.currentTime;
            sendPeerMessage('pause', video.currentTime);
        });

        video.addEventListener('seeked', () => {
            lastKnownTime = video.currentTime;
            sendPeerMessage('seek', video.currentTime);
        });

        // Add periodic sync for host
        if (isHost) {
            setInterval(() => {
                if (isInParty && connection) {
                    sendPeerMessage('sync', video.currentTime);
                }
            }, 5000); // Sync every 5 seconds
        }
    }

    // Function to disconnect from party 
    // Disconnect handling 
    function disconnectFromParty() {
        if (connection) {
            connection.close();
        }
        if (peer) {
            peer.destroy();
        }

        isInParty = false;
        isHost = false;
        peer = null;
        connection = null;

        // clear stored party state after disconnecting
        chrome.storage.local.remove(['partyState'], function() {
            console.log('Party state cleared');
        });

        return { success: true };
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
            const result = disconnectFromParty();
            sendResponse(result);
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

    // Check for peer ID in URL when page loads 
    window.addEventListener('load', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const peerId = urlParams.get('peerId');
        const time = parseFloat(urlParams.get('t'));

        if (peerId) {
            console.log('Found peer ID in URL, connecing:', peerId);

            initializePeer()
            .then(() => {
                connectToPeer(peerId);
                const video = detectVideo();
                if (video) {
                    video.currentTime = time || 0;
                    video.play();
                    console.log(`Synced video at time ${time}`);
                } else {
                    console.warn('No video element detected to sync');
                }
            })
            .catch(error => {
                console.error('Failed to initialize PeerJS or connect:', error);
            });
    }
        // Set up video synchronization
        setupVideoListeners();
    });

    // Expose functions to the global scope 
    window.detectVideo = detectVideo;
    window.initializePeer = initializePeer;
    window.handlePeerData = handlePeerData;
})();