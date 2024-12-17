if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database');
const { authenticateToken, createToken, hashPassword, comparePassword } = require('./auth');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);
const io = socketIo(server);

// *** CHANGE FOR PRODUCTION - Session storage (use database for production)
const sessions = {}; // Persisten session state. Note - current implementation is only for 1 session for multiple users. 

// Transporter for sending emails (forgot password feature)
const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.urlencoded({ extended: true }));

// Register route GET method
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/register.html'));
});

// Register route POST method
app.post('/register', (req,res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    // Hash the password
    const hashedPassword = hashPassword(password);

    // Insert new user into the database
    db.run(
        `INSERT INTO users (email, password) VALUES (?, ?)`,
        [email, hashedPassword],
        function (err) {
            if (err) {
                return res.status(500).json({ message: 'Error registering user' });
            }
            res.status(201).json({ message: 'User registered successfully' });
        }
    );
});

// Login route GET method
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/login.html'));
});

// Login route POST method
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password ) {
        return res.status(400).json({ message: 'Email and password are required' }); 
    }

    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err || !user || !comparePassword(password, user.password)) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = createToken({ id: user.id, email: user.email });
        res.status(200).json({ token });
    });
});

// Edit user profile 
app.put('/edit-profile', authenticateToken, (req, res) => {
    const { email, password } = req.body;
    // Get user id from token 
    const userId = req.user.id;

    if (!email && !password) {
        return res.status(400).json({ message: 'Email or password must be provided to update' });
    }

    let query = `UPDATE users SET `;
    const queryParams = [];

    if (email) {
        query += `email = ? `;
        queryParams.push(email);
    }

    // Wasn't handling both email and password update correctly, asked ChatGPT.
    if (password) {
        if (email) query += `, `; 
        const hashedPassword = hashPassword(password);
        query += `password = ? `;
        queryParams.push(hashedPassword);
    }

    query += `WHERE id = ?`;
    queryParams.push(userId)

    db.run(query, queryParams, function (err) {
        if (err) {
            return res.status(500).json({ message: 'Error updating profile' });
        }
        res.status(200).json({ message: 'Profile updated successfully' });
    });
});

// Route to request password reset 
app.post('/forgot-password', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required to reset password'});
    }

    // Generate a unique reset token then store it plus the expiry date in the db
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 360000; // 1hr reset time 

    db.run(
        `UPDATE users SET resetToken = ?, resetTokenExpiry = ? WHERE email = ?`,
        [resetToken, resetTokenExpiry, email],
        function (err) {
            if (err) {
                return res.status(500).json({ message: 'Error generating reset token' });
            }

            // Send email with the reset link 
            // *** IMPORTANT Change link for production ***
            const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email, 
                subject: 'Password Reset Request',
                html: `
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                    <h2>Password Reset Request</h2>
                    <p>You requested a password reset. Please click the link below to reset your password:</p>
                    <a href="${resetLink}" 
                       style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                       Reset Password
                    </a>
                    <p>If you did not request this, please ignore this email.</p>
                </div>
            `            
            };

            transporter.sendMail(mailOptions, (err, info) => {
                if (err) {
                    return res.status(500).json({ message: 'Error sending email' });
                }
                res.status(200).json({ message: 'Password reset link sent to email' });
            });
        }
    );
});

// Route to reset password 
app.post('/reset-password', (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required' });
    }

    // Check if the token is valid and has not expired
    db.get(
        `SELECT * FROM users WHERE resetToken = ? AND resetTokenExpiry > ?`,
        [token, Date.now()],
        (err, user) => {
            if (err || !user) {
                return res.status(400).json({ message: 'Invalid or expired token' });    
            }

            // Hash the new password. Then update user's password and clear (NULL) the reset token
            const hashedPassword = hashPassword(newPassword);

            db.run(
                `UPDATE users SET password = ?, resetToken = NULL, resetTokenExpiry = NULL WHERE resetToken = ?`,
                [hashedPassword, token],
                function (err) {
                    if (err) {
                        return res.status(500).json({ message: 'Error resetting password' });
                    }
                    res.status(200).json({ message: 'Password reset successfully' });
                }
            );
        }
    );
});

// Delete user profile 
app.delete('/delete-profile', authenticateToken, (req, res) => {
    // Get user id from token 
    const userId = req.user.id;

    db.run(`DELETE FROM users WHERE id = ?`, [userId], function (err) {
        if (err) {
            return res.status(500).json({ message: 'Error deleting profile'});
        }
        res.status(200).json({ message: 'User profile deleted successfully'});
    });
});

// Protected route
app.get('/protected', authenticateToken, (req, res) => {
    res.status(200).json({ message: 'This is a protected route' });
});

// Routes for Watch party session management 
app.get('/join/:sessionId', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/join.html'));
});

// On session creation, store session state 
app.post('/session', authenticateToken, (req, res) => {
    const sessionId = uuidv4();
    const userId = req.user.id;

    if (sessions[sessionId]) {
        sessions[sessionId].participants.push(userId);
        res.json({ 
            success: true,
            videoId: sessions[sessionId].videoId,
            currentTime: sessions[sessionId].currentTime,
            isPlaying: sessions[sessionId].isPlaying 
        });
    } else {
        res.status(404).json({ success: false, error: 'Session not found' });
    }
});

// Handle state retrieval for New Users
app.post('/session/:sessionId/join', authenticateToken, (req, res) => {
    const sessionId = req.params.sessionId.sessionId;
    const userId = req.user.id;

    if (sessions[sessionId]) {
        sessions[sessionId].participants.push(userId);
        res.json({ 
            success: true,
            videoId: sessions[sessionId].videoId,
            currentTime: sessions[sessionId].currentTime,
            isPlaying: sessions[sessionId].isPlaying 
        });
    } else {
        res.status(404).json({ success: false, error: 'Session not found' });
    }
});

// WebSocket handling
io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('joinSession', (sessionId) => {
        socket.join(sessionId);
    });

    // Update the session state when receiving video actions
    socket.on('videoAction', (data) => {
        if (sessions[data.sessionId]) {
        // Update the session state with the latest video time and playback status 
        sessions[data.sessionId].currentTime = data.currentTime;
        sessions[data.sessionId].isPlaying = data.isPlaying;
        // Broadcast the updated state to all users in the session
        socket.to(data.sessionId).emit('videoAction', data.action);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});