const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const menuRoutes = require('./routes/menuRoutes');
const offerRoutes = require('./routes/offerRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

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
  console.error('Global Error Handler:', err.stack);
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred on the server.'
  });
});

module.exports = app;
