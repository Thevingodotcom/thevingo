const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offerController');
const authMiddleware = require('../middleware/auth');

// Protected Offers Routes
router.get('/', authMiddleware, offerController.getOffers);
router.post('/', authMiddleware, offerController.createOffer);
router.put('/:id/toggle', authMiddleware, offerController.toggleOffer);
router.post('/delete-batch', authMiddleware, offerController.deleteOffersBatch);

module.exports = router;
