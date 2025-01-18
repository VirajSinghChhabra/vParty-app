class ChatManager {
    constructor(room) {
        this.room = room;
        this.messages = [];
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
            <h3>Party Chat</h3>
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
            this.input.value = '';
            await this.room.sendCommand('CHAT_MESSAGE', message);
            this.displayMessage(message);
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

        this.messages.push(message);
    }

    toggleChat() {
        this.chatContainer.classList.toggle('hidden');
        this.chatContainer.classList.contains('hidden') ? '←' : '→';
    }

    setUsername(username) {
        this.username = username;
    }

    cleanup() {
        // Quick chatGPT help as residual element was still showing and video player view wasn't resetting on closing chat
        // The issue was only partly fixed. The cleanup on disconnect works correctly but the blank element is still showing up on closing chat. 
        // Currently no way to open chat again if closed while in party, but it's okay. I completed my goal for this project. 
        if (this.chatContainer) {
            // Restore video player width 
            const videoPlayer = document.querySelector('.watch-video--player-view');
            if (videoPlayer) {
                videoPlayer.style.width = '100%';                                      
            }                                                                           
            // Then remove the chat container
            this.chatContainer.remove();
            // Then fix ffor how the black empty container was still showing
            const stylesheet = document.querySelector('link[href*="assets/chat.css"]');
            if (stylesheet) {
                stylesheet.remove()
            } 
        }
    }
}