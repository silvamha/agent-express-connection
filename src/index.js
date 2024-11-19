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
        this.systemMessageKey = `${storageKey}_system`;
        this.messages = this.loadMessages();
        this.systemMessage = this.loadSystemMessage();
    }

    loadSystemMessage() {
        try {
            const stored = localStorage.getItem(this.systemMessageKey);
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('Error loading system message:', error);
            return null;
        }
    }

    setSystemMessage(content, isTemporary = false) {
        try {
            const systemMessage = {
                role: 'system',
                content,
                timestamp: Date.now(),
                isTemporary
            };
            localStorage.setItem(this.systemMessageKey, JSON.stringify(systemMessage));
            this.systemMessage = systemMessage;
            return true;
        } catch (error) {
            console.error('Error saving system message:', error);
            return false;
        }
    }

    getConversationHistory() {
        // Get base history
        const history = [...this.messages];
        
        // Add system message if exists
        if (this.systemMessage) {
            history.unshift({
                ...this.systemMessage,
                timestamp: this.systemMessage.timestamp || Date.now()
            });
        }
        
        return history.map(msg => ({
            role: msg.role === 'agent' ? 'assistant' : msg.role,
            content: msg.content,
            timestamp: msg.timestamp
        }));
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

    addMessage(role, content) {
        const message = {
            role: role === 'assistant' ? 'agent' : role, // Store as 'agent' internally
            content: content || '',
            timestamp: Date.now()
        };

        this.messages.unshift(message);
        
        // Trim messages but preserve system message
        if (this.messages.length > MAX_MESSAGES) {
            this.messages = this.messages.slice(0, MAX_MESSAGES);
        }

        this.saveMessages();
        return message;
    }

    saveMessages() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.messages));
            return true;
        } catch (error) {
            console.error('Error saving messages:', error);
            return false;
        }
    }

    clearChat() {
        // Clear chat but preserve system message
        this.messages = [];
        this.saveMessages();
    }

    deleteAllData() {
        // Clear everything including system message
        this.messages = [];
        this.systemMessage = null;
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem(this.systemMessageKey);
    }

    isValidMessage(msg) {
        return msg 
            && typeof msg === 'object'
            && ['user', 'agent', 'system'].includes(msg.role)
            && typeof msg.content === 'string'
            && typeof msg.timestamp === 'number';
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
            messageManager.setSystemMessage(`System Instruction: ${systemMessage}`);
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
    try {
        const message = messageInput.value.trim();
        if (!message) return;

        setInputState(false);
        messageInput.value = '';

        // Check if it's a system instruction command
        if (message.startsWith('/system ')) {
            const systemInstruction = message.substring(8).trim();
            if (systemInstruction) {
                await handleSystemInstruction(systemInstruction);
                return;
            }
        }

        // Add user message to UI
        messageManager.addMessage('user', message);
        displayMessages();

        // Get conversation history including system message
        const messages = messageManager.getConversationHistory();

        // Send message to server
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message,
                messages
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to send message');
        }

        if (!data.response) {
            throw new Error('Invalid response from server');
        }
        
        // Add agent response to UI
        messageManager.addMessage('assistant', data.response);
        displayMessages();
    } catch (error) {
        console.error('Error sending message:', error);
        messageManager.addMessage('system', `Error: ${error.message}`);
        displayMessages();
    } finally {
        setInputState(true);
    }
}

async function handleSystemInstruction(instruction) {
    try {
        // Send to server first
        const response = await fetch('/set-system-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: instruction })
        });

        if (!response.ok) {
            throw new Error('Failed to set system message');
        }

        // If server accepts, update local storage
        messageManager.setSystemMessage(instruction, true);
        messageManager.addMessage('system', `System instruction updated: ${instruction}`);
        displayMessages();
    } catch (error) {
        console.error('Error setting system instruction:', error);
        messageManager.addMessage('system', `Error: ${error.message}`);
        displayMessages();
    }
}

function displayMessages() {
    try {
        messagesContainer.innerHTML = '';
        const messages = messageManager.getConversationHistory();
        
        messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${message.role}-message`;
            
            // Create message content
            const contentElement = document.createElement('div');
            contentElement.className = 'message-content';
            contentElement.innerHTML = formatMessageContent(message.content);
            messageElement.appendChild(contentElement);
            
            // Add timestamp if available
            if (message.timestamp) {
                const timestampElement = document.createElement('div');
                timestampElement.className = 'message-timestamp';
                timestampElement.textContent = formatTimestamp(message.timestamp);
                messageElement.appendChild(timestampElement);
            }
            
            messagesContainer.appendChild(messageElement);
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
        console.error('Error displaying messages:', error);
    }
}

function formatMessageContent(content) {
    try {
        if (!content) return '';
        // Escape HTML to prevent XSS
        const escaped = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        
        // Convert newlines to <br>
        return escaped.replace(/\n/g, '<br>');
    } catch (error) {
        console.error('Error formatting message content:', error);
        return '';
    }
}

function formatTimestamp(timestamp) {
    try {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return ''; // Invalid date
        return date.toLocaleTimeString();
    } catch (error) {
        console.error('Error formatting timestamp:', error);
        return '';
    }
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
        messageManager.clearChat();
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

// Add help message to show system instruction command
const helpMessage = `
💡 Available Commands:
/system [instruction] - Set a temporary system instruction
Example: /system Act as a helpful coding assistant

Note: System instructions set via chat will persist until cleared.
`;

messageManager.addMessage('system', helpMessage);
displayMessages();