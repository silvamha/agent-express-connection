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

// Store conversation history
let conversationHistory = [];

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
        const { message, role = 'user' } = req.body;
        console.log('Received message:', { role, message });

        // Add message to conversation history
        conversationHistory.push({ role, content: message });

        // Keep only last 10 messages to avoid context length issues
        if (conversationHistory.length > 10) {
            conversationHistory = conversationHistory.slice(-10);
        }

        console.log('Using Agent ID:', process.env.MISTRAL_AGENT_ID);
        console.log('API Key length:', process.env.MISTRAL_LAUREN_API_KEY?.length);
        console.log('Current conversation history:', JSON.stringify(conversationHistory, null, 2));

        const requestBody = {
            agent_id: process.env.MISTRAL_AGENT_ID,
            messages: conversationHistory
        };

        console.log('Request body:', JSON.stringify(requestBody, null, 2));

        const response = await fetch('https://api.mistral.ai/v1/agents/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MISTRAL_LAUREN_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        const responseData = await response.json();
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        console.log('MistralAI Response:', JSON.stringify(responseData, null, 2));

        if (!response.ok) {
            throw new Error(responseData.error?.message || 'Failed to communicate with MistralAI');
        }

        // Add agent's response to conversation history
        const agentResponse = responseData.choices[0].message.content;
        conversationHistory.push({ role: 'assistant', content: agentResponse });

        res.json({ response: agentResponse });
    } catch (error) {
        console.error('Error in chat endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route to clear conversation history
app.post('/clear-history', (req, res) => {
    console.log('Clearing conversation history');
    conversationHistory = [];
    res.json({ message: 'Conversation history cleared' });
});

// Route to set system message
app.post('/set-system-message', (req, res) => {
    try {
        console.log('Setting system message:', req.body);
        const { message } = req.body;
        
        if (!message || typeof message !== 'string') {
            throw new Error('Invalid system message');
        }

        // Replace any existing system message
        conversationHistory = conversationHistory.filter(msg => msg.role !== 'system');
        
        // Add new system message at the start
        conversationHistory.unshift({ role: 'system', content: message });
        
        console.log('Updated conversation history:', JSON.stringify(conversationHistory, null, 2));
        
        res.json({ 
            message: 'System message set',
            history: conversationHistory 
        });
    } catch (error) {
        console.error('Error setting system message:', error);
        res.status(400).json({ error: error.message });
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
