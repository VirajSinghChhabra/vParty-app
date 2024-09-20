// To ensure communication between content.js and popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.videoPlaying !== undefined) {
        chrome.runtime.sendMessage(message);
    }
});