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
    let currentTime;

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
    
                    // Store event listeners
                    const eventListeners = new Map();
    
                    // Wrap the API to ensure consistent time handling
                    const wrappedPlayer = {
                        getCurrentTime: async () => {
                            const timeMs = await netflixPlayerAPI.getCurrentTime();
                            return timeMs / 1000; // Convert from milliseconds to seconds
                        },
    
                        seek: async (timeInSeconds) => {
                            console.log('Seeking to:', timeInSeconds, 'seconds');
                            // Netflix API expects milliseconds
                            await netflixPlayerAPI.seek(timeInSeconds * 1000);
                        },
    
                        play: async () => {
                            console.log('Playing video');
                            await netflixPlayerAPI.play();
                        },
    
                        pause: async () => {
                            console.log('Pausing video');
                            await netflixPlayerAPI.pause();
                        },
    
                        isPaused: async () => {
                            const state = await netflixPlayerAPI.getState();
                            return state.isPaused;
                        },
    
                        addEventListener: (event, callback) => {
                            // Create wrapper for the callback to handle time conversion
                            const wrappedCallback = async (eventData) => {
                                if (eventData && eventData.currentTime) {
                                    eventData.currentTime = eventData.currentTime / 1000;
                                }
                                callback(eventData);
                            };
    
                            // Store the original and wrapped callbacks
                            if (!eventListeners.has(event)) {
                                eventListeners.set(event, new Map());
                            }
                            eventListeners.get(event).set(callback, wrappedCallback);
    
                            // Add the actual event listener
                            netflixPlayerAPI.addEventListener(event, wrappedCallback);
                        },
    
                        removeEventListener: (event, callback) => {
                            if (eventListeners.has(event)) {
                                const wrappedCallback = eventListeners.get(event).get(callback);
                                if (wrappedCallback) {
                                    netflixPlayerAPI.removeEventListener(event, wrappedCallback);
                                    eventListeners.get(event).delete(callback);
                                }
                            }
                        }
                    };
    
                    resolve(wrappedPlayer);
                } else if (++attempts >= maxAttempts) {
                    clearInterval(intervalId);
                    reject(new Error('Netflix player API not available'));
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

    async function createInviteLink(peerId) {
        const currentUrl = window.location.href;
        const videoIdMatch = currentUrl.match(/watch\/(\d+)/);
        if (!videoIdMatch) {
            throw new Error('Could not extract video ID from URL');
        }
        const videoId = videoIdMatch[1];
    
        const url = new URL(`https://www.netflix.com/watch/${videoId}`);
        const player = await getNetflixPlayer();
        const timeInSeconds = Math.floor(await player.getCurrentTime());
        url.searchParams.set('t', timeInSeconds);
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
    
            inviteLink = await createInviteLink(room.peerId);
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
    
            // Create video synchronizer first
            videoSync = new VideoSynchronizer(player, room);
    
            // Get initial time from URL
            const params = new URLSearchParams(window.location.search);
            const initialTimeSeconds = parseInt(params.get('t'), 10);
            if (!isNaN(initialTimeSeconds)) {
                console.log('Initial seek to:', initialTimeSeconds, 'seconds');
                await player.seek(initialTimeSeconds);
            }
    
            // Request immediate time sync after initial seek
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
