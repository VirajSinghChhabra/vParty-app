// Testing failed - This is a saving point/commit. Going to consider and try a revamp from using WebSockets to using WebRTC and peer.js for session creation, 
// connection and playback communication. Good luck man. 

// See you made a lot of progress. 
// Simplify content.js and move stuff to other files for better handling, readibility flow and error handling etc. 
// Calm down. I can do this. Good luck. 

// const Room = require('./classes/Room.js');
// const VideoSynchronizer = require('./classes/VideoSynchronizer.js');
// const WatchPartyState = require('./classes/WatchPartyState.js');

(() => {
    let room = null;
    let videoSync = null;
    const partyState = new WatchPartyState();

    function detectVideo() {
        return document.querySelector('video');
    }

    async function startParty() {
        const video = detectVideo();
        if (!video) throw new Error('No video element found');

        try {
            room = await Room.create();
            videoSync = new VideoSynchronizer(video, room);
            
            await partyState.save({
                isInParty: true,
                peerId: room.peerId,
                isHost: true,
                lastKnownTime: video.currentTime
            });

            return {
                success: true,
                inviteLink: createInviteLink(room.peerId)
            };
        } catch (error) {
            console.error('Failed to start party:', error);
            throw error;
        }
    }

    async function joinParty(hostPeerId) {
        const video = detectVideo();
        if (!video) throw new Error('No video element found');

        try {
            room = await Room.join(hostPeerId);
            videoSync = new VideoSynchronizer(video, room);
            
            await partyState.save({
                isInParty: true,
                peerId: hostPeerId,
                isHost: false,
                lastKnownTime: video.currentTime
            });

            return { success: true };
        } catch (error) {
            console.error('Failed to join party:', error);
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
        return { success: true };
    }

    function createInviteLink(peerId) {
        const url = new URL(window.location.href);
        url.searchParams.set('watchPartyId', peerId);
        return url.toString();
    }

    // Message handlers
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        const handlers = {
            'getPartyStatus': async () => {
                const state = await partyState.load();
                return {
                    hasVideo: !!detectVideo(),
                    isInParty: state?.isInParty || false
                };
            },
            'startParty': async () => {
                return await startParty();
            },
            'disconnectParty': async () => {
                return await disconnectFromParty();
            }
        };

        const handler = handlers[message.action];
        if (handler) {
            handler()
                .then(sendResponse)
                .catch(error => sendResponse({ success: false, error: error.message }));
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

    // Initialize on page load
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