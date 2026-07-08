const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/check-email
router.post('/check-email', authController.checkEmail);

// GET /api/auth/profile (Protected)
router.get('/profile', authMiddleware, authController.getProfile);

// PUT /api/auth/settings (Protected)
router.put('/settings', authMiddleware, authController.updateSettings);

// GET /api/auth/dashboard (Protected)
router.get('/dashboard', authMiddleware, authController.getDashboardStats);

// POST /api/auth/logout
router.post('/logout', authController.logout);

module.exports = router;
