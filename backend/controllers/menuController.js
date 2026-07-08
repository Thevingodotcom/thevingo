const pool = require('../config/db');

/**
 * @desc Get all categories with dishes for logged-in user
 * @route GET /api/menu/categories
 */
exports.getCategories = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch categories
    const [categories] = await pool.query(
      'SELECT id, name FROM categories WHERE user_id = ? AND is_deleted = 0',
      [userId]
    );

    // 2. Fetch dishes
    const [dishes] = await pool.query(
      'SELECT id, name, price, category_id, image, veg_type, available_breakfast, available_lunch, available_dinner FROM dishes WHERE user_id = ? AND is_deleted = 0',
      [userId]
    );

    // 3. Format result
    const result = categories.map(cat => {
      const catDishes = dishes
        .filter(dish => dish.category_id === cat.id)
        .map(dish => ({
          id: dish.id.toString(),
          name: dish.name,
          price: parseFloat(dish.price),
          isVeg: dish.veg_type === 'veg',
          image: dish.image || 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300&auto=format&fit=crop&q=80',
          availableBreakfast: !!dish.available_breakfast,
          availableLunch: !!dish.available_lunch,
          availableDinner: !!dish.available_dinner
        }));

      return {
        id: cat.id.toString(),
        name: cat.name,
        items: catDishes
      };
    });

    return res.status(200).json({
      success: true,
      categories: result
    });

  } catch (error) {
    console.error('Get categories error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

/**
 * @desc Create a new category
 * @route POST /api/menu/categories
 */
exports.createCategory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required.'
      });
    }

    const [result] = await pool.query(
      'INSERT INTO categories (name, user_id, is_deleted) VALUES (?, ?, 0)',
      [name.trim(), userId]
    );

    return res.status(201).json({
      success: true,
      category: {
        id: result.insertId.toString(),
        name: name.trim(),
        items: []
      }
    });

  } catch (error) {
    console.error('Create category error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

/**
 * @desc Create a new dish
 * @route POST /api/menu/dishes
 */
exports.createDish = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      price,
      categoryId,
      isVeg,
      image,
      availableBreakfast,
      availableLunch,
      availableDinner
    } = req.body;

    if (!name || !price || !categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Name, price, and category are required.'
      });
    }

    // Determine image source: req.file or req.body.image
    let savedImagePath = null;
    if (req.file) {
      const host = req.get('host');
      const protocol = req.protocol;
      savedImagePath = `${protocol}://${host}/uploads/${req.file.filename}`;
    } else if (image) {
      savedImagePath = image;
    }

    const catId = parseInt(categoryId, 10);
    const isVegBool = isVeg === 'true' || isVeg === true;
    const availBreakfastBool = availableBreakfast === 'true' || availableBreakfast === true;
    const availLunchBool = availableLunch === 'true' || availableLunch === true;
    const availDinnerBool = availableDinner === 'true' || availableDinner === true;

    const [result] = await pool.query(
      `INSERT INTO dishes (
        name, price, category_id, image, veg_type, 
        available_breakfast, available_lunch, available_dinner, 
        user_id, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        name.trim(),
        parseFloat(price),
        catId,
        savedImagePath,
        isVegBool ? 'veg' : 'non_veg',
        availBreakfastBool ? 1 : 0,
        availLunchBool ? 1 : 0,
        availDinnerBool ? 1 : 0,
        userId
      ]
    );

    return res.status(201).json({
      success: true,
      dish: {
        id: result.insertId.toString(),
        name: name.trim(),
        price: parseFloat(price),
        isVeg: isVegBool,
        image: savedImagePath || 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300&auto=format&fit=crop&q=80',
        availableBreakfast: availBreakfastBool,
        availableLunch: availLunchBool,
        availableDinner: availDinnerBool
      }
    });

  } catch (error) {
    console.error('Create dish error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

/**
 * @desc Delete a category (soft delete category + all dishes under it)
 * @route DELETE /api/menu/categories/:id
 */
exports.deleteCategory = async (req, res) => {
  try {
    const userId = req.user.id;
    const categoryId = parseInt(req.params.id, 10);

    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID.'
      });
    }

    // Soft delete the category
    const [catResult] = await pool.query(
      'UPDATE categories SET is_deleted = 1 WHERE id = ? AND user_id = ?',
      [categoryId, userId]
    );

    if (catResult.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found or not authorized.'
      });
    }

    // Soft delete all dishes in this category
    await pool.query(
      'UPDATE dishes SET is_deleted = 1 WHERE category_id = ? AND user_id = ?',
      [categoryId, userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Category and all its dishes deleted successfully.'
    });

  } catch (error) {
    console.error('Delete category error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

/**
 * @desc Delete a batch of dishes (soft delete)
 * @route POST /api/menu/dishes/delete-batch
 */
exports.deleteDishesBatch = async (req, res) => {
  try {
    const userId = req.user.id;
    const { dishIds } = req.body;

    if (!dishIds || !Array.isArray(dishIds) || dishIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'dishIds must be a non-empty array.'
      });
    }

    // Soft delete dishes
    const [result] = await pool.query(
      'UPDATE dishes SET is_deleted = 1 WHERE id IN (?) AND user_id = ?',
      [dishIds, userId]
    );

    return res.status(200).json({
      success: true,
      message: `${result.affectedRows} dishes deleted successfully.`
    });

  } catch (error) {
    console.error('Delete dishes batch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

/**
 * @desc Get public menu by restaurant slug (no auth required)
 * @route GET /api/menu/public/:slug
 */
exports.getPublicMenu = async (req, res) => {
  try {
    const slug = req.params.slug;

    // Find user by matching slug against restaurant_name
    const [users] = await pool.query(
      'SELECT id, restaurant_name, tagline FROM users WHERE is_deleted = 0 AND is_active = 1',
    );

    // Generate slug from restaurant_name and find the matching user
    const matchedUser = users.find(user => {
      if (!user.restaurant_name) return false;
      const userSlug = user.restaurant_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return userSlug === slug;
    });

    if (!matchedUser) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found.'
      });
    }

    const userId = matchedUser.id;

    // Increment scan count in qr_scans table
    try {
      await pool.query(
        'INSERT INTO qr_scans (user_id, scan_count) VALUES (?, 1) ON DUPLICATE KEY UPDATE scan_count = scan_count + 1',
        [userId]
      );
    } catch (scanErr) {
      console.error('Failed to increment scan count:', scanErr.message);
    }

    // Fetch categories
    const [categories] = await pool.query(
      'SELECT id, name FROM categories WHERE user_id = ? AND is_deleted = 0',
      [userId]
    );

    // Fetch dishes
    const [dishes] = await pool.query(
      'SELECT id, name, price, category_id, image, veg_type, available_breakfast, available_lunch, available_dinner FROM dishes WHERE user_id = ? AND is_deleted = 0',
      [userId]
    );

    // Format result
    const result = categories.map(cat => {
      const catDishes = dishes
        .filter(dish => dish.category_id === cat.id)
        .map(dish => ({
          id: dish.id.toString(),
          name: dish.name,
          price: parseFloat(dish.price),
          isVeg: dish.veg_type === 'veg',
          image: dish.image || null,
          availableBreakfast: !!dish.available_breakfast,
          availableLunch: !!dish.available_lunch,
          availableDinner: !!dish.available_dinner
        }));

      return {
        id: cat.id.toString(),
        name: cat.name,
        items: catDishes
      };
    });

    return res.status(200).json({
      success: true,
      restaurant_name: matchedUser.restaurant_name,
      tagline: matchedUser.tagline || '',
      categories: result
    });

  } catch (error) {
    console.error('Get public menu error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};
