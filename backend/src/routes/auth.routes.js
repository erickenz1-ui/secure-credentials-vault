/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} = require('../utils/validators');

// ============================================
// PUBLIC ROUTES
// ============================================

// Login
router.post(
  '/login',
  validate({ body: loginSchema }),
  authController.login
);

// Refresh token
router.post('/refresh', authController.refresh);

// Logout
router.post('/logout', authController.logout);

// Forgot password
router.post(
  '/forgot-password',
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword
);

// Reset password
router.post(
  '/reset-password',
  validate({ body: resetPasswordSchema }),
  authController.resetPassword
);

// ============================================
// PROTECTED ROUTES (require authentication)
// ============================================

// Get current user
router.get('/me', authenticate, authController.getCurrentUser);

// Logout from all devices
router.post('/logout-all', authenticate, authController.logoutAll);

// Change password
router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword
);

module.exports = router;