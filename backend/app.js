const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const { logger, clientLogger } = require('./utils/logger');
const authRoutes = require('./routes/authRoutes');
const menuRoutes = require('./routes/menuRoutes');
const offerRoutes = require('./routes/offerRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// HTTP Request Logging through winston
app.use(
  morgan(':method :url :status :res[content-length] - :response-time ms', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  })
);

// Serve uploads statically and create the directory if it doesn't exist
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/offers', offerRoutes);

// Endpoint to receive client-side logs from the frontend
app.post('/api/logs/client', (req, res) => {
  const { level = 'info', message, meta } = req.body;
  if (!message) {
    return res.status(400).json({ success: false, message: 'Log message is required.' });
  }

  const logMsg = meta ? `${message} | Meta: ${JSON.stringify(meta)}` : message;

  if (level === 'error') {
    clientLogger.error(logMsg);
  } else if (level === 'warn') {
    clientLogger.warn(logMsg);
  } else {
    clientLogger.info(logMsg);
  }

  res.json({ success: true });
});

// Test route to verify workflow deployment
app.get('/test', (req, res) => {
  res.send('test page');
});

app.get('/api/test', (req, res) => {
  res.send('test page');
});

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Vingo API is running...'
  });
});

// 404 Not Found Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'API route not found.'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(`Global Error Handler: ${err.stack}`);
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred on the server.'
  });
});

module.exports = app;
