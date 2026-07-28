const path = require('path');

// Load environment variables from the backend/.env file
require("dotenv").config();

const app = require('./app');
const { logger } = require('./utils/logger');

const PORT = process.env.PORT || 5000;

// Start listening for incoming connections
const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error(`Unhandled Rejection Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
