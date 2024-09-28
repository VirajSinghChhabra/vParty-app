document.addEventListener('DOMContentLoaded', function() {
    const createAccBtn = document.getElementById('create-account-btn');
    const loginBtn = document.getElementById('login-btn');
    const userInfo = document.getElementById('logged-in');
    const notLoggedIn = document.getElementById('not-logged-in');
    const startPartyBtn = document.getElementById('start-party-btn');
    const inviteLinkInput = document.getElementById('invite-link');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const redirectBtn = document.getElementById('redirect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const selectVideoMsg = document.getElementById('select-video-msg');
    const ToggleSidebarBtn = document.getElementById('toggle-sidebar');

    // Check for token when popup opens
    chrome.storage.local.get(['token'], function(result) {
        if (result.token) {
            // User is logged in 
            userInfo.classList.remove('d-none');
            notLoggedIn.classList.add('d-none');
            startPartyBtn.disabled = false;
            startPartyBtn.classList.replace('btn-secondary', 'btn-primary');
            selectVideoMsg.classList.add('d-none');

            // Parse the token to get user info
            const user = parseJWT(result.token);
            if (user) {
                document.getElementById('username').textContent = user.name || 'User';
                document.getElementById('email').textContent = user.email || 'user@example.com';
            }
        } else {
            // User is not logged in
            userInfo.classList.add('d-none');
            notLoggedIn.classList.remove('d-none');
            startPartyBtn.disabled = true;
            startPartyBtn.classList.replace('btn-primary', 'btn-secondary');
            selectVideoMsg.classList.remove('d-none');
        }
    });

    // Check if current tab is Netflix for redirectBtn
    chrome.tabs.query({ active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        if (currentTab.url.includes('netflix.com')) {
            redirectBtn.classList.add('d-none');
        } else {
            redirectBtn.classList.remove('d-none');
        }
    });

    // Create Account button event
    createAccBtn.addEventListener('click', function() {
        chrome.tabs.create({ url: 'http://localhost:3000/register' });
    });

    // Login button event
    loginBtn.addEventListener('click', function() {
        chrome.tabs.create({ url: 'http://localhost:3000/login' });
    });

    // Redirect button
    // Not sure if to keep this // redirectBtn.addEventListener('click', function() {
    // Not sure if to keep this //     chrome.runtime.sendMessage({ action: "redirectToNetflix" });
    // Not sure if to keep this // });

    // Start Watch party button click event
    startPartyBtn.addEventListener('click', function() {
        // Start the watch party 
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'startParty' }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Error sending message:', chrome.runtime.lastError);
                    alert('Failed to start the watch party. Please try again.');
                    return;
                }

                if (response && response.videoId) {
                    // ChatGPT help for generating and displaying invite link
                    const sessionID = generateSessionID();
                    localStorage.setItem('sessionID', sessionID);
                    const inviteLink = `https://netflix.com/watch?sessionID=${sessionID}&videoId=${response.videoId}`;                    inviteLinkInput.value = inviteLink;
                    inviteLinkInput.value = inviteLink;
                    document.getElementById('invite-section').classList.remove('d-none');
                    disconnectBtn.classList.remove('d-none');
                    startPartyBtn.classList.add('d-none');
                } else {
                    console.error('No video found');
                    alert('No video found. Please select a video and try again.');
                }
            });
        });
    });

    // Disconnect from the party function
    disconnectBtn.addEventListener('click', function() {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'disconnectParty' }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Error sending message:', chrome.runtime.lastError);
                    alert('Failed to disconnect from the party. Please try again.');
                    return;
                }

                // Reset the popup state after disconnection
                document.getElementById('invite-section').classList.add('d-none');
                disconnectBtn.classList.add('d-none');
                startPartyBtn.disabled = true;
                startPartyBtn.classList.replace('btn-primary', 'btn-secondary');
            });
        });
    });

    // Logout button function
    logoutBtn.addEventListener('click', function() {
        localStorage.removeItem('token');
        chrome.storage.local.remove('token', function() {
            console.log('Token removed from storage');
        });
    })

    // Copy button logic
    copyLinkBtn.addEventListener('click', function() {
        const inviteLink = inviteLinkInput.value;
        if (inviteLink) {
            navigator.clipboard.writeText(inviteLink)
                .then(() => alert('Invite link copied to clipboard!'))
                .catch(err => console.error('Failed to copy text: ', err));
        }
    });

    // Redirect button event 
    redirectBtn.addEventListener('click', function() {
        chrome.tabs.create({ url: 'https://www.netflix.com' });
    });

    // Function to generate a unique session ID
    // ChatGPT code for this function
    function generateSessionID() {
        return '_' + Math.random().toString(36).substring(2,9);
    }

    // Function to parse JWT and extract user info for displaying in header of the popup
    function parseJWT(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            }).join(''));

            return JSON.parse(jsonPayload);
        } catch (err) {
            console.error('Invalid token:', err);
            return null;
        }
    }

    // Listen for the token message from background.js or content.js 
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'tokenStored') {
            // Refresh the popup to reflect the new logged-in view
            window.location.reload();
        }

        // Video selection logic/Start Watch Party button toggle 
        if (message.videoPlaying !== undefined) {
            if (message.videoPlaying) {
                startPartyBtn.disabled = false;
                startPartyBtn.classList.replace('btn-secondary', 'btn-primary');
                selectVideoMsg.classList.add('d-none');
            } else {
                startPartyBtn.disabled = true;
                startPartyBtn.classList.replace('btn-primary', 'btn-secondary');
                selectVideoMsg.classList.remove('d-none');
            }
        }
    });
});