const pool = require('../config/db');

/**
 * @desc Get all offers for logged-in user
 * @route GET /api/offers
 */
exports.getOffers = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      'SELECT id, title, badge_type, duration, status, timing, price_percent FROM offers WHERE user_id = ? AND is_deleted = 0',
      [userId]
    );

    const mapped = rows.map(row => ({
      id: row.id.toString(),
      name: row.title,
      badgeType: row.badge_type || 'combo-biriyani',
      duration: row.duration || 'Jun 01-Jun30',
      status: row.status === 'active' ? 'Active' : 'Inactive',
      timing: row.timing || 'B/L/D',
      pricePercent: row.price_percent || '0 Rs',
      isActive: row.status === 'active',
      checked: false
    }));

    return res.status(200).json({
      success: true,
      offers: mapped
    });

  } catch (error) {
    console.error('Get offers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

/**
 * @desc Create a new offer
 * @route POST /api/offers
 */
exports.createOffer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, badgeType, duration, timing, pricePercent } = req.body;

    if (!name || !pricePercent) {
      return res.status(400).json({
        success: false,
        message: 'Name and price/percentage are required.'
      });
    }

    const offerType = (badgeType && badgeType.startsWith('combo')) ? 'combo' : 'seasonal';

    const [result] = await pool.query(
      `INSERT INTO offers (
        title, badge_type, duration, timing, price_percent, 
        offer_type, status, user_id, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 0)`,
      [
        name.trim(),
        badgeType || 'combo-biriyani',
        duration || 'Jun 01-Jun30',
        timing || 'B/L/D',
        pricePercent,
        offerType,
        userId
      ]
    );

    return res.status(201).json({
      success: true,
      offer: {
        id: result.insertId.toString(),
        name: name.trim(),
        badgeType: badgeType || 'combo-biriyani',
        duration: duration || 'Jun 01-Jun30',
        status: 'Active',
        timing: timing || 'B/L/D',
        pricePercent,
        isActive: true,
        checked: false
      }
    });

  } catch (error) {
    console.error('Create offer error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

/**
 * @desc Toggle active/inactive state of offer
 * @route PUT /api/offers/:id/toggle
 */
exports.toggleOffer = async (req, res) => {
  try {
    const userId = req.user.id;
    const offerId = parseInt(req.params.id, 10);
    const { isActive } = req.body;

    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: 'isActive status is required.'
      });
    }

    const nextStatus = isActive ? 'active' : 'inactive';

    const [result] = await pool.query(
      'UPDATE offers SET status = ? WHERE id = ? AND user_id = ?',
      [nextStatus, offerId, userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Offer status toggled successfully'
    });

  } catch (error) {
    console.error('Toggle offer error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

/**
 * @desc Bulk delete selected offers
 * @route POST /api/offers/delete-batch
 */
exports.deleteOffersBatch = async (req, res) => {
  try {
    const userId = req.user.id;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'An array of offer IDs is required.'
      });
    }

    // Map string ids to integers
    const integerIds = ids.map(id => parseInt(id, 10));

    await pool.query(
      'UPDATE offers SET is_deleted = 1 WHERE id IN (?) AND user_id = ?',
      [integerIds, userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Offers deleted successfully'
    });

  } catch (error) {
    console.error('Bulk delete offers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};
