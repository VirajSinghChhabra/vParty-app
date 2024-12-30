// Testing failed - This is a saving point/commit. Going to consider and try a revamp from using WebSockets to using WebRTC and peer.js for session creation, 
// connection and playback communication. Good luck man. 

// See you made a lot of progress. 
// Simplify content.js and move stuff to other files for better handling, readibility flow and error handling etc. 
// Calm down. I can do this. Good luck. 

(() => {
    // Inject Netflix API script 
    function injectScript(file) {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(file);
        script.onload = () => script.remove(); // Remove script after execution
        (document.head || document.documentElement).appendChild(script);
    }
    
    // Inject the video player access script
    injectScript('injected.js');

    let room = null;
    let videoSync = null;
    const partyState = new WatchPartyState();

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

    

    // Fetch the Netflix player object using Netflix API
    function getNetflixPlayer() {
        if (!window.netflixPlayerAPI) {
            throw new Error('Netflix player API is not available');
        }
        return window.netflixPlayerAPI;
    }

    // Create an invite link with the host's playback state
    function createInviteLink(peerId) {
        const url = new URL(window.location.href);
        const player = getNetflixPlayer(); 
        const currentTime = player.getCurrentTime(); // Fetch the current time in ms
        url.searchParams.set('watchPartyId', peerId);
        url.searchParams.set('t', currentTime); // 't' is netflix's time search param
        return url.toString();
    }

    async function startParty() {
        try {
            const player = getNetflixPlayer(); 
            room = await Room.create(); // Initialize room as host
            videoSync = new VideoSynchronizer(player, room); // Sync video using the player

            const inviteLink = createInviteLink(room.peerId); 
            await partyState.save({
                isInParty: true,
                peerId: room.peerId,
                isHost: true,
                lastKnownTime: player.getCurrentTime(), 
            });

            console.log('Party started successfully. Invite link:', inviteLink);
            return { success: true, inviteLink };
        } catch (error) {
            console.error('Failed to start party:', error);
            throw error;
        }
    }

    async function joinParty(peerId) {
        try {
            const player = getNetflixPlayer(); 
            room = await Room.join(peerId); // Join using host's peerId
    
            // Fetch the time from the URL for initial sync
            const initialTime = new URLSearchParams(window.location.search).get('t');
            if (initialTime) {
                player.seek(parseInt(initialTime, 10));
            }
    
            // Request host's current time for immediate correction
            room.sendCommand('REQUEST_CURRENT_TIME', {});
            room.on('currentTime', (data) => {
                const { currentTime } = data;
                if (Math.abs(player.getCurrentTime() - currentTime) > 0.5) {
                    player.seek(currentTime); // Correct playback time
                    console.log(`Synced to host's current time: ${currentTime}`);
                }
            });

            videoSync = new VideoSynchronizer(player, room); // Sync video with the room
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
        if (room) {
            room.close();
            room = null;
        }
        if (videoSync) {
            videoSync = null;
        }
        await partyState.clear();
        console.log('Disconnected from the party');
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
