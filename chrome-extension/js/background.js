// To store login token globally 
let storedToken = null;

// To ensure communication between content.js and popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'storeToken' && message.token) {
        storedToken = message.token;

        // Store token in Globaly *** NOT - Chrome's local storage 
        chrome.storage.local.set({ token: storedToken }, () => {
            console.log('Token stored globally');
            // Broadcast to all tabs
            chrome.runtime.sendMessage({ action: 'tokenStored', token: storedToken });
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { action: 'tokenStored', token: storedToken });
                });
            });
        });
        sendResponse({ success: true });
    }
});

 // Listen for tab updates to inject token if necessary 
 chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
     if (changeInfo.status === 'complete' && tab.url.includes('netflix.com')) {
         chrome.storage.local.get(['token'], function(result) {
             if (result.token) {
                 chrome.tabs.sendMessage(tabId, { action: 'tokenStored', token: result.token });
             }
         })
     }
 });
