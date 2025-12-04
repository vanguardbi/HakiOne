const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '..', '..', '..', 'haki_debug.log');

const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message} ${data ? JSON.stringify(data, null, 2) : ''}\n`;
  fs.appendFileSync(logFile, logEntry);
  console.log(message, data || ''); // Also log to console
};

module.exports = { log };
