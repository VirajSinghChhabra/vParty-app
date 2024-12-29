// Testing failed - This is a saving point/commit. Going to consider and try a revamp from using WebSockets to using WebRTC and peer.js for session/room creation, 
// connection and playback communication. Good luck man. 

(function() {
    let isInParty = false;
    let peer = null;
    let connection = null;
    let lastKnownTime = 0;
    let isHost = false;
    let partyPeerId = null;

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

    // Parse URL parameters to check for party invite
    function checkForPartyInvite() {
        const urlParams = new URLSearchParams(window.location.search);
        const peerId = urlParams.get('peerId');
        const timestamp = urlParams.get('t');
        
        if (peerId) {
            console.log('Found party invite in URL, connecting to:', peerId);
            lastKnownTime = parseInt(timestamp) || 0;
            
            // Initialize as guest and connect
            initializePeer(false).then(() => {
                connectToPeer(peerId);
            }).catch(err => {
                console.error('Failed to join party:', err);
            });
        }
    }

    // Initialize peer with error handling
    async function initializePeer(asHost = false) {
        try {
            console.log('Initializing PeerJS...', asHost ? 'as host' : 'as guest');
            peer = new Peer();
            isHost = asHost;
    
            return new Promise((resolve, reject) => {
                peer.on('open', (id) => {
                    console.log(`Peer initialized with ID: ${id}`);
                    isInParty = true;
                    partyPeerId = id;
    
                    const partyState = {
                        isInParty: true,
                        peerId: id,
                        isHost: asHost,
                        lastKnownTime: lastKnownTime
                    };
    
                    chrome.storage.local.set({ partyState }, () => {
                        console.log('Party state saved:', partyState);
                    });
    
                    if (asHost) {
                        peer.on('connection', (conn) => {
                            console.log('Received connection from peer');
                            connection = conn;
                            setupConnectionListeners(conn);
                            
                            conn.on('open', () => {
                                const video = detectVideo();
                                if (video) {
                                    conn.send({
                                        type: 'sync',
                                        currentTime: video.currentTime,
                                        isPlaying: !video.paused
                                    });
                                }
                            });
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
    
        console.log('Connecting to peer:', peerId);
        connection = peer.connect(peerId);
    
        connection.on('open', () => {
            console.log('Connection opened with peer:', peerId);
            isInParty = true;
            partyPeerId = peerId;
    
            const partyState = {
                isInParty: true,
                peerId: peerId,
                isHost: false,
                lastKnownTime: lastKnownTime
            };
    
            chrome.storage.local.set({ partyState }, () => {
                console.log('Party state saved for guest:', partyState);
            });
    
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
    
        const sendVideoState = (type) => {
            if (connection && connection.open) {
                const message = {
                    type,
                    currentTime: video.currentTime,
                    isPlaying: !video.paused
                };
                connection.send(message);
                console.log('Sent video state:', message);
            }
        };
    
        video.addEventListener('play', () => sendVideoState('play'));
        video.addEventListener('pause', () => sendVideoState('pause'));
        video.addEventListener('seeked', () => sendVideoState('seek'));
    
        // Add periodic sync for host
        if (isHost) {
            setInterval(() => {
                if (isInParty && connection && connection.open) {
                    sendVideoState('sync');
                }
            }, 2000);  // Sync every 2 seconds
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
            chrome.storage.local.get(['partyState'], (result) => {
                const status = {
                    hasVideo: !!detectVideo(),
                    isInParty: result.partyState?.isInParty || false
                };
                console.log('Sending party status:', status);
                sendResponse(status);
            });
            return true;  // Keep message channel open for async response -- this is important
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

    // Check for peer ID in URL and for party invite in URL  when page loads 
    window.addEventListener('load', () => {
        // First check for party invite in URL
        checkForPartyInvite();

        // Then check stored party state
        chrome.storage.local.get(['partyState'], (result) => {
            if (result.partyState?.isInParty && !connection?.open) {
                console.log('Attempting to reconnect to party...');
                if (result.partyState.isHost) {
                    initializePeer(true);
                } else if (result.partyState.peerId) {
                    initializePeer(false).then(() => {
                        connectToPeer(result.partyState.peerId);
                    });
                }
            }
        });
        
        setupVideoListeners();
    });

    // Expose functions to the global scope 
    window.detectVideo = detectVideo;
    window.initializePeer = initializePeer;
    window.handlePeerData = handlePeerData;
})();