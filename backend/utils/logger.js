const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Check target log directory
const prodLogDir = '/home/u583298036/domains/api.thevingo.com/logs';
const localLogDir = path.join(__dirname, '../logs');

// Decide directory: Use prod log directory if it exists, or if running in home dir of the server user
let logDir = localLogDir;
if (fs.existsSync('/home/u583298036/domains/api.thevingo.com') || process.env.NODE_ENV === 'production') {
  logDir = prodLogDir;
}

// Ensure the log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
  })
);

// Daily Rotate transport for general backend logs
const backendTransport = new DailyRotateFile({
  filename: path.join(logDir, 'backend-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d',
  format: logFormat
});

// Daily Rotate transport for frontend client logs
const frontendTransport = new DailyRotateFile({
  filename: path.join(logDir, 'frontend-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d',
  format: logFormat
});

// Logger instance for backend
const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    backendTransport,
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Logger instance for frontend
const clientLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    frontendTransport
  ]
});

module.exports = {
  logger,
  clientLogger
};
