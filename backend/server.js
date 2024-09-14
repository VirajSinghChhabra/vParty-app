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

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Register route 
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

// Login route 
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
        return res.status(400).json({ message: 'Email or password must be provided to update'});
    }

    let query = `UPDATE users SET `;
    const queryParams = [];

    if (email) {
        query += `email = ? `;
        queryParams.push(email);
    }

    // // Wasn't handling both email and password update correctly, asked ChatGPT.
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

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

