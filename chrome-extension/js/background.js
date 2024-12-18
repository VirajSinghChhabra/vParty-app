// To store login token globally 
let storedToken = null;

let socket = null;

// To ensure communication between content.js and popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'storeToken' && message.token) {
        storedToken = message.token;
        // Store token in extension's storage 
        chrome.storage.local.set({ 'token': storedToken }, function() {
            console.log('Token stored in extension storage');
            // Broadcast to all tabs
            chrome.runtime.sendMessage({ action: 'tokenStored', token: storedToken });
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { action: 'tokenStored', token: storedToken });
                });
            });
        });
        sendResponse({ success: true });
        return true;
    }

    // Start code block // ChatGPT help - token storage (detailed reason mentioned in content.js)
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
    // End code block 

    if (message.action === 'createSession') {
        fetch('http://localhost:3000/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: sender.tab.id, videoId: message.videoId })
        })
        .then(response => response.json())
        .then(data => {
            connectSocket(data.sessionId);
            sendResponse({ sessionId: data.sessionId });
        })
        .catch(error => sendResponse({ error: 'Failed to create session' }));
        return true;
    }

    // Handle video actions
    if (message.action === 'videoAction') {
        if (socket) {
            socket.emit('videoAction', { sessionId: message.sessionId, action: message.actionData });
        }
    }
});

function connectSocket(sessionId) {
    socket = io('http://localhost:3000');
    socket.on('connect', () => {
        socket.emit('joinSession', sessionId);
    });
    socket.on('videoAction', (action) => {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { action: 'videoAction', actionData: action });
            });
        });
    });
}
