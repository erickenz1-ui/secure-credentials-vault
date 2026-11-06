/**
 * Authentication Service
 * Handles user login, token generation, password reset, etc.
 */

const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const { query } = require('../config/database');
const { 
  AuthenticationError, 
  ValidationError,
  NotFoundError,
  AppError 
} = require('../utils/errors');
const logger = require('../utils/logger');

class AuthService {
  
  // ============================================
  // PASSWORD HASHING
  // ============================================
  
  /**
   * Hash a password using argon2id
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(password) {
    try {
      return await argon2.hash(password, {
        type: argon2.argon2id, // Most secure variant
        memoryCost: 65536,     // 64 MB
        timeCost: 3,           // 3 iterations
        parallelism: 4,        // 4 parallel threads
      });
    } catch (error) {
      logger.error('Password hashing error:', error);
      throw new AppError('Failed to hash password', 500);
    }
  }

  /**
   * Verify a password against a hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} True if password matches
   */
  async verifyPassword(password, hash) {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      logger.error('Password verification error:', error);
      return false;
    }
  }

  // ============================================
  // LOGIN
  // ============================================
  
  /**
   * Authenticate a user
   * @param {string} email - User email
   * @param {string} password - Plain text password
   * @param {Object} req - Express request object (for IP, user agent)
   * @returns {Promise<Object>} User data and tokens
   */
  async login(email, password, req) {
    // Find user by email
    const { rows: users } = await query(
      'SELECT id, email, password_hash, full_name, role, is_active, failed_login_attempts, locked_until FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (users.length === 0) {
      throw new AuthenticationError('Invalid email or password');
    }

    const user = users[0];

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      throw new AuthenticationError(`Account is locked. Try again in ${remainingMinutes} minutes.`);
    }

    // Check if account is active
    if (!user.is_active) {
      throw new AuthenticationError('Account is deactivated. Contact an administrator.');
    }

    // Verify password
    const isValid = await this.verifyPassword(password, user.password_hash);
    
    if (!isValid) {
      // Increment failed login attempts
      const newFailedAttempts = user.failed_login_attempts + 1;
      const shouldLock = newFailedAttempts >= 5; // Lock after 5 failed attempts
      
      await query(
        `UPDATE users 
         SET failed_login_attempts = $1, 
             locked_until = $2 
         WHERE id = $3`,
        [
          shouldLock ? 0 : newFailedAttempts,
          shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null, // Lock for 15 minutes
          user.id
        ]
      );

      if (shouldLock) {
        logger.warn(`Account locked due to failed login attempts: ${email}`);
        throw new AuthenticationError('Account locked due to too many failed attempts. Try again in 15 minutes.');
      }

      throw new AuthenticationError('Invalid email or password');
    }

    // Reset failed attempts on successful login
    await query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Generate tokens
    const tokens = await this.generateTokens(user, req);

    // Return user data (without sensitive fields)
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
      ...tokens,
    };
  }

  // ============================================
  // TOKEN GENERATION
  // ============================================
  
  /**
   * Generate access and refresh tokens
   * @param {Object} user - User object
   * @param {Object} req - Express request object
   * @returns {Promise<Object>} Tokens and expiry info
   */
  async generateTokens(user, req) {
    // Access token (short-lived)
    const accessToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      config.jwt.secret,
      { expiresIn: config.jwt.accessTokenExpiry }
    );

    // Refresh token (long-lived, stored hashed in DB)
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    // Calculate expiry
    const expiryDays = parseInt(config.jwt.refreshTokenExpiry) || 7;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    // Store refresh token in database
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        refreshTokenHash,
        expiresAt,
        req.ip,
        req.get('user-agent') || 'unknown'
      ]
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: config.jwt.accessTokenExpiry,
    };
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token from cookie
   * @param {Object} req - Express request object
   * @returns {Promise<Object>} New tokens
   */
  async refreshAccessToken(refreshToken, req) {
    if (!refreshToken) {
      throw new AuthenticationError('Refresh token required');
    }

    // Hash the provided token
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Find valid refresh token
    const { rows: tokens } = await query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at,
              u.id as user_id, u.email, u.full_name, u.role, u.is_active, u.refresh_token_version
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL`,
      [tokenHash]
    );

    if (tokens.length === 0) {
      throw new AuthenticationError('Invalid refresh token');
    }

    const tokenData = tokens[0];

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      throw new AuthenticationError('Refresh token expired');
    }

    // Check if user is still active
    if (!tokenData.is_active) {
      throw new AuthenticationError('Account is deactivated');
    }

    // Get current user data to check refresh token version
    const { rows: users } = await query(
      'SELECT refresh_token_version FROM users WHERE id = $1',
      [tokenData.user_id]
    );

    // Revoke old refresh token (rotation)
    await query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1',
      [tokenData.id]
    );

    // Generate new tokens
    const user = {
      id: tokenData.user_id,
      email: tokenData.email,
      full_name: tokenData.full_name,
      role: tokenData.role,
    };

    const newTokens = await this.generateTokens(user, req);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
      ...newTokens,
    };
  }

  /**
   * Logout user (revoke refresh token)
   * @param {string} refreshToken - Refresh token to revoke
   */
  async logout(refreshToken) {
    if (!refreshToken) return;

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL',
      [tokenHash]
    );
  }

  /**
   * Logout from all devices (revoke all refresh tokens)
   * @param {string} userId - User ID
   */
  async logoutAll(userId) {
    await query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );

    // Increment refresh token version to invalidate all existing tokens
    await query(
      'UPDATE users SET refresh_token_version = refresh_token_version + 1 WHERE id = $1',
      [userId]
    );
  }

  // ============================================
  // PASSWORD RESET
  // ============================================
  
  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {Promise<string>} Reset token (to be sent via email)
   */
  async requestPasswordReset(email) {
    const { rows: users } = await query(
      'SELECT id, email FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );

    // Don't reveal if email exists (security best practice)
    if (users.length === 0) {
      return null;
    }

    const user = users[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Invalidate previous reset tokens for this user
    await query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [user.id]
    );

    // Store new token
    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    // In production, send email with reset link
    // For now, return token (in dev mode)
    logger.info(`Password reset requested for ${email}`);
    
    return resetToken;
  }

  /**
   * Reset password using token
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   */
  async resetPassword(token, newPassword) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid token
    const { rows: tokens } = await query(
      `SELECT prt.id, prt.user_id, prt.expires_at
       FROM password_reset_tokens prt
       WHERE prt.token_hash = $1 AND prt.used_at IS NULL`,
      [tokenHash]
    );

    if (tokens.length === 0) {
      throw new ValidationError('Invalid or expired reset token');
    }

    const tokenData = tokens[0];

    // Check expiry
    if (new Date(tokenData.expires_at) < new Date()) {
      throw new ValidationError('Reset token has expired');
    }

    // Hash new password
    const passwordHash = await this.hashPassword(newPassword);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, tokenData.user_id]
    );

    // Mark token as used
    await query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
      [tokenData.id]
    );

    // Revoke all refresh tokens (force re-login)
    await this.logoutAll(tokenData.user_id);

    logger.info(`Password reset successful for user ${tokenData.user_id}`);
  }

  /**
   * Change password (authenticated user)
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   */
  async changePassword(userId, currentPassword, newPassword) {
    // Get user
    const { rows: users } = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (users.length === 0) {
      throw new NotFoundError('User');
    }

    // Verify current password
    const isValid = await this.verifyPassword(currentPassword, users[0].password_hash);
    
    if (!isValid) {
      throw new ValidationError('Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await this.hashPassword(newPassword);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, userId]
    );

    // Revoke all refresh tokens (force re-login)
    await this.logoutAll(userId);

    logger.info(`Password changed for user ${userId}`);
  }

  // ============================================
  // TOKEN VERIFICATION
  // ============================================
  
  /**
   * Verify JWT access token
   * @param {string} token - JWT token
   * @returns {Object} Decoded token payload
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Token expired');
      }
      throw new AuthenticationError('Invalid token');
    }
  }
}

module.exports = new AuthService();