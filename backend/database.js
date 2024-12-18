const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    // Create users table 
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            password TEXT,
            googleId TEXT
            )`);
        });
    
        // Create sessions table
        db.run(`
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                videoId TEXT,
                currentTime REAL,
                isPlaying INTEGER,
                hostId INTEGER
            )
        `);

module.exports = db


