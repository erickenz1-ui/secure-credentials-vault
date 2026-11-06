/**
 * User Service
 * Business logic for user management
 */

const { query } = require('../config/database');
const authService = require('./auth.service');
const permissionService = require('./permission.service');
const auditService = require('./audit.service');
const {
  NotFoundError,
  AuthorizationError,
  ConflictError,
  ValidationError,
} = require('../utils/errors');
const logger = require('../utils/logger');

class UserService {
  
  /**
   * Create a new user
   * @param {Object} adminUser - User creating the new user
   * @param {Object} userData - New user data
   * @returns {Promise<Object>} Created user
   */
  async create(adminUser, userData) {
    const { email, password, fullName, role } = userData;

    // Check permission
    if (!permissionService.canManageUser(adminUser, { role })) {
      throw new AuthorizationError('You do not have permission to create users with this role');
    }

    // Check if email already exists
    const { rows: existing } = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing.length > 0) {
      throw new ConflictError('Email already registered');
    }

    // Hash password
    const passwordHash = await authService.hashPassword(password);

    // Create user
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, is_active, created_at`,
      [email.toLowerCase(), passwordHash, fullName, role]
    );

    const user = rows[0];

    // Audit log
    await auditService.log({
      userId: adminUser.id,
      userEmail: adminUser.email,
      userRole: adminUser.role,
      action: 'user.create',
      resourceType: 'user',
      resourceId: user.id,
      resourceName: user.email,
      metadata: { newUserRole: role },
    });

    return user;
  }

  /**
   * Get user by ID
   * @param {Object} requester - User making the request
   * @param {string} userId - User ID to fetch
   * @returns {Promise<Object>} User data
   */
  async getById(requester, userId) {
    const { rows } = await query(
      `SELECT id, email, full_name, role, is_active, last_login_at, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('User');
    }

    const user = rows[0];

    // Check permission (can view self, or manage others)
    if (requester.id !== userId && !permissionService.canManageUser(requester, user)) {
      throw new AuthorizationError('You do not have permission to view this user');
    }

    return user;
  }

  /**
   * List users with filters
   * @param {Object} requester - User making the request
   * @param {Object} filters - Search filters
   * @returns {Promise<Object>} Paginated users
   */
  async list(requester, filters = {}) {
    const {
      search,
      role,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = filters;

    // Build WHERE clause
    const whereConditions = ['1=1'];
    const queryParams = [];
    let paramCount = 1;

    // Non-admins can only see users in their teams
    if (requester.role !== 'super_admin' && requester.role !== 'admin') {
      whereConditions.push(`(
        id = $${paramCount++} OR
        id IN (
          SELECT user_id FROM team_members 
          WHERE team_id IN (
            SELECT team_id FROM team_members WHERE user_id = $${paramCount++}
          )
        )
      )`);
      queryParams.push(requester.id, requester.id);
    }

    if (search) {
      whereConditions.push(`(
        email ILIKE $${paramCount} OR 
        full_name ILIKE $${paramCount}
      )`);
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    if (role) {
      whereConditions.push(`role = $${paramCount++}`);
      queryParams.push(role);
    }

    if (isActive !== undefined) {
      whereConditions.push(`is_active = $${paramCount++}`);
      queryParams.push(isActive);
    }

    // Validate sort
    const allowedSortFields = ['email', 'full_name', 'role', 'created_at', 'last_login_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const offset = (page - 1) * limit;

    // Get total count
    const { rows: countResult } = await query(
      `SELECT COUNT(*) as total FROM users WHERE ${whereConditions.join(' AND ')}`,
      queryParams
    );
    const total = parseInt(countResult[0].total, 10);

    // Get users
    const { rows: users } = await query(
      `SELECT id, email, full_name, role, is_active, last_login_at, created_at
       FROM users
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY ${sortField} ${sortDir}
       LIMIT $${paramCount++} OFFSET $${paramCount}`,
      [...queryParams, limit, offset]
    );

    return {
      users,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update a user
   * @param {Object} adminUser - User making the update
   * @param {string} userId - User ID to update
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated user
   */
  async update(adminUser, userId, updates) {
    // Get target user
    const { rows: targetUsers } = await query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (targetUsers.length === 0) {
      throw new NotFoundError('User');
    }

    const targetUser = targetUsers[0];

    // Check permission
    if (!permissionService.canManageUser(adminUser, targetUser)) {
      throw new AuthorizationError('You do not have permission to update this user');
    }

    // Prevent modifying super_admin unless you're super_admin
    if (targetUser.role === 'super_admin' && adminUser.role !== 'super_admin') {
      throw new AuthorizationError('Cannot modify super administrator');
    }

    // Prevent self-demotion from super_admin
    if (userId === adminUser.id && updates.role && updates.role !== 'super_admin' && adminUser.role === 'super_admin') {
      throw new ValidationError('Cannot demote yourself from super administrator');
    }

    // Build update
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (updates.fullName !== undefined) {
      updateFields.push(`full_name = $${paramCount++}`);
      updateValues.push(updates.fullName);
    }

    if (updates.role !== undefined) {
      // Validate role change permission
      if (!permissionService.canManageUser(adminUser, { role: updates.role })) {
        throw new AuthorizationError('You do not have permission to assign this role');
      }
      updateFields.push(`role = $${paramCount++}`);
      updateValues.push(updates.role);
    }

    if (updates.isActive !== undefined) {
      // Prevent self-deactivation
      if (userId === adminUser.id && !updates.isActive) {
        throw new ValidationError('Cannot deactivate your own account');
      }
      updateFields.push(`is_active = $${paramCount++}`);
      updateValues.push(updates.isActive);
    }

    if (updateFields.length === 0) {
      return targetUser;
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(userId);

    const { rows } = await query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount}
       RETURNING id, email, full_name, role, is_active, updated_at`,
      updateValues
    );

    // If user was deactivated, revoke all their sessions
    if (updates.isActive === false) {
      await authService.logoutAll(userId);
    }

    // Audit log
    await auditService.log({
      userId: adminUser.id,
      userEmail: adminUser.email,
      userRole: adminUser.role,
      action: 'user.update',
      resourceType: 'user',
      resourceId: userId,
      resourceName: targetUser.email,
      metadata: { 
        updatedFields: Object.keys(updates),
        previousRole: targetUser.role,
        newRole: updates.role,
      },
    });

    return rows[0];
  }

  /**
   * Delete a user (soft delete by deactivating)
   * @param {Object} adminUser - User making the deletion
   * @param {string} userId - User ID to delete
   */
  async delete(adminUser, userId) {
    // Get target user
    const { rows } = await query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('User');
    }

    const targetUser = rows[0];

    // Check permission
    if (!permissionService.canManageUser(adminUser, targetUser)) {
      throw new AuthorizationError('You do not have permission to delete this user');
    }

    // Prevent deleting super_admin
    if (targetUser.role === 'super_admin') {
      throw new AuthorizationError('Cannot delete super administrator');
    }

    // Prevent self-deletion
    if (userId === adminUser.id) {
      throw new ValidationError('Cannot delete your own account');
    }

    // Soft delete: deactivate and anonymize
    await query(
      `UPDATE users 
       SET is_active = false, 
           email = 'deleted_' || id || '@deleted.local',
           full_name = 'Deleted User',
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    // Revoke all sessions
    await authService.logoutAll(userId);

    // Audit log
    await auditService.log({
      userId: adminUser.id,
      userEmail: adminUser.email,
      userRole: adminUser.role,
      action: 'user.delete',
      resourceType: 'user',
      resourceId: userId,
      resourceName: targetUser.email,
      metadata: { previousRole: targetUser.role },
    });
  }
}

module.exports = new UserService();