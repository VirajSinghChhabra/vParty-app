// Watch party state storage stuff from content.js 
// export to content.js for use
class WatchPartyState {
    constructor() {
        this.stateKey = 'watchPartyState';
    }

    async save(state) {
        await chrome.storage.local.set({
            [this.stateKey]: {
                isInParty: state.isInParty,
                peerId: state.peerId,
                isHost: state.isHost,
                lastKnownTime: state.lastKnownTime,
                timestamp: Date.now()
            }
        });
    }

    async load() {
        const data = await chrome.storage.local.get(this.stateKey);
        return data[this.stateKey];
    }

    async clear() {
        await chrome.storage.local.remove(this.stateKey);
    }
}