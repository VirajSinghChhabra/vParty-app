document.addEventListener('DOMContentLoaded', function() {
    const createAccBtn = document.getElementById('create-account-btn');
    const loginBtn = document.getElementById('login-btn');
    const userInfo = document.getElementById('user-info');
    const notLoggedIn = document.getElementById('not-logged-in');
    const startPartyBtn = document.getElementById('start-party-btn');
    const inviteLinkInput = document.getElementById('invite-link');
    const inviteSection = document.getElementById('invite-section');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const redirectBtn = document.getElementById('redirect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const selectVideoMsg = document.getElementById('select-video-msg');
    const ToggleSidebarBtn = document.getElementById('toggle-sidebar');

    let currentSessionId = null;

    // Function to update UI based on view stages
    function updateUI(isLoggedIn, hasVideo, isInParty) {
        userInfo.classList.toggle('d-none', !isLoggedIn);
        notLoggedIn.classList.toggle('d-none', isLoggedIn); // When this is commented out, the Create acc and Login buttons show up (this is somehow hiding them when not logged in)
        startPartyBtn.disabled = !isLoggedIn || !hasVideo || isInParty;
        startPartyBtn.classList.toggle('btn-secondary', !isLoggedIn || !hasVideo || isInParty);
        startPartyBtn.classList.toggle('btn-primary', isLoggedIn && hasVideo && !isInParty);
        selectVideoMsg.classList.toggle('d-none', hasVideo);
        inviteSection.classList.toggle('d-none', !isInParty);
        disconnectBtn.classList.toggle('d-none', !isInParty);
        startPartyBtn.classList.toggle('d-none', isInParty);
    }

    function updateLoginState(token) {
        const isLoggedIn = !!token;
        if (isLoggedIn) {
            const user = parseJWT(token);
            if (user) {
                document.getElementById('username').textContent = user.name || 'User';
                document.getElementById('email').textContent = user.name || 'user@example.com';
            }
        }
        return isLoggedIn;
    }

    function checkPartyStatusAndUpdateUI(isLoggedIn) {
        chrome.tabs.query({ active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'getPartyStatus'}, function(response) {
                if (response) {
                    updateUI(isLoggedIn, response.hasVideo, response.isInParty);
                    if (response.isInParty && currentSessionId) {
                        inviteLinkInput.value = `https://www.netflix.com/watch?sessionId=${currentSessionId}`;
                    }
                } else {
                    updateUI(isLoggedIn, false, false);
                }
            });
        });
    }

    // Initial check for token and session when popup opens
    chrome.storage.local.get(['token', 'sessionId'], function(result) {
        currentSessionId = result.sessionId;
        const isLoggedIn = updateLoginState(result.token);
        checkPartyStatusAndUpdateUI(isLoggedIn);
    });

    // Listen for tokenStored message when user logs in (when they were not logged in)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'tokenStored') {
            chrome.storage.local.get(['token'], function(result) {
                const isLoggedIn = updateLoginState(result.token);
                checkPartyStatusAndUpdateUI(isLoggedIn);
            });
        }

        // Video selection logic/Start Watch Party button toggle
        if (message.videoPlaying !== undefined) {
            updateVideoUI(message.videoPlaying);
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

    // Start Watch party button click event
    startPartyBtn.addEventListener('click', function() {
        // Start the watch party 
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'startParty' }, function(response) {
                if (response && response.success) {
                    currentSessionId = response.sessionId;
                    chrome.storage.local.set({sessionId: currentSessionId});
                    const inviteLink = `http://www.netflix.com/watch?sessionId=${currentSessionId}`;
                    inviteLinkInput.value = inviteLink;
                    updateUI(true, true, true);
                } else {
                    alert('Failed to start the watch party. Please try again.');
                }
            });
        });
    });

    // Disconnect from the party function
    disconnectBtn.addEventListener('click', function() {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'disconnectParty' }, function(response) {
                // Reset the popup state after disconnection
                if (response && response.success) {
                    chrome.storage.local.remove('sessionId');
                    currentSessionId = null;
                    updateUI (true, true, false);
                } else {
                    alert('Failed to disconnect from the party. Please try again.');
                }
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

    // Function to handle joining a party from an invite link
    function handleInviteLink() {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('sessionId');
        if (sessionId) {
            chrome.tabs.query({ active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {action: 'joinParty', sessionId: sessionId}, function(response) {
                    if (response && response.success) {
                        currentSessionId = sessionId;
                        chrome.storage.local.set({sessionId: currentSessionId});
                        updateUI(true, true, true);
                    } else {
                        alert(' Failed to join the watch party. Please try again.');
                    }                   
                });
            });
        }
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

    handleInviteLink();
});