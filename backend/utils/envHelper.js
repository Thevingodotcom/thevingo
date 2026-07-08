const fs = require('fs');
const path = require('path');

// Helper to manually extract keys containing spaces (like 'JWT Secret') from the backend/.env file
const getEnvValue = (keyName) => {
  try {
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith(`${keyName}=`)) {
          return trimmed.substring(keyName.length + 1).trim();
        }
      }
    }
  } catch (err) {
    console.error(`Error reading ${keyName} manually from .env:`, err.message);
  }
  return null;
};

// Extract JWT Secret
const getJWTSecret = () => {
  return process.env.JWT_SECRET || getEnvValue('JWT_SECRET') || getEnvValue('JWT Secret');
};

module.exports = {
  getEnvValue,
  getJWTSecret
};
