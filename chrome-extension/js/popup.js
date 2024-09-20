document.addEventListener('DOMContentLoaded', function() {
    const userInfo = document.getElementById('logged-in');
    const notLoggedIn = document.getElementById('not-logged-in');
    const startPartyBtn = document.getElementById('start-party-btn');
    const inviteLinkInput = document.getElementById('invite-link');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const redirectBtn = document.getElementById('redirect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // Function to check if user is logged in. Check local storage for token. (so only users logged in can start a party)
    function checkLoginStatus() {
        const token = localStorage.getItem('token');
        return token !== null;
    }

    // Function to parse JWT and extract user info for displaying in header of the popup
    function parseJwt(token) {
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

    // Check if the user is logged in 
    const isLoggedIn = checkLoginStatus();

    if (isLoggedIn) {
        userInfo.classList.remove('d-none');
        notLoggedIn.classList.add('d-none');

        // Extract and display user info from the token (to be shown in header)
        const token = localStorage.getItem('token');
        const user = parseJWT(token);
        if (user) {
            document.getElementById('username').textContent = user.name || 'User';
            document.getElementById('email').textContent = user.email || 'user@example.com'; 
        }
    } else {
        userInfo.classList.add('d-none');
        userInfo.classList.remove('d-none');
    }    

    // Redirect button
    redirectBtn.addEventListener('click', function() {
        chrome.tabs.create({ url: 'https://netflix.com' });
    });

    // Copy button logic
    // Function for copy to clipboard button
    function copyToClipboard() {
        const inviteLink = inviteLinkInput.value;

        if (!inviteLink) {
            console.error('No text to copy');
            alert('No invite link available to copy.');
            return;
        }

        // Clipboard API
        navigator.clipboard.writeText(inviteLink)
            .then(() => {
                console.log('Text successfully copied to clipboard');
                alert('Invite link copied to clipboard!');
            })
            .catch(err => {
                console.error('Failed to copy text', err);
                alert('Failed to copy invite link');
            });
    }

    // Event listener for the copy button
    copyLinkBtn.addEventListener('click', copyToClipboard);

    // Open Sidebar toggle button
    document.getElementById('open-sidebar-btn').addEventListener('click', () => {
        // Send a message to the content script to open the sidebar
        chrome.runtime.sendMessage({ action: 'toggleSidebar', open: true });
    });

    // Video selection logic
    // Handle messages from content.js (whether a video is playing)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        const selectVideoMsg = document.getElementById('select-video-msg');

        if (message.videoPlaying) {
            // Enable "Start Watch Party" button if a video is playinh
            startPartyBtn.disabled = false;
            startPartyBtn.classList.replace('btn-secondary', 'btn-primary');
            selectVideoMsg.classList.add('d-none');

            // Show the Open Chat Sidebar button
            document.getElementById('open-sidebar-btn').classList.remove('d-none');
        } else {
            // Disable the button if no video is playing
            startPartyBtn.disabled = true;
            startPartyBtn.classList.replace('btn-primary', 'btn-secondary');
            selectVideoMsg.classList.remove('d-none');
            
            // Hide the Open Chat Sidebar button
            document.getElementById('open-sidebar-btn').classList.add('d-none');
        }
    });

    // Start Watch party button click event
    startPartyBtn.addEventListener('click', async () => {
        // Check if user is logged in (so only users logged in can join party)
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('User needs to be logged in to join a watch party');
            alert('You must be logged in to start a watch party.');
            return;
        }

        // If logged in, start the watch party 
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'startParty' }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Error sending message:', chrome.runtime.lastError);
                    alert('Failed to start the watch party. Please try again.');
                    return;
                }

                if (response && response.videoId) {
                    const inviteLink = `https://vparty.com/join?videoId=${response.videoId}`;
                    inviteLinkInput.value = inviteLink;
                    document.getElementById('invite-section').classList.remove('d-none');
                    disconnectBtn.classic.remove('d-none');
                } else {
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
        console.error('User logged out');
        alert('You have been logged out.');
        location.reload(); // Reload to reset popup view
    })

});