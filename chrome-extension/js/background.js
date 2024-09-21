// To ensure communication between content.js and popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle video playing status messages
    if (message.videoPlaying !== undefined) {
        // Forward the message to other parts of the extension
        chrome.runtime.sendMessage(message);
    }

    // Handle video actions
    if (message.action === 'videoAction') {
        // Broadcast to all connected tabs except the sender tab
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
                if (tab.id !== sender.tab.id) {
                    chrome.tabs.sendMessage(tab.id, message);
                }
            });
        });
    }

    return true;
});
