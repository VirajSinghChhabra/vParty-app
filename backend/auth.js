const jwt = require('jsonwebtokens');
const bcrypt = require('bcrypt');
const db = require('./database');

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your_jtw_secret_key';

// Middleware to verify JWT using bcrypt 
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err,user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Function to create JWT token 
const createToken = (user) => {
    return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
};

// Function to create hash passwords
const hashPassword = (password) => {
    return bcrypt.hashSync(password, 10);
};

// Function to compare passwords
const comparePassword = (password, hashedPassword) => {
    return bcrypt.compareSync(password, hashedPassword);
};

module.exports = { authenticateToken, createToken, hashPassword, comparePassword };

