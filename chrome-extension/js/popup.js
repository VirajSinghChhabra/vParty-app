document.addEventListener('DOMContentLoaded', function() {
    const createAccBtn = document.getElementById('create-account-btn');
    const loginBtn = document.getElementById('login-btn');
    const userInfo = document.getElementById('user-info');
    const loggedIn = document.getElementById('logged-in');
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

    let peerId = null; 
    
    // Function to update UI based on view stages
    function updateUI(isLoggedIn, hasVideo, isInParty) {
        // Toggle main views based on login state
        loggedIn.classList.toggle('d-none', !isLoggedIn); // Show logged-in view if user is logged in 
        notLoggedIn.classList.toggle('d-none', isLoggedIn); // Hide "not logged in" view if user is logged in 

        // Update user info visibility 
        userInfo.classList.toggle('d-none', !isLoggedIn); 

        // Handle the start party button visibility and state
        startPartyBtn.disabled = !isLoggedIn || !hasVideo || isInParty;
        startPartyBtn.classList.toggle('btn-secondary', !isLoggedIn || !hasVideo || isInParty);
        startPartyBtn.classList.toggle('btn-primary', isLoggedIn && hasVideo && !isInParty);

        // Toggle other elements based on party state
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
                document.getElementById('username').textContent = user.name || 'Guest';
                // document.getElementById('email').textContent = user.email || 'user@example.com';
            } else {
                console.warn('Invalid token');
            }
        }
        // Update the UI based on Login state
        updateUI(isLoggedIn, false, false); // No video or party state at this point
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
    chrome.storage.local.get(['token'], function(result) {
        if (!result.token) {
            console.warn('No token found');
            updateUI(false, false, false);
            return;
        }
        console.log('Token found in popup.js:', result.token);
    
        // Fetch user information using the token
        fetch('http://localhost:3000/user', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${result.token}`
            }
        })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Failed to fetch user data: ${response.statusText}`);
            }
            return response.json();
        })
        .then((data) => {
            console.log('User data retrieved:', data);
            document.getElementById('username').textContent = data.name || 'Guest';
            // document.getElementById('email').textContent = data.email || 'user@example.com';

            const isLoggedIn = updateLoginState(result.token);
            checkPartyStatusAndUpdateUI(isLoggedIn);
        })
        .catch((error) => {
            console.error('Error fetching user data:', error);
            document.getElementById('username').textContent = 'Guest';
            // document.getElementById('email').textContent = 'user@example.com';
            updateUI(false, false, false);
        });
    });
    

    // Listen for tokenStored message when user logs in (when they were not logged in)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'tokenStored') {
            chrome.storage.local.get(['token'], function(result) {
                if (!result.token) {
                    console.warn('No token found after tokenStored message');
                    updateUI(false, false, false);
                    return;
                }
                console.log('Token retrieved after storage event:', result.token);
                const isLoggedIn = updateLoginState(result.token);
    
                // Fetch user data to update the UI
                fetch('http://localhost:3000/user', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${result.token}`
                    }
                })
                .then((response) => response.json())
                .then((data) => {
                    document.getElementById('username').textContent = data.name || 'Guest';
                    //document.getElementById('email').textContent = data.email || 'user@example.com';
                    checkPartyStatusAndUpdateUI(isLoggedIn);
                })
                .catch((error) => {
                    console.error('Error fetching user data after tokenStored:', error);
                    updateUI(false, false, false);
                });
            });
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

    // Start a new watch party 
    startPartyBtn.addEventListener('click', function() {
        chrome.runtime.sendMessage({ action: 'startParty' }, (response) => {
            console.log('Received response from content.js:', response);
            if (response && response.success) {
                inviteLinkInput.value = response.inviteLink;
                console.log('Party started with invite link:', response.inviteLink);
                updateUI(true, true, true);
            } else {
                const errorMessage = response?.error || 'No response received';
                console.error('Failed to start party:', errorMessage);
                alert(`Failed to start party: ${errorMessage}`);
            }
        });
    });

    chrome.runtime.sendMessage({ action: 'getPartyStatus' }, (response) => {
        console.log('Party status response:', response);
        if (response && response.isInParty) {
            updateUI(true, true, true); // Party is active
        } else {
            updateUI(true, true, false); // Not in party
        }
    });

    // Disconnect from the party function
    disconnectBtn.addEventListener('click', function() {
        chrome.runtime.sendMessage({ action: 'disconnectParty' }, (response) => {
            if (response.success) {
                peerId = null;
                updateUI(true, true, false);
                console.log('Disconnected from the party.');
            } else {
                console.error('Failed to disconnect:', response.error);
            }
        });
    });

    // Logout button function
    logoutBtn.addEventListener('click', function() {
        localStorage.removeItem('token');
        chrome.storage.local.remove('token', function() {
            console.log('Token removed. Logged out.');
            updateUI(false, false, false);
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
});