class ChatManager {
    constructor(room) {
        this.room = room;
        this.message = [];
        this.username = '';
        this.initialized = false;
        this.setupChatUI();
        this.setupMessageHandling();
    }

    // Create chat container 
    async setupChatUI() {
        this.chatContainer = document.createElement('div');
        this.chatContainer.id = 'watch-party-chat';
        this.chatContainer.innerHTML = `
        <div class="chat-header">
            <h3>Watch Party Chat</h3>
            <button class="toggle-chat">→</button>
        </div>
        <div class="messages-container"></div>
        <div class="chat-input-container"></div>
            <input type="text" placeholder="Example: I love this scene" class="chat-input">
            <button class="send-button">Send</button>
        </div>
        `;

        const link = document.createElement('link');
        link.href = chrome.runtime.getURL('assets/chat.css');
        link.type = 'text/css';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        document.body.appendChild(this.chatContainer);

        this.messagesContainer = this.chatContainer.querySelector('.messages-container');
        this.input = this.chatContainer.querySelector('.chat-input');
        this.sendButton = this.chatContainer.querySelector('.send-button');
        this.toggleButton = this.chatContainer.querySelector('.toggle-chat');

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Send message on button clicl
        this.sendButton.addEventListener('click', () => this.sendMessage());

        // Send message on Enter key 
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        this.toggleButton.addEventListener('click', () => this.toggleChat());
    }

    // Listen for incoming messages from Room
    setupMessageHandling() {
        this.room.on('CHAT_MESSAGE', (data) => {
            this.displayMessage(data);
        });
    }

    async sendMessage() {
        const text = this.input.value.trim();
        if (!text) return;

        const message = {
            type: 'CHAT_MESSAGE',
            text: text,
            username: this.username,
            timestamp: Date.now()
        };

        try {
            await this.room.sendCommand(message);
            this.displayMessage(message);
            this.input.value = '';
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }
    
    displayMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat_message';
        messageDiv.innerHTML = `<span class="username">${message.username}</span>: ${message.text}`;

        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

        this.messagesContainer.push(message);
    }

    toggleChat() {
        this.chatContainer.classList.toggle('hidden');
        this.chatContainer.classList.contains('hidden') ? '←' : '→';
    }

    setUsername(username) {
        this.username = username;
    }

    cleanup() {
        if (this.chatContainer) {
            this.chatContainer.remove();
        }
    }
}