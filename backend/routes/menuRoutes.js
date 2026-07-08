const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Public Menu Route (No Auth Required)
router.get('/public/:slug', menuController.getPublicMenu);

// Protected Menu Routes
router.get('/categories', authMiddleware, menuController.getCategories);
router.post('/categories', authMiddleware, menuController.createCategory);
router.post('/dishes', authMiddleware, upload.single('image'), menuController.createDish);
router.delete('/categories/:id', authMiddleware, menuController.deleteCategory);
router.post('/dishes/delete-batch', authMiddleware, menuController.deleteDishesBatch);

module.exports = router;
