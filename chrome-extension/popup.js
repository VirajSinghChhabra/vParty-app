document.addEventListener('DOMContentLoaded', function() {
    const loginSignUpBtn = document.getElementById('login-sign-up-btn');
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
    
    // Function to check the stored party state whenever popup is opened/closed after starting/joining party.
    // Fix for this issue from last commit as popup kept going back to start watch party stage. 
    function checkStoredPartyState() {
        chrome.storage.local.get(['partyState'], function(result) {
            if (result.partyState?.isInParty) {
                updateUI(true, true, true);

                // if we're the host, update the invite link
                if (result.partyState.isHost) {
                    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                        const videoId = tabs[0].url.match(/watch\/(\d+)/)[1];
                        const inviteLink = `${tabs[0].url.split('?')[0]}?t=${result.partyState.lastKnownTime}&peerId=${result.partyState.peerId}`;
                        inviteLinkInput.value = inviteLink;
                    });
                }
            }
        });
    }
    // Function to update UI based on view stages
    function updateUI(isLoggedIn, hasVideo, isInParty) {
        console.log('Updating UI with:', { isLoggedIn, hasVideo, isInParty });
    
        loggedIn.classList.toggle('d-none', !isLoggedIn);
        notLoggedIn.classList.toggle('d-none', isLoggedIn);
        userInfo.classList.toggle('d-none', !isLoggedIn);
    
        const canStartParty = isLoggedIn && hasVideo && !isInParty;
        
        startPartyBtn.disabled = !canStartParty;
        startPartyBtn.classList.toggle('btn-secondary', !canStartParty);
        startPartyBtn.classList.toggle('btn-primary', canStartParty);
    
        selectVideoMsg.classList.toggle('d-none', hasVideo);
        inviteSection.classList.toggle('d-none', !isInParty);
        disconnectBtn.classList.toggle('d-none', !isInParty);
        startPartyBtn.classList.toggle('d-none', isInParty);
    
        // Store UI state
        chrome.storage.local.set({ 
            uiState: { isLoggedIn, hasVideo, isInParty }
        });
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
        console.log('Checking party status, isLoggedIn:', isLoggedIn);
        
        chrome.storage.local.get(['partyState'], function(result) {
            const storedPartyState = result.partyState;
            
            if (storedPartyState?.isInParty) {
                console.log('Found stored party state:', storedPartyState);
                updateUI(isLoggedIn, true, true);
                
                // If we're the host, make sure the invite link is available
                if (storedPartyState.isHost && storedPartyState.peerId) {
                    chrome.tabs.query({ active: true, currentWindow: true}, function(tabs) {
                        if (tabs[0]?.url) {
                            const inviteLink = `${tabs[0].url.split('?')[0]}?t=${storedPartyState.lastKnownTime}&peerId=${storedPartyState.peerId}`;
                            inviteLinkInput.value = inviteLink;
                        }
                    });
                }
                return;
            }
    
            // If no stored state, check current status
            chrome.tabs.query({ active: true, currentWindow: true}, function(tabs) {
                if (!tabs[0]?.id) {
                    console.warn('No active tab found');
                    updateUI(isLoggedIn, false, false);
                    return;
                }
                
                chrome.tabs.sendMessage(tabs[0].id, {action: 'getPartyStatus'}, function(response) {
                    if (chrome.runtime.lastError) {
                        console.warn('Error getting party status:', chrome.runtime.lastError);
                        updateUI(isLoggedIn, false, false);
                        return;
                    }
                    
                    console.log('Received party status response:', response);
                    updateUI(
                        isLoggedIn, 
                        response?.hasVideo ?? false, 
                        response?.isInParty ?? false
                    );
                });
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
            updateUI(true, true, false); 

            const isLoggedIn = updateLoginState(result.token);
            checkPartyStatusAndUpdateUI(isLoggedIn);
        })
        .catch((error) => {
            console.error('Error fetching user data:', error);
            chrome.storage.local.remove('token');
            updateUI(false, false, false);
        });
    });
    
    // To check party state after login
    checkStoredPartyState();

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
                
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch user data: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then((data) => {
                    console.log('User data retrieved:', data);
                    updateUI(true, true, false); 
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

    // Login / Sign up button event
    loginSignUpBtn.addEventListener('click', function() {
        chrome.tabs.create({ url: 'http://localhost:3000/settings' });
    });

    // Start a new watch party (modified for testing for better error handling)
    startPartyBtn.addEventListener('click', function() {
        chrome.tabs.query({ active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0]?.id) {
                alert('No active tab found');
                return;
            }
    
            chrome.tabs.sendMessage(tabs[0].id, { action: 'startParty', asHost: true }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Error starting party:', chrome.runtime.lastError);
                    alert('Failed to start party: Unable to communicate with the page');
                    return;
                }
    
                if (response?.success) {
                    inviteLinkInput.value = response.inviteLink;
                    updateUI(true, true, true);
                    console.log('Party started successfully');
                } else {
                    const errorMessage = response?.error || 'Unknown error occurred';
                    console.error('Failed to start party:', errorMessage);
                    alert(`Failed to start party: ${errorMessage}`);
                }
            });
        });
    });

    // Update UI for peer who is joining a party 
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'partyJoined') {
            updateUI(true, true, true); 
            console.log('Joined the party');
        }
    });
    
        
    chrome.runtime.sendMessage({ action: 'getPartyStatus' }, (response) => {
        console.log('Party status response:', response);
        if (response) {
            updateUI(true, response.hasVideo, response.isInParty); 
        } else {
            console.error('Failed to fetch party status.');
        }
    });

    // Disconnect from the party function
    disconnectBtn.addEventListener('click', function() {
        chrome.tabs.query({ active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'disconnectParty' }, function(response) {
                if (response?.success) {
                    updateUI(true, true, false);
                    chrome.storage.local.remove(['partyState']);
                } else {
                    console.error('Failed to disconnect:', response?.error);
                }
            });
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