const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Serve static files from the root directory
app.use(express.static(__dirname));

// Serve the main test.html file at the root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'test.html'));
});

// Serve test.html at /test
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'test.html'));
});

// Add a simple health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Start the server
app.listen(PORT, HOST, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
    console.log(`📄 Test page available at http://localhost:${PORT}/test`);
    console.log(`🏥 Health check at http://localhost:${PORT}/health`);
});
