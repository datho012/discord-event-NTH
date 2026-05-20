// Load environment variables from .env file
require('dotenv').config();

console.log('============================================');
console.log('   SWORD OF JUSTICE DISCORD ANNOUNCEMENT BOT ');
console.log('============================================');
console.log('Starting bot services...');

// Start the Discord bot
require('./src/bot.js');
