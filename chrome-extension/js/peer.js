let peer = null;
let connection = null;

// Initialize the PeerJs instance
export function initializePeer() {
    peer = new Peer();
    peer.on('open', (id) => {
        console.log(`Peer initialized with ID: ${id}`);
        document.getElementById('connection-status').textContent = `Your ID: ${id}`;
    });

    peer.on('connection', (conn) => {
        console.log(`Connected to peer: ${conn.peer}`);
        document.getElementById('connection-status').textContent = `Connected to: ${conn.peer}`; // Update UI
        connection = conn;
        setupConnectionListeners(conn);
    });

    peer.on('error', (err) => {
        console.error('PeerJs error:', err);
        alert(`Error: ${err.message}`);
    });
}

// Connect to a peer by ID
export function connectToPeer(peerId) {
    connection = peer.connect(peerId);
    setupConnectionListeners(connection);
}

// Send messages to the connected peer
export function sendPeerMessage(type, data) {
    if (connection && connection.open) {
        connection.send({ type, data });
        console.log(`Sent action: ${type} with data: ${data}`);
    } else {
        console.warn('No open connection to send data');
    }
}

// Set up listeners for peer connection 
export function setupPeerListeners(callback) {
    if (connection) {
        connection.on('data', callback);
    }
}

function setupConnectionListeners(conn) {
    conn.on('data', (data) => {
        console.log('Received data:', data);
        handlePeerData(data);
    });

    conn.on('open', () => {
        console.log('Connection opened with peer');
    });

    conn.on('close', () => {
        console.log('Connection closed with peer');
    });
}