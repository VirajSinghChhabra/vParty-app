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
    const settingsBtn = document.getElementById('settings-btn');
    const logoImg = document.getElementById('logo-img');
    const ToggleSidebarBtn = document.getElementById('toggle-sidebar'); 
    //const chatContainer = document.getElementById('chat-container'); 

    let peerId = null; 
    let shadowRoot = null; // Shadow DOM root for chat sidebar
    
    // Initialize chat sidebar
    //initializeChatSidebar();

    // Function to check if user is logged in and has valid token
    async function isUserLoggedIn() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['token'], function(result) {
                resolve(!!result.token);
            });
        });
    }
    // Function to initialize the Shadow DOM for chat sidebar
    //function initializeChatSidebar() {
    //    const chatHost = document.createElement('div');
    //    chatHost.setAttribute('id', 'chat-sidebar');
    //    chatContainer.appendChild(chatHost);
//
    //    shadowRoot = chatHost.attachShadow({ mode: 'open' });
    //    shadowRoot.innerHTML = `
    //        <style>
    //            #chat-container {
    //                width: 300px;
    //                height: 100%;
    //                border-left: 1px solid #ddd;
    //                background: #f9f9f9;
    //                display: flex;
    //                flex-direction: column;
    //            }
    //            #chat-messages {
    //                flex: 1;
    //                overflow-y: auto;
    //                padding: 10px;
    //            }
    //            #chat-input {
    //                border-top: 1px solid #ddd;
    //                padding: 10px;
    //            }
    //        </style>
    //        <div id="chat-container">
    //            <div id="chat-messages"></div>
    //            <input id="chat-input" type="text" placeholder="Type a message..." />
    //        </div>
    //    `;
    //}

    //// Function to update UI with chat visibility
    //function updateChatVisibility(isInParty) {
    //    if (isInParty) {
    //        chatContainer.classList.remove('d-none');
    //    } else {
    //        chatContainer.classList.add('d-none');
    //    }
    //}

    // Function to check the stored party state whenever popup is opened/closed after starting/joining party.
    // Fix for this issue from last commit as popup kept going back to start watch party stage. 
    async function checkStoredPartyState() {
        const loggedIn = await isUserLoggedIn();
        if (!loggedIn) {
            updateUI(false, false, false);
            return;
        }

        // First check stored UI state
        chrome.storage.local.get(['uiState'], function(result) {
            if (result.uiState) {
                const { isLoggedIn, hasVideo, isInParty } = result.uiState;
                // Verify the stored state matches current login state
                if (isLoggedIn === loggedIn) {
                    updateUI(isLoggedIn, hasVideo, isInParty);
                    return;
                }
            }

            // Use WatchPartyState class to get party state
            const partyState = new WatchPartyState();
            partyState.load().then(state => {
                if (state) {
                    const isInParty = state.isInParty || false;
                    updateUI(loggedIn, !!detectVideo(), isInParty);

                    // Set invite link if it exists
                    if (state.inviteLink) {
                        inviteLinkInput.value = state.inviteLink;
                    }
                }
            });
        });
    }

    // Function to update UI based on view stages
    function updateUI(isLoggedIn, hasVideo, isInParty) {
        console.log('Updating UI with:', { isLoggedIn, hasVideo, isInParty });

        // Always show login view if not logged in
        if (!isLoggedIn) {
            loggedIn.classList.add('d-none');
            notLoggedIn.classList.remove('d-none');
            userInfo.classList.add('d-none');
            inviteSection.classList.add('d-none');
            disconnectBtn.classList.add('d-none');
            //chatContainer.classList.add('d-none'); 

            // Clear stored UI state when logging out
            chrome.storage.local.remove(['uiState']);
            return;
        }

        // Update logged in view
        loggedIn.classList.remove('d-none');
        notLoggedIn.classList.add('d-none');
        userInfo.classList.remove('d-none');

        const canStartParty = isLoggedIn && hasVideo && !isInParty;
        
        startPartyBtn.disabled = !canStartParty;
        startPartyBtn.classList.toggle('btn-secondary', !canStartParty);
        startPartyBtn.classList.toggle('btn-primary', canStartParty);
        startPartyBtn.classList.toggle('d-none', isInParty);

        selectVideoMsg.classList.toggle('d-none', hasVideo);
        inviteSection.classList.toggle('d-none', !isInParty);
        disconnectBtn.classList.toggle('d-none', !isInParty);

        //updateChatVisibility(isInParty);

        // Store the new UI state
        chrome.storage.local.set({ 
            uiState: { isLoggedIn, hasVideo, isInParty }
        }, () => {
            console.log('UI state saved:', { isLoggedIn, hasVideo, isInParty });
        });
    }

    // Function to initialize popup properly when opened
    async function initializePopup() {
        const isLoggedIn = await isUserLoggedIn();
    
        if (!isLoggedIn) {
            updateUI(false, false, false);
            return;
        }
    
        chrome.storage.local.get(['token'], function(result) {
            if (!result.token) {
                updateUI(false, false, false);
                return;
            }
    
            fetch('http://localhost:3000/user', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${result.token}`
                }
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch user data');
                return response.json();
            })
            .then(data => {
                document.getElementById('username').textContent = data.name || 'Guest';
                updateUI(true, false, false);
    
                // Notify content.js to check video status
                chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                    if (!tabs[0]?.id) return;
    
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'getPartyStatus' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('Error checking video status:', chrome.runtime.lastError);
                            updateUI(true, false, false);
                        } else {
                            const hasVideo = response?.hasVideo || false;
                            const isInParty = response?.isInParty || false;
                            const inviteLink = response?.inviteLink;
                            updateUI(true, hasVideo, isInParty);
                            if (inviteLink) {
                                inviteLinkInput.value = inviteLink;
                            }
                        }
                    });
                });
            })
            .catch(error => {
                console.error('Error fetching user data:', error);
                chrome.storage.local.remove(['token']);
                updateUI(false, false, false);
            });
        });
    }    

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
                    updateUI(isLoggedIn, true, false); 
                })
                .catch((error) => {
                    console.error('Error fetching user data after tokenStored:', error);
                    updateUI(isLoggedIn, false, false);
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

    // Settings button event (takes you to the same user profile/settings page)
    settingsBtn.addEventListener('click', function() {
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
        if (message.action === 'partyStarted') {
            const inviteLink = message.inviteLink;
            inviteLinkInput.value = inviteLink; // Update the invite link in the UI
            updateUI(true, true, true); 
        }
        if (message.action === 'partyJoined') {
            updateUI(true, true, true); 
            console.log('Joined the party');
        }
    });
    
        
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0]) {
            console.error('No active tab found');
            updateUI(false, false, false);
            return;
        }
    
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getPartyStatus' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error checking video status:', chrome.runtime.lastError);
                updateUI(true, false, false);
            } else if (!response) {
                console.error('No response received from content.js');
                updateUI(true, false, false);
            } else {
                const { hasVideo, isInParty } = response;
                updateUI(true, hasVideo, isInParty);
            }
        });
    });

    // Disconnect from the party function
    disconnectBtn.addEventListener('click', function() {
        chrome.tabs.query({ active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'disconnectParty' }, function(response) {
                if (response?.success) {
                    updateUI(true, true, false);
                    chrome.storage.local.remove(['partyState', 'uiState']);
                } else {
                    console.error('Failed to disconnect:', response?.error);
                }
            });
        });
    });

    // Logout button function
    logoutBtn.addEventListener('click', function() {
        chrome.storage.local.remove(['token', 'uiState', 'partyState'], function() {
            console.log('Logged out and cleared states');
            updateUI(false, false, false);
        });
    });

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

    // Logo button (redirect to website/index page)
    logoImg.addEventListener('click', function() {
        chrome.tabs.create({ url: 'http://localhost:3000/index' });
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

    // Initialize popup when opened
    initializePopup();
});