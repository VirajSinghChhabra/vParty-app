// Watch party state storage stuff from content.js 
class WatchPartyState {
    constructor() {
        this.stateKey = 'partyState';
    }

    async save(state) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.set({ [this.stateKey]: state }, () => {
                    console.log('Party state saved:', state);
                    resolve(state);
                });
            } catch (error) {
                console.error('Failed to save party state:', error);
                reject(error);
            }
        });
    }

    async load() {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.get([this.stateKey], (result) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error loading party state:', chrome.runtime.lastError.message);
                        reject(chrome.runtime.lastError);
                    } else {
                        const state = result[this.stateKey] || null;
                        console.log('Loaded party state:', state);
                        resolve(state);
                    }
                });
            } catch (error) {
                console.error('Failed to load party state:', error);
                reject(error);
            }
        });
    }

    async clear() {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.remove([this.stateKey], () => {
                    console.log('Party state cleared');
                    resolve();
                });
            } catch (error) {
                console.error('Failed to clear party state:', error);
                reject(error);
            }
        });
    }
}