// To store login token globally 
let storedToken = null;

// To ensure communication between content.js and popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'storeToken' && message.token) {
        storedToken = message.token;

        chrome.storage.local.set({ token: storedToken }, () => {
            console.log('Token stored in Chrome.storage.local:', storedToken);
            sendResponse({ success: true });
        });
        return true;
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
