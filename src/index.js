// DOM Elements
const messageInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-btn');
const clearButton = document.getElementById('clear-chat-btn');
const deleteAllButton = document.getElementById('delete-all-btn');
const messagesContainer = document.getElementById('messages');

// Constants
const STORAGE_KEY = 'chat_messages';
const MAX_MESSAGES = 100; // Maximum number of messages to store

// Message Management
class MessageManager {
    constructor(storageKey) {
        this.storageKey = storageKey;
        this.messages = this.loadMessages();
    }

    loadMessages() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) return [];
            
            const messages = JSON.parse(stored);
            if (!Array.isArray(messages)) {
                console.warn('Stored messages were not in array format. Resetting...');
                return [];
            }

            // Validate and clean messages
            return messages
                .filter(msg => this.isValidMessage(msg))
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, MAX_MESSAGES);
        } catch (error) {
            console.error('Error loading messages:', error);
            return [];
        }
    }

    isValidMessage(msg) {
        return msg 
            && typeof msg === 'object'
            && ['user', 'agent', 'system'].includes(msg.role)
            && typeof msg.content === 'string'
            && typeof msg.timestamp === 'number';
    }

    addMessage(role, content) {
        const message = {
            role,
            content,
            timestamp: Date.now(),
            id: crypto.randomUUID() // Unique ID for each message
        };

        this.messages.unshift(message);
        
        // Trim old messages if exceeding maximum
        if (this.messages.length > MAX_MESSAGES) {
            this.messages = this.messages.slice(0, MAX_MESSAGES);
        }

        this.saveMessages();
        return message;
    }

    saveMessages() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.messages));
        } catch (error) {
            console.error('Error saving messages:', error);
            if (error.name === 'QuotaExceededError') {
                // If storage is full, remove oldest messages
                this.messages = this.messages.slice(0, Math.floor(this.messages.length / 2));
                this.saveMessages();
            }
        }
    }

    clearMessages() {
        this.messages = [];
        this.saveMessages();
    }

    deleteAllData() {
        try {
            localStorage.removeItem(this.storageKey);
            this.messages = [];
        } catch (error) {
            console.error('Error deleting messages:', error);
        }
    }

    getMessages() {
        return this.messages;
    }
}

// Initialize MessageManager
const messageManager = new MessageManager(STORAGE_KEY);

// Add system message button
const systemMessageBtn = document.createElement('button');
systemMessageBtn.id = 'system-message-btn';
systemMessageBtn.textContent = 'Set System Message';
document.querySelector('#chat-area').appendChild(systemMessageBtn);

// Event Listeners
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
clearButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the current chat?')) {
        clearChat();
    }
});
deleteAllButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all stored messages? This cannot be undone.')) {
        deleteAll();
    }
});
systemMessageBtn.addEventListener('click', async () => {
    const systemMessage = prompt('Enter system message for the agent:');
    if (systemMessage?.trim()) {
        try {
            setInputState(false);
            
            const response = await fetch('/set-system-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: systemMessage })
            });

            if (!response.ok) {
                throw new Error('Failed to set system message');
            }

            // Add system message to UI
            messageManager.addMessage('system', `System Instruction: ${systemMessage}`);
            displayMessages();
        } catch (error) {
            console.error('Error setting system message:', error);
            messageManager.addMessage('system', `Error: Failed to set system message - ${error.message}`);
            displayMessages();
        } finally {
            setInputState(true);
        }
    }
});

// Functions
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // Disable input and button while processing
    setInputState(false);

    try {
        // Add user message
        messageManager.addMessage('user', message);
        displayMessages();
        messageInput.value = '';

        // Send message to backend
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const data = await response.json();
        
        // Add agent response
        messageManager.addMessage('agent', data.response);
        displayMessages();
    } catch (error) {
        console.error('Error:', error);
        messageManager.addMessage('system', `Error: ${error.message}`);
        displayMessages();
    } finally {
        setInputState(true);
    }
}

function displayMessages() {
    messagesContainer.innerHTML = '';
    messageManager.getMessages().forEach(message => {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.role}-message`;
        
        // Format the message content with proper HTML
        messageElement.innerHTML = formatMessageContent(message.content);
        
        // Add timestamp
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = formatTimestamp(message.timestamp);
        messageElement.appendChild(timestamp);

        messagesContainer.appendChild(messageElement);
    });
}

function formatMessageContent(content) {
    // Convert URLs to links
    content = content.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Preserve line breaks
    return content.replace(/\\n/g, '<br>');
}

function formatTimestamp(timestamp) {
    return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).format(new Date(timestamp));
}

function setInputState(enabled) {
    messageInput.disabled = !enabled;
    sendButton.disabled = !enabled;
    messageInput.style.opacity = enabled ? '1' : '0.7';
    sendButton.style.opacity = enabled ? '1' : '0.7';
}

async function clearChat() {
    try {
        await fetch('/clear-history', { method: 'POST' });
        messageInput.value = '';
        messageManager.clearMessages();
        displayMessages();
    } catch (error) {
        console.error('Error clearing chat history:', error);
        messageManager.addMessage('system', 'Error: Failed to clear chat history');
        displayMessages();
    }
}

function deleteAll() {
    messageManager.deleteAllData();
    displayMessages();
}