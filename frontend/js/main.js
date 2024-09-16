document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('editProfileForm').addEventListener('submit', handleEditProfile);
    document.getElementById('forgotPasswordForm').addEventListener('submit', handleForgotPassword);
    document.getElementById('resetPasswordForm').addEventListener('submit', handleResetPassword);
});

// Handle User Registration
async function handleRegister(event) {
    event.preventDefault();
    const form = form.target;
    const email = form.email.value;
    const password = form.passord.value;
    const confirmPassword = form.confirmPassword.value;

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    try {
        const response = await fetch('/register', {
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
        alert('An error occured');
    }
}

// Handle User Login
async function handleLogin(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.email.value;
    const password = form.passord.value;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            alert('Login successful');
            form.reset();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error: ', error);
        alert('An error occured');
    }
}

// Handle Edit Profile 
// Do edit-profile.html and this again considering what if user only wants to update either email or password. 
// *** IMPORTANT - Modified but only as a workaround. 
// Note to self: Can be made bette if you implement a single webpage for user to do everything. 
// Login/Logout, Edit Profile > option to Change Email or Change Password, Delete Profile
// But this will probably require a complete redo of html file into templates/Jinja.
async function handleEditProfile(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.email.value;
    const password = form.password.value;
    const isDeleteProfile = form.dataset.action === 'delete';
    const token = localStorage.getItem('token');

    if (isDeleteProfile) {
        // Handle delete profile
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
                    window.location.href = 'index.html';
                    // *** IMPORTANT *** Redirect to index.html or if you make new homepage file
                } else {
                    const data = await response.json();
                    alert(`Error: ${data.message}`);
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred');
            }
        }
        return; 
    }

    // Empty object to store updates 
    let updateData = {};

    // Way to only add fields that are not empty
    if (email) updateData.email = email;
    if (password) updateData.password = password;

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
        console.error('Error: ', error);
        alert('An error occured');
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