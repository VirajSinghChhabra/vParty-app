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

        }
    }
});