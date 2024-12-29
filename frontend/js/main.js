document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('#login form');
    const registerForm = document.querySelector('#register form');
    const editProfileForm = document.querySelector('#profile form');
    const resetPasswordForm = document.querySelector('#password form');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', handleEditProfile);
    }
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', handleResetPassword);
    }
});

// Handle user login 
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            window.postMessage({ type: 'FROM_PAGE', action: 'storeToken', token: data.token }, '*');
            alert('Login successful');
            // *** Maybe add a redirect to home page or update UI
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred during login');
    }
}

// Handle user registration 
async function handleRegister(event) {
    event.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();
        if (response.ok) {
            alert('Registration successful');
            // *** Can add redirect to login tab or update UI
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while registering');
    }
}

// Handle user edit profile 
async function handleEditProfile(event) {
    event.preventDefault();
    const name = document.getElementById('profileName').value;
    const email = document.getElementById('profileEmail').value;
    const token = localStorage.getItem('token');

    try {
        const response = await fetch('http://localhost:3000/edit-profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, email })
        });

        const data = await response.json();
        if (response.ok) {
            alert('Profile updated successfully');
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while updating profile');
    }
}

// Hsndle reset password event 
async function handleResetPassword(event) {
    event.preventDefault();
    const email = document.getElementById('resetEmail').value;

    try {
        const response = await fetch('http://localhost:3000/forgot-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();
        if (response.ok) {
            alert('Password reset link sent to your email');
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while requesting password reset');
    }
}
