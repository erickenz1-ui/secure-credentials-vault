/**
 * User Routes
 */

const express = require('express');
const router = express.Router();

const userController = require('../controllers/user.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin, requireManager } = require('../middleware/authorize.middleware');
const {
  createUserSchema,
  updateUserSchema,
} = require('../utils/validators');

// All routes require authentication
router.use(authenticate);

// ============================================
// USER MANAGEMENT
// ============================================

// Create user (admin and above)
router.post(
  '/',
  requireAdmin,
  validate({ body: createUserSchema }),
  userController.create
);

// List users (manager and above)
router.get('/', requireManager, userController.list);

// Get user by ID (manager and above)
router.get('/:id', requireManager, userController.getById);

// Update user (admin and above)
router.put(
  '/:id',
  requireAdmin,
  validate({ body: updateUserSchema }),
  userController.update
);

// Delete user (admin and above)
router.delete('/:id', requireAdmin, userController.delete);

module.exports = router;