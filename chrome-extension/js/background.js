// To ensure communication between content.js and popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.videoPlaying !== undefined) {
        chrome.runtime.sendMessage(message);
    }
});

chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.action === 'videoAction') {
        // Broadcast to all connected tabs
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
                chrome.tabs.sendMessage(tab.id, message);
            });
        });
    }
});