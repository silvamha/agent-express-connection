// Import required dependencies
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005; // Changed port to 3005

// Middleware
app.use(cors());
app.use(express.json());

// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, {
        body: req.body,
        headers: req.headers
    });
    next();
});

// Route to handle chat messages
app.post('/chat', async (req, res) => {
    try {
        const { message, messages = [] } = req.body;
        console.log('Received message:', message);
        console.log('Received conversation history:', messages);

        // Use the provided conversation history
        const requestBody = {
            agent_id: process.env.MISTRAL_AGENT_ID,
            messages: messages.slice(-10) // Keep last 10 messages including system message
        };

        console.log('Using Agent ID:', process.env.MISTRAL_AGENT_ID);
        console.log('API Key length:', process.env.MISTRAL_LAUREN_API_KEY?.length);
        console.log('Request to Mistral:', JSON.stringify(requestBody, null, 2));

        const response = await fetch('https://api.mistral.ai/v1/agents/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MISTRAL_LAUREN_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`Mistral API responded with status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Mistral response:', data);

        res.json({ response: data.response });
    } catch (error) {
        console.error('Error in chat endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route to set system message
app.post('/set-system-message', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'System message is required' });
        }

        const systemMessage = {
            role: 'system',
            content: message
        };

        res.json({ success: true });
    } catch (error) {
        console.error('Error setting system message:', error);
        res.status(500).json({ error: 'Failed to set system message' });
    }
});

// Route to clear chat history
app.post('/clear-history', (req, res) => {
    try {
        // Clear conversation history but keep system message
        const conversationHistory = [];
        res.json({ success: true });
    } catch (error) {
        console.error('Error clearing chat history:', error);
        res.status(500).json({ error: 'Failed to clear chat history' });
    }
});

// Start server with error handling
const server = app.listen(PORT)
    .on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use. Please try a different port or kill the process using this port.`);
            process.exit(1);
        } else {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    })
    .on('listening', () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log('Environment check:');
        console.log('API Key present:', !!process.env.MISTRAL_LAUREN_API_KEY);
        console.log('Agent ID:', process.env.MISTRAL_AGENT_ID);
    });
