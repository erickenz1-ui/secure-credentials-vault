/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user to request
 */

const authService = require('../services/auth.service');
const { AuthenticationError } = require('../utils/errors');
const { query } = require('../config/database');

/**
 * Verify JWT access token and attach user to request
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
async function authenticate(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Access token required');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = authService.verifyAccessToken(token);

    // Get fresh user data from database
    const { rows: users } = await query(
      'SELECT id, email, full_name, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (users.length === 0) {
      throw new AuthenticationError('User not found');
    }

    const user = users[0];

    // Check if user is still active
    if (!user.is_active) {
      throw new AuthenticationError('Account is deactivated');
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticate };