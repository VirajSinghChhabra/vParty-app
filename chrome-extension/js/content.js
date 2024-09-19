// Function to check if video is playing
function checkIfVideoIsPlaying() {
    const video = document.querySelector('video');

    if (video && !video.paused && !video.ended) {
        // if video is playing, send a message to the popup
        chrome.runtime.sendMessage({ videoPlaying: true });
    } else {
        // If no video or it's paused/ended, notify popup
        chrome.runtime.sendMessage({ videoPlaying: false });
    }
}

// Run the check when the page is loaded and everytime a video is played/paused
window.onload = checkIfVideoIsPlaying;
document.addEventListener('play', checkIfVideoIsPlaying, true);
document.addEventListener('pause', checkIfVideoIsPlaying, true)
document.addEventListener('ended', checkIfVideoIsPlaying, true)