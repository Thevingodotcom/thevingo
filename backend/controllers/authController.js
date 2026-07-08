const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const path = require('path');
const { getJWTSecret } = require('../utils/envHelper');
const nodemailer = require('nodemailer');

const tokenSecret = getJWTSecret();
const tokenExpiry = process.env.JWT_EXPIRY || '24h';

// Global SMTP Transporters for Connection Pooling (makes sending emails MUCH faster)
let pooledOtpTransporter = null;
let pooledWelcomeTransporter = null;

const getOtpTransporter = () => {
  if (!pooledOtpTransporter) {
    pooledOtpTransporter = nodemailer.createTransport({
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    });
  }
  return pooledOtpTransporter;
};

const getWelcomeTransporter = () => {
  if (!pooledWelcomeTransporter) {
    pooledWelcomeTransporter = nodemailer.createTransport({
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.PURCHASE_SMTP_USER,
        pass: process.env.PURCHASE_SMTP_PASS,
      }
    });
  }
  return pooledWelcomeTransporter;
};

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

    // 11. Create otp_codes table to store OTP separately before registration
    await pool.query(`
      CREATE TABLE IF NOT EXISTS otp_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp VARCHAR(10) NOT NULL,
        expires_at DATETIME NOT NULL,
        is_verified TINYINT(1) DEFAULT 0,
        UNIQUE KEY unique_email (email)
      )
    `);
    console.log("Ensured otp_codes table exists for separate OTP tracking.");
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

    // 1.5. Check if email was verified via OTP
    const [otpRecords] = await pool.query(
      'SELECT is_verified FROM otp_codes WHERE email = ? LIMIT 1',
      [email]
    );

    if (otpRecords.length === 0 || otpRecords[0].is_verified === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please verify your email address before registering.'
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

    // 5. Send Welcome Email from purchase@thevingo.com
    try {
      const welcomeTransporter = getWelcomeTransporter();

      const welcomeMailOptions = {
        from: `"The Vingo" <${process.env.PURCHASE_SMTP_USER}>`,
        to: email,
        subject: 'Welcome to The Vingo!',
        html: `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; padding: 40px 20px; font-family: Arial, sans-serif;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border: 1px solid #eee; border-radius: 10px; max-width: 650px; margin: 0 auto; overflow: hidden;">
                  
                  <!-- Header -->
                  <tr>
                    <td align="center" style="padding: 30px; border-bottom: 2px solid #fcfcfc;">
                      <img src="cid:thevingologo" alt="TheVingo" height="42" style="display: block; margin: 0 auto;" />
                    </td>
                  </tr>
                  
                  <!-- Email Body -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h2 style="color: #333; margin-top: 0; margin-bottom: 25px;">Welcome to The Vingo!</h2>
                      <p style="color: #333; font-size: 16px;">Hi ${name},</p>
                      <p style="color: #555; font-size: 16px; line-height: 1.6;">We are thrilled to have you on board! Your account for <strong>${restaurant_name}</strong> has been successfully created.</p>
                      <p style="color: #555; font-size: 16px; line-height: 1.6;">You can now log in to your dashboard and start managing your digital menu card with ease.</p>
                      
                      <div style="margin-top: 35px;">
                        <p style="color: #555; font-size: 15px; margin: 0;">Regards,</p>
                        <p style="color: #333; font-size: 16px; font-weight: bold; margin: 5px 0 0 0;">The Vingo Team</p>
                      </div>
                    </td>
                  </tr>

                  <!-- Custom Footer Block -->
                  <tr>
                    <td style="background-color: #EF5C43; padding: 30px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <!-- Left Side -->
                          <td width="50%" align="left" valign="middle">
                            <div style="background-color: #ffffff; padding: 6px 12px; border-radius: 6px; display: inline-block;">
                              <img src="cid:thevingologo" alt="TheVingo" height="28" style="display: block;" />
                            </div>
                          </td>
                          <!-- Right Side: Contact Info -->
                          <td width="50%" align="right" valign="middle" style="color: #ffffff; font-size: 15px; line-height: 1.8;">
                            <a href="mailto:sales@thevingo.com" style="color: #ffffff; text-decoration: none;">sales@thevingo.com</a><br/>
                            <a href="https://www.thevingo.com" style="color: #ffffff; text-decoration: none;">www.thevingo.com</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        `,
        attachments: [
          {
            filename: 'logo.png',
            path: 'd:/Thevingo/backend/logo.png',
            cid: 'thevingologo'
          }
        ]
      };

      // We send it asynchronously without awaiting to not block the response, or we can await it.
      // Awaiting is safer to know it went through, but since we don't want to fail the registration if email fails, we catch it.
      // Send email asynchronously in the background to avoid blocking the response
      welcomeTransporter.sendMail(welcomeMailOptions).catch(err => {
        console.error('Background welcome email send error:', err);
      });
    } catch (mailError) {
      console.error('Failed to send welcome email:', mailError);
    }

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

/**
 * @desc Generate and send OTP to user email (for registration/forgot password)
 * @route POST /api/auth/send-otp
 */
exports.sendOTP = async (req, res) => {
  try {
    const { email, type } = req.body; // type can be 'registration' or 'reset'
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 10); // OTP expires in 10 minutes
    
    // Check if user exists in the main table
    const [users] = await pool.query('SELECT id, is_active FROM users WHERE email = ? AND is_deleted = 0', [email]);
    
    if (type === 'registration' && users.length > 0) {
      return res.status(400).json({ success: false, message: 'A user with this email already exists.' });
    } else if (type === 'reset' && users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Upsert into otp_codes table
    await pool.query(
      `INSERT INTO otp_codes (email, otp, expires_at, is_verified) 
       VALUES (?, ?, ?, 0) 
       ON DUPLICATE KEY UPDATE otp = ?, expires_at = ?, is_verified = 0`,
      [email, otp, expiry, otp, expiry]
    );

    // Configure Nodemailer for Hostinger using Connection Pool
    const transporter = getOtpTransporter();

    const mailOptions = {
      from: `"The Vingo" <${process.env.SMTP_USER}>`,
      to: email,
      subject: type === 'reset' ? 'Your Password Reset OTP - The Vingo' : 'Verify Your Email - The Vingo',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #333;">${type === 'reset' ? 'Password Reset' : 'Email Verification'}</h2>
          <p style="color: #555; font-size: 16px;">Your One-Time Password (OTP) is:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #f97316; margin: 20px 0;">${otp}</div>
          <p style="color: #777; font-size: 14px;">This OTP is valid for 10 minutes. Do not share it with anyone.</p>
        </div>
      `
    };

    // Send email asynchronously in the background to avoid blocking the response
    transporter.sendMail(mailOptions).catch(err => {
      console.error('Background OTP email send error:', err);
    });

    return res.status(200).json({ success: true, message: 'OTP sent successfully.' });

  } catch (error) {
    console.error('Send OTP error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send OTP.' });
  }
};

/**
 * @desc Verify OTP
 * @route POST /api/auth/verify-otp
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const [otpRecords] = await pool.query('SELECT id, otp, expires_at FROM otp_codes WHERE email = ?', [email]);
    
    if (otpRecords.length === 0) {
      return res.status(404).json({ success: false, message: 'No OTP requested for this email.' });
    }

    const record = otpRecords[0];

    if (record.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    if (new Date() > new Date(record.expires_at)) {
      return res.status(400).json({ success: false, message: 'OTP has expired.' });
    }

    // Mark email as verified
    await pool.query(
      'UPDATE otp_codes SET is_verified = 1, otp = "VERIFIED" WHERE email = ?',
      [email]
    );

    return res.status(200).json({ success: true, message: 'OTP verified successfully.' });
    
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * @desc Reset Password
 * @route POST /api/auth/reset-password
 */
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required.' });
    }

    // 1. Verify that the OTP was verified and belongs to this email
    // The verifyOTP function sets otp = "VERIFIED" and is_verified = 1
    const [otpRecords] = await pool.query(
      'SELECT id FROM otp_codes WHERE email = ? AND is_verified = 1 AND otp = "VERIFIED"',
      [email]
    );

    if (otpRecords.length === 0) {
      return res.status(403).json({ success: false, message: 'Invalid or expired password reset request. Please request a new OTP.' });
    }

    // 2. Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 3. Update the user's password in the users table
    const [updateResult] = await pool.query(
      'UPDATE users SET password = ? WHERE email = ? AND is_deleted = 0',
      [hashedPassword, email]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // 4. Delete the OTP record to prevent reuse
    await pool.query('DELETE FROM otp_codes WHERE email = ?', [email]);

    return res.status(200).json({ success: true, message: 'Password reset successfully.' });

  } catch (error) {
    console.error('Reset Password error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};