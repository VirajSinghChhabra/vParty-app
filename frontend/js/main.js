document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');
    const editProfileForm = document.getElementById('editProfileForm');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const deleteProfileBtn = document.getElementById('delete-profile-btn');

    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', handleEditProfile);
    }
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    }
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', handleResetPassword);
    }
    if (deleteProfileBtn) {
        deleteProfileBtn.addEventListener('click', handleDeleteProfile);
    }
});


// Handle User Registration
async function handleRegister(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.email.value;
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    try { // *** IMPORTANT - update fetch link for production)
        const response = await fetch('http://localhost:3000/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (response.ok) {
            alert('Registration successful');
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error: ', error);
        alert('An error occured while registering');
    }
}

// Handle User Login
async function handleLogin(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.email.value;
    const password = form.password.value;

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
            // Store token in the login.html local storage 
            localStorage.setItem('token', data.token);
            // Send token to content.js (which will forward it to background.js) to make it available across all tabs
            window.postMessage({ type: 'FROM_PAGE', action: 'storeToken', token: data.token }, '*');
            alert('Login successful');
            form.reset();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error: ', error);
        alert('An error occured during login');
    }
}

// Handle Edit Profile 
// Do edit-profile.html and this again considering what if user only wants to update either email or password. 
// *** IMPORTANT - Modified but only as a workaround. 
// Note to self: Can be made bette if you implement a single webpage for user to do everything. 
// Login/Logout, Edit Profile > option to Change Email or Change Password, Delete Profile
// But this will probably require a complete redo of html file into templates/Jinja.
async function handleEditProfile(event) {
    event.preventDefault(); // Prevent form submission
    
    const form = document.getElementById('editProfileForm');
    const email = form.email.value;
    const password = form.password.value;
    const confirmPassword = form['confirm-password'].value;
    const token = localStorage.getItem('token');
    
    // Empty object to store updates
    let updateData = {};

    // Confirm password validation
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    // Only add fields that are not empty
    if (email) updateData.email = email;
    if (password) updateData.password = password;

    // Check if at least one field is filled
    if (!email && !password) {
        alert('Please fill out at least one field to update');
        return;
    }

    try {
        const response = await fetch('/edit-profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });

        const data = await response.json();
        if (response.ok) {
            alert('Profile updated successfully');
            form.reset();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred');
    }
}

// Handle Delete Profile
async function handleDeleteProfile() {
    const token = localStorage.getItem('token');

    if (confirm('Are you sure you want to delete your profile? This action cannot be undone.')) {
        try {
            const response = await fetch('/delete-profile', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                alert('Profile deleted successfully');
                window.location.href = 'index.html'; // Redirect to homepage after deletion
            } else {
                const data = await response.json();
                alert(`Error: ${data.message}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred');
        }
    }
}

// Handle Forgot Password 
async function handleForgotPassword(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.email.value;

    try {
        const response = await fetch('/forgot-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();
        if (response.ok) {
            alert('Password reset link sent');
            form.reset();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error: ', error);
        alert('An error occured');
    }
}

// Handle Reset Password 
async function handleResetPassword(event) {
    event.preventDefault();
    const form = event.target;
    const password = form.passord.value;
    const confirmPassword = form.confirmPassword.value;
    const token = new URLSearchParams(window.location.search).get('token');

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    try {
        const response = await fetch('/reset-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password, token })
        });

        const data = await response.json();
        if (response.ok) {
            alert('Password reset successful');
            form.reset();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error: ', error);
        alert('An error occured');
    }
}   