// To store login token globally 
let storedToken = null;

// To ensure communication between content.js and popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // For broadcasting token to all active tabs 
    if (message.action === 'storeToken' && message.token) {
        storedToken = message.token;

        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { action: 'tokenStored', token: storedToken });
            });
        });

        sendResponse({ success: true });
    }

    // Handle video playing status messages
    if (message.videoPlaying !== undefined) {
        // Forward the message to other parts of the extension
        chrome.runtime.sendMessage(message);
    }

    // Handle video actions
    if (message.action === 'videoAction') {
        // Broadcast to all connected tabs except the sender tab
        chrome.tabs.query({ url: "*://www.netflix.com/*" }, (tabs) => {
            tabs.forEach((tab) => {
                if (tab.id !== sender.tab.id) {
                    chrome.tabs.sendMessage(tab.id, message);
                }
            });
        });
    }

    // Redirection logic 
    if (message.action === "redirectToNetflix") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            // Redirect to Netflix if not already on it
            if (!activeTab.url.includes("netflix.com")) {
                chrome.tabs.update(activeTab.id, { url: "https://www.netflix.com" });
            }
        });
        sendResponse({ success: true });
    }

});
