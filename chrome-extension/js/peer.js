let peer = null;
let connection = null;

// Initialize the PeerJs instance
function initializePeer() {
    peer = new Peer();
    peer.on('open', (id) => {
        console.log(`Peer initialized with ID: ${id}`);
    });

    peer.on('connection', (conn) => {
        connection = conn;
        console.log(`Connected to peer: ${conn.peer}`);
        setupConnectionListeners(connection);
    });

    peer.on('error', (err) => {
        console.error('PeerJs error:', err);
        alert(`Error: ${err.message}`);
    });
}

// Connect to another peer by ID
function connectToPeer(peerId) {
    if (!peer) {
        console.error('Peer not initialized');
        return;
    }

    connection = peer.connect(peerId);
    setupConnectionListeners(connection);
}

function setupConnectionListeners(conn) {
    conn.on('data', (data) => {
        console.log('Received data:', data);
        handlePeerData(data); // Handle incoming video actions
    });

    conn.on('open', () => {
        console.log('Connection opened with peer:', conn.peer);
    });

    conn.on('close', () => {
        console.log('Connection closed with peer:', conn.peer);
    });

    conn.on('error', (err) => {
        console.error('PeerJS Connection Error:', err);
    });
}

// Send messages to the connected peer
function sendPeerMessage(type, currentTime) {
    if (connection && connection.open) {
        connection.send({ type, currentTime });
        console.log(`Sent message: ${type} with data: ${currentTime}`);
    } else {
        console.warn('No open connection to send message');
    }
}

// Set up listeners for peer connection 
function setupPeerListeners(callback) {
    if (connection) {
        connection.on('data', callback);
    }

 // Expose functions to the global scope
 window.initializePeer = initializePeer;
 window.connectToPeer = connectToPeer;
 window.sendPeerMessage = sendPeerMessage;
 window.setupConnectionListeners = setupConnectionListeners;
}