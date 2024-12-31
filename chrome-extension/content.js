// Testing failed - This is a saving point/commit. Going to consider and try a revamp from using WebSockets to using WebRTC and peer.js for session creation, 
// connection and playback communication. Good luck man. 

// See you made a lot of progress. 
// Simplify content.js and move stuff to other files for better handling, readibility flow and error handling etc. 
// Calm down. I can do this. Good luck. 

(() => {
    let netflixPlayerAPI = null;
    let room = null;
    let videoSync = null;
    const partyState = new WatchPartyState();

    // Inject Netflix API script into netflix page
    function injectScript(file) {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(file);
        script.onload = () => script.remove(); // Remove script after execution
        (document.head || document.documentElement).appendChild(script);
    }
    
    // Inject the API access script
    injectScript('injected.js');

    // Listen for messages from injected.js
    window.addEventListener('message', (event) => {
        if (event.source === window && event.data.type === 'NETFLIX_PLAYER_API_READY') {
            console.log('Received Netflix player session ID:', event.data.sessionId);

            // Construct Netflix Player API based on data from injected.js
            netflixPlayerAPI = {
                getCurrentTime: () => {
                    return new Promise((resolve) => {
                        const listener = (event) => {
                            if (event.source === window && event.data.type === 'NETFLIX_TIME_UPDATE') {
                                window.removeEventListener('message', listener);
                                resolve(event.data.currentTime);
                            }
                        };
                        window.addEventListener('message', listener);
                        window.postMessage({ type: 'NETFLIX_GET_TIME' }, '*');
                    });
                },
            
                seek: (time) => window.postMessage({ type: 'NETFLIX_SEEK', time }, '*'),
                
                play: () => window.postMessage({ type: 'NETFLIX_PLAY' }, '*'),
                
                pause: () => window.postMessage({ type: 'NETFLIX_PAUSE' }, '*'),
            
                addEventListener: (event, callback) => {
                    const eventListener = (e) => {
                        if (e.source === window) {
                            switch(e.data.type) {
                                case `NETFLIX_${event.toUpperCase()}`:
                                case 'NETFLIX_BUFFERING':
                                case 'NETFLIX_TIMEUPDATE':
                                case 'NETFLIX_ERROR':
                                    callback(e.data);
                                    break;
                            }
                        }
                    };
                    
                    window.addEventListener('message', eventListener);
                    
                    // Return cleanup function
                    return () => window.removeEventListener('message', eventListener);
                },
            
                // Get full player state
                getState: () => {
                    return new Promise((resolve) => {
                        const listener = (event) => {
                            if (event.source === window && event.data.type === 'NETFLIX_STATE_UPDATE') {
                                window.removeEventListener('message', listener);
                                resolve(event.data);
                            }
                        };
                        window.addEventListener('message', listener);
                        window.postMessage({ type: 'NETFLIX_GET_STATE' }, '*');
                    });
                }
            };
        };

        // Add error handling for the player API
        if (event.source === window && event.data.type === 'NETFLIX_ERROR') {
            console.error('Netflix player error:', event.data.error);                // Handle any cleanup or user notification here
        }
    });

    // Fetch the Netflix player object using Netflix API
    // Important to wait until window.netflixPlayerAPI is defined
    function getNetflixPlayer() {
        return new Promise((resolve, reject) => {
            const checkInterval = 100;
            const maxAttempts = 50;
            let attempts = 0;
    
            const intervalId = setInterval(() => {
                if (netflixPlayerAPI) {
                    clearInterval(intervalId);
                    resolve(netflixPlayerAPI);
                } else if (++attempts >= maxAttempts) {
                    clearInterval(intervalId);
                    reject(new Error('Netflix player API is not available'));
                }
            }, checkInterval);
        });
    }

    async function checkStoredPartyState() {
        const state = await partyState.load();
        if (state?.isInParty) {
            if (state.isHost) {
                await startParty();
            } else {
                await joinParty(state.peerId);
            }
            updateUI(true, true, true);
        }
    }
    
    function detectVideo() {
        const video = document.querySelector('video');
        console.log('Video detected:', !!video);
        return video;
    }

    async function waitForVideoElement(timeout = 10000) {
        const interval = 500;
        const maxAttempts = timeout / interval;
        let attempts = 0;

        return new Promise((resolve, reject) => {
            const check = () => {
                const video = document.querySelector('video');
                if (video) {
                    resolve(video);
                    return;
                }
                attempts++;
                if (attempts >= maxAttempts) {
                    reject(new Error('No video element found within timeout'));
                } else {
                    setTimeout(check, interval);
                }
            };
            check();
        });
    }

    // Create an invite link with the host's playback state
    async function createInviteLink(peerId) {
        const url = new URL(window.location.href);
        const player = await getNetflixPlayer(); 
        const currentTime = await player.getCurrentTime(); // Fetch the current time in ms
        url.searchParams.set('t', currentTime); // 't' is netflix's time search param
        url.searchParams.set('watchPartyId', peerId);
        return url.toString();
    }

    async function startParty() {
        try {
            console.log('Attempting to start party...');
            const player = await getNetflixPlayer();
            console.log('Netflix player API obtained:', player);
    
            room = await Room.create();
            console.log('Room created successfully:', room);
    
            videoSync = new VideoSynchronizer(player, room);
            console.log('Video synchronizer initialized');
    
            const inviteLink = await createInviteLink(room.peerId);
            await partyState.save({
                isInParty: true,
                peerId: room.peerId,
                isHost: true,
                lastKnownTime: await player.getCurrentTime(),
            });
    
            console.log('Party started successfully. Invite link:', inviteLink);
            chrome.runtime.sendMessage({ action: 'partyStarted', inviteLink });
            return { success: true, inviteLink };
        } catch (error) {
            console.error('Failed to start party:', error);
            throw error;
        }
    }

    async function joinParty(peerId) {
        try {
            const player = await getNetflixPlayer();
            room = await Room.join(peerId);
            room.setVideoPlayer(player);
    
            // Initial sync from URL param
            const initialTime = new URLSearchParams(window.location.search).get('t');
            if (initialTime) {
                await player.seek(parseInt(initialTime, 10));
            }
    
            videoSync = new VideoSynchronizer(player, room);
    
            // Request immediate time sync
            room.sendCommand('REQUEST_TIME_SYNC', {});
    
            await partyState.save({
                isInParty: true,
                peerId,
                isHost: false,
            });
    
            console.log('Successfully joined the party');
        } catch (error) {
            console.error('Failed to join watch party:', error);
            throw error;
        }
    }

    async function disconnectFromParty() {
        try {
            if (room) {
                room.close();
                room = null;
            }
            if (videoSync) {
                videoSync = null;
            }
            await partyState.clear();
            console.log('Disconnected from party');
            return { success: true };
        } catch (error) {
            console.error('Error disconnecting:', error);
            throw error;
        }
    }

    // Message handlers
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        const handlers = {
            'getPartyStatus': async () => {
                const state = await partyState.load();
                return {
                    hasVideo: !!detectVideo(),
                    isInParty: state?.isInParty || false,
                };
            },
            'startParty': async () => {
                return await startParty();
            },
            'joinParty': async () => {
                const peerId = message.peerId;
                return await joinParty(peerId);
            },
            'disconnectParty': async () => {
                return await disconnectFromParty();
            },
        };

        const handler = handlers[message.action];
        if (handler) {
            handler()
                .then(sendResponse)
                .catch((error) => sendResponse({ success: false, error: error.message }));
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
        });
    });

    // Detect if the user is joining a party based on the URL
    window.addEventListener('load', async () => {
        await checkStoredPartyState();

        const urlParams = new URLSearchParams(window.location.search);
        const watchPartyId = urlParams.get('watchPartyId');

        if (watchPartyId) {
            try {
                await joinParty(watchPartyId);
            } catch (error) {
                console.error('Failed to join watch party:', error);
            }
        } else {
            const state = await partyState.load();
            if (state?.isInParty) {
                try {
                    if (state.isHost) {
                        await startParty();
                    } else {
                        await joinParty(state.peerId);
                    }
                } catch (error) {
                    console.error('Failed to restore watch party:', error);
                    await partyState.clear();
                }
            }
        }
    });
})();
