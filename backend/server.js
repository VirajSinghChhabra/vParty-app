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

app.get('/', (req, res) => { 
    res.send('Hello from the backend!');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

