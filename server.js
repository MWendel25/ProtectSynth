// app.js
const express = require('express');
const path = require('path');

// Create the Express app
const app = express();

// Environment variables
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DOMAIN = process.env.DOMAIN || 'localhost';

// Middleware: Serve static files from the project root
app.use(express.static(__dirname));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'test.html'));
});

app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'test.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Start the server
app.listen(PORT, HOST, DOMAIN, () => {
  console.log(`🚀 Server running at: http://${DOMAIN}:${PORT}`);
  console.log(`📄 Test page: http://${DOMAIN}:${PORT}/test`);
  console.log(`🏥 Health check: http://${DOMAIN}:${PORT}/health`);
});
