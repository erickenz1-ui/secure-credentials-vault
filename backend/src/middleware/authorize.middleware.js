/**
 * Authorization Middleware
 * Role-based access control (RBAC)
 */

const { AuthorizationError } = require('../utils/errors');

/**
 * Check if user has one of the required roles
 * @param {...string} allowedRoles - Roles that can access the route
 * @returns {Function} Express middleware
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthorizationError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AuthorizationError('Insufficient permissions'));
    }

    next();
  };
};

// Convenience middleware for common role checks
const requireSuperAdmin = authorize('super_admin');
const requireAdmin = authorize('super_admin', 'admin');
const requireManager = authorize('super_admin', 'admin', 'manager');
const requireStandardUser = authorize('super_admin', 'admin', 'manager', 'standard');
const requireAnyRole = authorize('super_admin', 'admin', 'manager', 'standard', 'read_only');

module.exports = {
  authorize,
  requireSuperAdmin,
  requireAdmin,
  requireManager,
  requireStandardUser,
  requireAnyRole,
};