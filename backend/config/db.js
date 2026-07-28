const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables if not already set (e.g. standalone test runs)
if (!process.env.DB_HOST) {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const { logger } = require('../utils/logger');

// Test the connection immediately
(async () => {
  try {
    const connection = await pool.getConnection();
    logger.info('Database connected successfully.');
    connection.release();
  } catch (err) {
    logger.error(`Database connection failed: ${err.message}`);
  }
})();

module.exports = pool;
