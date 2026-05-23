// Load environment variables from .env file
require('dotenv').config();

const http = require('http');

// Create a dummy HTTP server for Render to bind to a port
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Discord Bot is running on Render!\n');
});

server.listen(PORT, () => {
  console.log(`[Web Server] Listening on port ${PORT}`);
});

console.log('============================================');
console.log('   SWORD OF JUSTICE DISCORD ANNOUNCEMENT BOT ');
console.log('============================================');
console.log('Starting bot services...');

// Start the Discord bot
require('./src/bot.js');
