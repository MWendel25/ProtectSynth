const { spawn } = require('child_process');
const http = require('http');

const DOMAIN = process.env.DOMAIN || 'localhost';
const PORT = process.env.PORT || 3000;

// Check if server is running
function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(`http://${DOMAIN}:${PORT}/health`, (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Start the server
function startServer() {
  console.log('🚀 Starting server...');
  const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    detached: true
  });
  
  // Give the server time to start
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(server);
    }, 3000);
  });
}

// Main function
async function main() {
  console.log('🔍 Checking if server is running...');
  
  const isRunning = await checkServer();
  
  if (!isRunning) {
    console.log('❌ Server not running, starting it now...');
    await startServer();
    
    // Wait a bit more and check again
    await new Promise(resolve => setTimeout(resolve, 2000));
    const isNowRunning = await checkServer();
    
    if (!isNowRunning) {
      console.log('❌ Failed to start server. Please start it manually with: npm run server');
      process.exit(1);
    }
    
    console.log('✅ Server started successfully!');
  } else {
    console.log('✅ Server is already running!');
  }
  
  // Start the data generator
  console.log('🚀 Starting data generator...');
  const dataGenerator = spawn('node', ['scripts/sendData.js'], {
    stdio: 'inherit'
  });
  
  dataGenerator.on('close', (code) => {
    console.log(`📊 Data generator finished with code ${code}`);
    process.exit(code);
  });
}

main().catch(console.error);
