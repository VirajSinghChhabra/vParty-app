document.addEventListener('DOMContentLoaded', function() {
    const userInfo = document.getElementById('logged-in');
    const notLoggedIn = document.getElementById('not-logged-in');
    const startPartyBtn = document.getElementById('start-party-btn');
    const inviteLinkInput = document.getElementById('invite-link');
    const copyLinkBtn = document.getElementById('copy-invite-btn');
    const redirectBtn = document.getElementById('redirect-btn');

    // Function to check if user is logged in. Check local storage for token.
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
            console.error('Invalid token:', e);
            return null;
        }
    }

    // Check if the user is logged in 
    const isLoggedIn = checkLoginStatus();

    if (isLoggedIn) {
        userInfo.classList.remove('d-none)');
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

    // Video selection logic
    // Function to handle messages from content.js (whether a video is playing)
    chrome.runtime.onMessage.addEventListener((message, sender, sendResponse) => {
        const startPartyBtn = document.getElementById('start-party-btn');
        const selectVideoMsg = document.getElementById('select-video-msg');

        if (message.videoPlaying) {
            // Enable "Start Watch Party" button if a video is playinh
            startPartyBtn.disabled = false;
            startPartyBtn.classList.remove('btn-secondary');
            startPartyBtn.classList.add('btn-primary');
            selectVideoMsg.classList.add('d-none');
        } else {
            // Disable the button if no video is playing
            startPartyBtn.disabled = true;
            startPartyBtn.classList.remove('btn-primary');
            startPartyBtn.classList.add('btn-secondary');
            selectVideoMsg.classList.remove('d-none');
        }
    });

    // Redirect button
    redirectBtn.addEventListener('click', function() {
        chrome.tabs.create({ url: 'https://netflix.com' });
    });

    // Copy button logi 
    // Function for copy to clipboard button
    function copyToClipboard() {
        const inviteLink = document.getElementById('invite-link').value;

        if (!inviteLink) {
            console.error('No text to copy');
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
    document.getElementById('copy-link-btn').addEventListener('click', copyToCLipboard);

});