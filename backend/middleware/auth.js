const jwt = require('jsonwebtoken');
const path = require('path');

const { getJWTSecret } = require('../utils/envHelper');

const tokenSecret = getJWTSecret();

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied.'
      });
    }

    const token = authHeader.split(' ')[1];
    
    jwt.verify(token, tokenSecret, (err, decoded) => {
      if (err) {
        return res.status(401).json({
          success: false,
          message: 'Token is invalid or has expired.'
        });
      }

      req.user = decoded; // Contains id, username, email, role
      next();
    });
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

module.exports = authMiddleware;
