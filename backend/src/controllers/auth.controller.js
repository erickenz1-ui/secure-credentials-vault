/**
 * Authentication Controller
 * Handles HTTP requests for authentication endpoints
 */

const authService = require('../services/auth.service');
const auditService = require('../services/audit.service');
const config = require('../config');

class AuthController {
  
  /**
   * POST /api/auth/login
   * Login user
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const result = await authService.login(email, password, req);

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: config.isProduction, // HTTPS only in production
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Audit log
      await auditService.log({
        userId: result.user.id,
        userEmail: result.user.email,
        userRole: result.user.role,
        action: 'user.login',
        resourceType: 'user',
        resourceId: result.user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { success: true },
      });

      // Return access token and user data (NOT refresh token in body)
      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          accessTokenExpiresIn: result.accessTokenExpiresIn,
        },
      });
    } catch (error) {
      // Log failed login attempt
      await auditService.log({
        userId: null,
        userEmail: req.body.email,
        userRole: null,
        action: 'user.login.failed',
        resourceType: 'user',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { reason: error.message },
      });

      next(error);
    }
  }

  /**
   * POST /api/auth/refresh
   * Refresh access token
   */
  async refresh(req, res, next) {
    try {
      const refreshToken = req.cookies.refreshToken;

      const result = await authService.refreshAccessToken(refreshToken, req);

      // Set new refresh token as httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          accessTokenExpiresIn: result.accessTokenExpiresIn,
        },
      });
    } catch (error) {
      // Clear invalid refresh token cookie
      res.clearCookie('refreshToken');
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Logout user
   */
  async logout(req, res, next) {
    try {
      const refreshToken = req.cookies.refreshToken;

      await authService.logout(refreshToken);

      // Clear cookie
      res.clearCookie('refreshToken');

      // Audit log
      if (req.user) {
        await auditService.log({
          userId: req.user.id,
          userEmail: req.user.email,
          userRole: req.user.role,
          action: 'user.logout',
          resourceType: 'user',
          resourceId: req.user.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout-all
   * Logout from all devices
   */
  async logoutAll(req, res, next) {
    try {
      await authService.logoutAll(req.user.id);

      res.clearCookie('refreshToken');

      await auditService.log({
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'user.logout_all',
        resourceType: 'user',
        resourceId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(200).json({
        success: true,
        message: 'Logged out from all devices',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Get current user info
   */
  async getCurrentUser(req, res, next) {
    try {
      res.status(200).json({
        success: true,
        data: {
          user: req.user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/forgot-password
   * Request password reset
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      const resetToken = await authService.requestPasswordReset(email);

      // In production, send email with reset link
      // For development, return token in response
      if (config.isDevelopment && resetToken) {
        return res.status(200).json({
          success: true,
          message: 'Password reset email sent',
          devToken: resetToken, // Only in development!
        });
      }

      res.status(200).json({
        success: true,
        message: 'If the email exists, a password reset link has been sent.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/reset-password
   * Reset password using token
   */
  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      await authService.resetPassword(token, newPassword);

      res.status(200).json({
        success: true,
        message: 'Password reset successful. Please login with your new password.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/change-password
   * Change password (authenticated)
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;

      await authService.changePassword(req.user.id, currentPassword, newPassword);

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      await auditService.log({
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'user.change_password',
        resourceType: 'user',
        resourceId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(200).json({
        success: true,
        message: 'Password changed successfully. Please login again.',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();