import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Store system message
let dashboardSystemMessage = null;

// Route to handle chat messages
app.post('/chat', async (req, res) => {
    try {
        const { message, messages = [] } = req.body;
        
        console.log('Received messages:', messages);
        console.log('Current message:', message);

        // Format messages for Mistral API
        const formattedMessages = messages.map(msg => ({
            role: msg.role === 'agent' ? 'assistant' : msg.role,
            content: msg.content
        }));

        // Add current message
        formattedMessages.push({
            role: 'user',
            content: message
        });

        // Add system message if exists
        if (dashboardSystemMessage) {
            formattedMessages.unshift({
                role: 'system',
                content: dashboardSystemMessage.content
            });
        }

        console.log('Formatted messages for Mistral:', JSON.stringify(formattedMessages, null, 2));

        const response = await fetch('https://api.mistral.ai/v1/agents/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MISTRAL_LAUREN_API_KEY}`
            },
            body: JSON.stringify({
                agent_id: process.env.MISTRAL_AGENT_ID,
                messages: formattedMessages.slice(-10) // Keep last 10 messages
            })
        });

        const data = await response.json();
        console.log('Mistral API response:', JSON.stringify(data, null, 2));
        
        if (!response.ok) {
            throw new Error(data.error?.message || `API Error: ${response.status}`);
        }

        const agentResponse = data.choices?.[0]?.message?.content;
        if (!agentResponse) {
            throw new Error('Invalid response format from API');
        }

        res.json({ response: agentResponse });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Set system message
app.post('/set-system-message', (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'System message required' });
        }

        dashboardSystemMessage = {
            role: 'system',
            content: message,
            timestamp: Date.now()
        };

        res.json({ success: true });
    } catch (error) {
        console.error('System message error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clear system message
app.post('/clear-system-message', (req, res) => {
    try {
        dashboardSystemMessage = null;
        res.json({ success: true });
    } catch (error) {
        console.error('Clear system error:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3005;

function startServer(port) {
    try {
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`Port ${port} is busy, trying ${port + 1}`);
                startServer(port + 1);
            } else {
                console.error('Server error:', err);
            }
        });
    } catch (err) {
        console.error('Failed to start server:', err);
    }
}

startServer(PORT);
