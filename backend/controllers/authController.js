const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const path = require('path');
const { getJWTSecret } = require('../utils/envHelper');

const tokenSecret = getJWTSecret();
const tokenExpiry = process.env.JWT_EXPIRY || '24h';

// Helper to compare passwords (supports bcrypt hashing and plain text fallbacks)
const comparePassword = async (inputPassword, savedPassword) => {
  if (!savedPassword) return false;
  // If it starts with a standard bcrypt hash prefix
  if (savedPassword.startsWith('$2a$') || savedPassword.startsWith('$2b$') || savedPassword.startsWith('$2y$')) {
    return await bcrypt.compare(inputPassword, savedPassword);
  }
  // Otherwise, fallback to plain text comparison
  return inputPassword === savedPassword;
};

// Ensure database columns are configured correctly dynamically on startup
(async () => {
  try {
    // 1. Check/Add contact column
    const [contactCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'contact'");
    if (contactCols.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN contact VARCHAR(255) NULL");
      console.log("Added contact column to users table.");
    }
    
    // 2. Check/Add restaurant_name column
    const [restNameCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'restaurant_name'");
    if (restNameCols.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN restaurant_name VARCHAR(255) NULL");
      console.log("Added restaurant_name column to users table.");
    }

    // 3. Check/Add tagline column
    const [taglineCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'tagline'");
    if (taglineCols.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN tagline VARCHAR(255) NULL");
      console.log("Added tagline column to users table.");
    }

    // 3b. Check/Add hotel_address, hotel_city, hotel_state columns
    const [addrCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'hotel_address'");
    if (addrCols.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN hotel_address VARCHAR(500) NULL");
      console.log("Added hotel_address column to users table.");
    }

    const [cityCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'hotel_city'");
    if (cityCols.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN hotel_city VARCHAR(255) NULL");
      console.log("Added hotel_city column to users table.");
    }

    const [stateCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'hotel_state'");
    if (stateCols.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN hotel_state VARCHAR(255) NULL");
      console.log("Added hotel_state column to users table.");
    }

    // 4. Drop the four stats columns from the users table if they exist
    const columnsToDrop = ['scan_count', 'dish_count', 'category_count', 'active_offers_count'];
    for (const col of columnsToDrop) {
      const [cols] = await pool.query(`SHOW COLUMNS FROM users LIKE '${col}'`);
      if (cols.length > 0) {
        await pool.query(`ALTER TABLE users DROP COLUMN ${col}`);
        console.log(`Dropped column '${col}' from users table.`);
      }
    }

    // 5. Check/Add badge_type column to offers
    const [badgeCols] = await pool.query("SHOW COLUMNS FROM offers LIKE 'badge_type'");
    if (badgeCols.length === 0) {
      await pool.query("ALTER TABLE offers ADD COLUMN badge_type VARCHAR(255) NULL");
      console.log("Added badge_type column to offers table.");
    }

    // 6. Check/Add price_percent column to offers
    const [priceCols] = await pool.query("SHOW COLUMNS FROM offers LIKE 'price_percent'");
    if (priceCols.length === 0) {
      await pool.query("ALTER TABLE offers ADD COLUMN price_percent VARCHAR(255) NULL");
      console.log("Added price_percent column to offers table.");
    }

    // 7. Check/Add duration column to offers
    const [durCols] = await pool.query("SHOW COLUMNS FROM offers LIKE 'duration'");
    if (durCols.length === 0) {
      await pool.query("ALTER TABLE offers ADD COLUMN duration VARCHAR(255) NULL");
      console.log("Added duration column to offers table.");
    }

    // 8. Check/Add timing column to offers
    const [timingCols] = await pool.query("SHOW COLUMNS FROM offers LIKE 'timing'");
    if (timingCols.length === 0) {
      await pool.query("ALTER TABLE offers ADD COLUMN timing VARCHAR(255) NULL");
      console.log("Added timing column to offers table.");
    }

    // 9. Drop unique index uq_username if exists to support duplicate usernames
    try {
      const [indexes] = await pool.query("SHOW INDEX FROM users WHERE Key_name = 'uq_username'");
      if (indexes.length > 0) {
        await pool.query("ALTER TABLE users DROP INDEX uq_username");
        console.log("Dropped unique index 'uq_username' from users table.");
      }
    } catch (indexErr) {
      console.error("Error during dropping uq_username index:", indexErr.message);
    }

    // 10. Check/Add unique index uq_email on email column
    try {
      const [emailIndexes] = await pool.query("SHOW INDEX FROM users WHERE Key_name = 'uq_email'");
      if (emailIndexes.length === 0) {
        await pool.query("ALTER TABLE users ADD UNIQUE INDEX uq_email (email)");
        console.log("Added unique index 'uq_email' (email) to users table.");
      }
    } catch (indexErr) {
      console.error("Error during adding uq_email index:", indexErr.message);
    }
  } catch (err) {
    console.error("Error during schema configuration sync:", err.message);
  }
})();

/**
 * @desc Login authentication
 * @route POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Support generic identifiers or dedicated username/email properties
    const identifier = username || email || req.body.usernameOrEmail;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/Email and password are required.'
      });
    }

    // Query active and non-deleted user
    const [users] = await pool.query(
      'SELECT id, username, email, password, role, is_active, status, contact, restaurant_name, tagline FROM users WHERE (username = ? OR email = ?) AND is_deleted = 0 LIMIT 1',
      [identifier, identifier]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password.'
      });
    }

    const user = users[0];

    // Check account status
    if (user.is_active === 0 || user.status === 'hold') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated or put on hold.'
      });
    }

    // Verify Password
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password.'
      });
    }

    // Generate JWT Token
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, tokenSecret, { expiresIn: tokenExpiry });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        contact: user.contact,
        restaurant_name: user.restaurant_name,
        tagline: user.tagline
      }
    });

  } catch (error) {
    console.error('Login controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

/**
 * @desc Get currently logged-in user profile
 * @route GET /api/auth/profile
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await pool.query(
      'SELECT id, username, email, role, contact, restaurant_name, tagline, hotel_address, hotel_city, hotel_state, created_at FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    return res.status(200).json({
      success: true,
      user: users[0]
    });

  } catch (error) {
    console.error('Profile controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

/**
 * @desc Logout user (JWT-based logout response only)
 * @route POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

/**
 * @desc Register a new user
 * @route POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { name, email, contact, password, restaurant_name, tagline, hotel_address, hotel_city, hotel_state } = req.body;

    if (!name || !email || !contact || !password || !restaurant_name) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, contact, password, and restaurant name are required.'
      });
    }

    // 1. Check if user already exists (by email only)
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists.'
      });
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Insert new user
    const [result] = await pool.query(
      'INSERT INTO users (username, email, contact, password, role, is_active, status, is_deleted, restaurant_name, tagline, hotel_address, hotel_city, hotel_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, contact, hashedPassword, 'user', 1, 'active', 0, restaurant_name, tagline || null, hotel_address || null, hotel_city || null, hotel_state || null]
    );

    const newUserId = result.insertId;

    // 4. Generate JWT Token
    const payload = {
      id: newUserId,
      username: name,
      email: email,
      role: 'user'
    };

    const token = jwt.sign(payload, tokenSecret, { expiresIn: tokenExpiry });

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: newUserId,
        username: name,
        email: email,
        role: 'user',
        contact: contact,
        restaurant_name: restaurant_name,
        tagline: tagline || null,
        hotel_address: hotel_address || null,
        hotel_city: hotel_city || null,
        hotel_state: hotel_state || null
      }
    });

  } catch (error) {
    console.error('Register controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

/**
 * @desc Check if email exists
 * @route POST /api/auth/check-email
 */
exports.checkEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.'
      });
    }

    const [users] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1',
      [email]
    );

    if (users.length > 0) {
      return res.status(400).json({
        success: false,
        exists: true,
        message: 'A user with this email already exists.'
      });
    }

    return res.status(200).json({
      success: true,
      exists: false,
      message: 'Email is available.'
    });
  } catch (error) {
    console.error('Check email controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

/**
 * @desc Update user settings (restaurant name and tagline)
 * @route PUT /api/auth/settings
 */
exports.updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, restaurant_name, tagline, hotel_address, hotel_city, hotel_state } = req.body;

    // Fetch existing user data
    const [existingUsers] = await pool.query(
      'SELECT username, restaurant_name, tagline, hotel_address, hotel_city, hotel_state FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1',
      [userId]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const current = existingUsers[0];

    // Merge new values with existing ones
    const updatedUsername = username !== undefined ? username : current.username;
    const updatedRestaurantName = restaurant_name !== undefined ? restaurant_name : current.restaurant_name;
    const updatedTagline = tagline !== undefined ? tagline : current.tagline;
    const updatedHotelAddress = hotel_address !== undefined ? hotel_address : current.hotel_address;
    const updatedHotelCity = hotel_city !== undefined ? hotel_city : current.hotel_city;
    const updatedHotelState = hotel_state !== undefined ? hotel_state : current.hotel_state;

    // Validations
    if (!updatedRestaurantName) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant name is required.'
      });
    }

    if (!updatedUsername) {
      return res.status(400).json({
        success: false,
        message: 'User name is required.'
      });
    }

    await pool.query(
      'UPDATE users SET username = ?, restaurant_name = ?, tagline = ?, hotel_address = ?, hotel_city = ?, hotel_state = ? WHERE id = ?',
      [
        updatedUsername,
        updatedRestaurantName,
        updatedTagline || null,
        updatedHotelAddress || null,
        updatedHotelCity || null,
        updatedHotelState || null,
        userId
      ]
    );

    // Retrieve updated info
    const [users] = await pool.query(
      'SELECT id, username, email, role, contact, restaurant_name, tagline, hotel_address, hotel_city, hotel_state FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1',
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Brand customization updated successfully',
      user: users[0]
    });

  } catch (error) {
    console.error('Update settings controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

/**
 * @desc Get dashboard stats for user from actual tables
 * @route GET /api/auth/dashboard
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch active offers count from 'offers' table
    const [offersRes] = await pool.query(
      "SELECT COUNT(*) AS count FROM offers WHERE user_id = ? AND status = 'active' AND is_deleted = 0",
      [userId]
    );
    const activeOffers = offersRes[0].count;

    // 2. Fetch scan count from 'qr_scans' table
    const [scansRes] = await pool.query(
      "SELECT scan_count FROM qr_scans WHERE user_id = ? LIMIT 1",
      [userId]
    );
    const scanCount = scansRes.length > 0 ? scansRes[0].scan_count : 0;

    // 3. Fetch dish count from 'dishes' table
    const [dishesRes] = await pool.query(
      "SELECT COUNT(*) AS count FROM dishes WHERE user_id = ? AND is_deleted = 0",
      [userId]
    );
    const dishCount = dishesRes[0].count;

    // 4. Fetch category count from 'categories' table
    const [categoriesRes] = await pool.query(
      "SELECT COUNT(*) AS count FROM categories WHERE user_id = ? AND is_deleted = 0",
      [userId]
    );
    const categoryCount = categoriesRes[0].count;

    return res.status(200).json({
      success: true,
      stats: {
        activeOffers,
        scanCount,
        dishCount,
        categoryCount
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};
