/**
 * Credential Service
 * Business logic for credential management with encryption
 */

const crypto = require('crypto');
const { query } = require('../config/database');
const permissionService = require('./permission.service');
const auditService = require('./audit.service');
const config = require('../config');
const {
  NotFoundError,
  AuthorizationError,
  ValidationError,
} = require('../utils/errors');
const logger = require('../utils/logger');

class CredentialService {
  
  constructor() {
    // Master key from environment (loaded once)
    this.masterKey = Buffer.from(config.masterEncryptionKey, 'hex');
  }

  // ============================================
  // ENCRYPTION / DECRYPTION
  // ============================================

  /**
   * Encrypt credential secret using envelope encryption
   * @param {string} plaintext - Secret to encrypt
   * @returns {Object} { encryptedData, encryptedKey }
   */
  encryptSecret(plaintext) {
    try {
      // Generate random Data Encryption Key (DEK)
      const dek = crypto.randomBytes(32);
      
      // Generate random IV
      const iv = crypto.randomBytes(16);
      
      // Encrypt the secret with DEK
      const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      const authTag = cipher.getAuthTag();
      
      // Combine: IV + authTag + ciphertext
      const encryptedData = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'base64')
      ]).toString('base64');
      
      // Encrypt DEK with master key
      const keyCipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
      let encryptedDek = keyCipher.update(dek, null, 'base64');
      encryptedDek += keyCipher.final('base64');
      const keyAuthTag = keyCipher.getAuthTag();
      
      const encryptedKey = Buffer.concat([
        iv, // Reuse IV (acceptable for this use case)
        keyAuthTag,
        Buffer.from(encryptedDek, 'base64')
      ]).toString('base64');
      
      return { encryptedData, encryptedKey };
    } catch (error) {
      logger.error('Encryption error:', error);
      throw new Error('Failed to encrypt credential');
    }
  }

  /**
   * Decrypt credential secret
   * @param {string} encryptedData - Base64 encrypted data
   * @param {string} encryptedKey - Base64 encrypted DEK
   * @returns {string} Plaintext secret
   */
  decryptSecret(encryptedData, encryptedKey) {
    try {
      // Decode encrypted key
      const keyBuffer = Buffer.from(encryptedKey, 'base64');
      const keyIv = keyBuffer.subarray(0, 16);
      const keyAuthTag = keyBuffer.subarray(16, 32);
      const encryptedDek = keyBuffer.subarray(32);
      
      // Decrypt DEK
      const keyDecipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, keyIv);
      keyDecipher.setAuthTag(keyAuthTag);
      let dek = keyDecipher.update(encryptedDek, null, 'binary');
      dek = Buffer.concat([dek, keyDecipher.final()]);
      
      // Decode encrypted data
      const dataBuffer = Buffer.from(encryptedData, 'base64');
      const iv = dataBuffer.subarray(0, 16);
      const authTag = dataBuffer.subarray(16, 32);
      const ciphertext = dataBuffer.subarray(32);
      
      // Decrypt data
      const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(ciphertext, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption error:', error);
      throw new Error('Failed to decrypt credential');
    }
  }

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /**
   * Create a new credential
   * @param {Object} user - User creating the credential
   * @param {Object} data - Credential data
   * @returns {Promise<Object>} Created credential
   */
  async create(user, data) {
    const {
      name,
      description,
      credentialType,
      secretData,
      folderId,
      teamId,
      tags,
    } = data;

    // Validate team membership if teamId provided
    if (teamId) {
      const isMember = await permissionService.isTeamMember(teamId, user.id);
      const isAdmin = user.role === 'super_admin' || user.role === 'admin';
      
      if (!isMember && !isAdmin) {
        throw new AuthorizationError('You are not a member of this team');
      }
    }

    // Encrypt the secret
    const { encryptedData, encryptedKey } = this.encryptSecret(secretData);

    // Insert into database
    const { rows } = await query(
      `INSERT INTO credentials 
       (name, description, credential_type, encrypted_data, encrypted_key, 
        folder_id, team_id, owner_id, tags, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, description, credential_type, folder_id, team_id, 
                 owner_id, tags, created_at`,
      [
        name,
        description || null,
        credentialType,
        encryptedData,
        encryptedKey,
        folderId || null,
        teamId || null,
        user.id,
        tags || [],
        user.id,
      ]
    );

    const credential = rows[0];

    // Audit log
    await auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'credential.create',
      resourceType: 'credential',
      resourceId: credential.id,
      resourceName: credential.name,
      metadata: { credentialType, hasTeam: !!teamId },
    });

    return credential;
  }

  /**
   * Get credential by ID (metadata only, no decryption)
   * @param {Object} user - User requesting access
   * @param {string} credentialId - Credential UUID
   * @returns {Promise<Object>} Credential metadata
   */
  async getById(user, credentialId) {
    // Get credential
    const { rows } = await query(
      `SELECT c.id, c.name, c.description, c.credential_type,
              c.folder_id, c.team_id, c.owner_id, c.tags,
              c.created_at, c.updated_at, c.last_accessed_at,
              u.full_name as owner_name,
              t.name as team_name,
              f.name as folder_name
       FROM credentials c
       LEFT JOIN users u ON c.owner_id = u.id
       LEFT JOIN teams t ON c.team_id = t.id
       LEFT JOIN folders f ON c.folder_id = f.id
       WHERE c.id = $1`,
      [credentialId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Credential');
    }

    const credential = rows[0];

    // Check permission
    const canView = await permissionService.canView(user, credential);
    if (!canView) {
      throw new AuthorizationError('You do not have access to this credential');
    }

    // Update last accessed
    await query(
      'UPDATE credentials SET last_accessed_at = NOW(), last_accessed_by = $1 WHERE id = $2',
      [user.id, credentialId]
    );

    return credential;
  }

  /**
   * Reveal (decrypt) credential secret
   * @param {Object} user - User requesting access
   * @param {string} credentialId - Credential UUID
   * @returns {Promise<Object>} Credential with decrypted secret
   */
  async reveal(user, credentialId) {
    // Get full credential including encrypted data
    const { rows } = await query(
      `SELECT c.*, u.full_name as owner_name
       FROM credentials c
       LEFT JOIN users u ON c.owner_id = u.id
       WHERE c.id = $1`,
      [credentialId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Credential');
    }

    const credential = rows[0];

    // Check reveal permission
    const canReveal = await permissionService.canReveal(user, credential);
    if (!canReveal) {
      throw new AuthorizationError('You do not have permission to reveal this credential');
    }

    // Decrypt
    const secret = this.decryptSecret(credential.encrypted_data, credential.encrypted_key);

    // Audit log (important security event!)
    await auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'credential.reveal',
      resourceType: 'credential',
      resourceId: credential.id,
      resourceName: credential.name,
      ipAddress: null, // Will be filled by middleware
      metadata: { credentialType: credential.credential_type },
    });

    // Return credential with secret (but not encrypted fields)
    return {
      id: credential.id,
      name: credential.name,
      description: credential.description,
      credentialType: credential.credential_type,
      secret,
      folderId: credential.folder_id,
      teamId: credential.team_id,
      ownerId: credential.owner_id,
      ownerName: credential.owner_name,
      tags: credential.tags,
      createdAt: credential.created_at,
      updatedAt: credential.updated_at,
    };
  }

  /**
   * Update a credential
   * @param {Object} user - User making the update
   * @param {string} credentialId - Credential UUID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated credential
   */
  async update(user, credentialId, updates) {
    // Get existing credential
    const { rows: existing } = await query(
      'SELECT * FROM credentials WHERE id = $1',
      [credentialId]
    );

    if (existing.length === 0) {
      throw new NotFoundError('Credential');
    }

    const credential = existing[0];

    // Check edit permission
    const canEdit = await permissionService.canEdit(user, credential);
    if (!canEdit) {
      throw new AuthorizationError('You do not have permission to edit this credential');
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    // Simple fields
    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      updateValues.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      updateValues.push(updates.description);
    }
    if (updates.credentialType !== undefined) {
      updateFields.push(`credential_type = $${paramCount++}`);
      updateValues.push(updates.credentialType);
    }
    if (updates.folderId !== undefined) {
      updateFields.push(`folder_id = $${paramCount++}`);
      updateValues.push(updates.folderId);
    }
    if (updates.teamId !== undefined) {
      updateFields.push(`team_id = $${paramCount++}`);
      updateValues.push(updates.teamId);
    }
    if (updates.tags !== undefined) {
      updateFields.push(`tags = $${paramCount++}`);
      updateValues.push(updates.tags);
    }

    // If updating secret, re-encrypt
    if (updates.secretData !== undefined) {
      const { encryptedData, encryptedKey } = this.encryptSecret(updates.secretData);
      updateFields.push(`encrypted_data = $${paramCount++}`);
      updateValues.push(encryptedData);
      updateFields.push(`encrypted_key = $${paramCount++}`);
      updateValues.push(encryptedKey);
    }

    // If no updates, return existing
    if (updateFields.length === 0) {
      return credential;
    }

    // Add updated_at
    updateFields.push(`updated_at = NOW()`);

    // Add ID for WHERE clause
    updateValues.push(credentialId);

    // Execute update
    const { rows } = await query(
      `UPDATE credentials 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, name, description, credential_type, folder_id, team_id, 
                 owner_id, tags, updated_at`,
      updateValues
    );

    // Audit log
    await auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'credential.update',
      resourceType: 'credential',
      resourceId: credentialId,
      resourceName: updates.name || credential.name,
      metadata: { 
        updatedFields: Object.keys(updates).filter(k => k !== 'secretData'),
        secretUpdated: !!updates.secretData,
      },
    });

    return rows[0];
  }

  /**
   * Delete a credential
   * @param {Object} user - User making the deletion
   * @param {string} credentialId - Credential UUID
   */
  async delete(user, credentialId) {
    // Get existing credential
    const { rows } = await query(
      'SELECT * FROM credentials WHERE id = $1',
      [credentialId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Credential');
    }

    const credential = rows[0];

    // Check delete permission
    const canDelete = await permissionService.canDelete(user, credential);
    if (!canDelete) {
      throw new AuthorizationError('You do not have permission to delete this credential');
    }

    // Delete (CASCADE will remove shares)
    await query('DELETE FROM credentials WHERE id = $1', [credentialId]);

    // Audit log
    await auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'credential.delete',
      resourceType: 'credential',
      resourceId: credentialId,
      resourceName: credential.name,
      metadata: { credentialType: credential.credential_type },
    });
  }

  /**
   * List credentials accessible to user with search/filter
   * @param {Object} user - User object
   * @param {Object} filters - Search filters
   * @returns {Promise<Object>} Paginated credentials
   */
  async list(user, filters = {}) {
    const {
      search,
      credentialType,
      teamId,
      folderId,
      tags,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = filters;

    // Get accessible credential IDs
    const accessibleIds = await permissionService.getAccessibleCredentialIds(user.id, user.role);
    
    if (accessibleIds.length === 0) {
      return { credentials: [], total: 0, page, limit };
    }

    // Build WHERE clause
    const whereConditions = [`c.id = ANY($1)`];
    const queryParams = [accessibleIds];
    let paramCount = 2;

    if (search) {
      whereConditions.push(`(
        c.name ILIKE $${paramCount} OR 
        c.description ILIKE $${paramCount} OR
        c.tags::text ILIKE $${paramCount}
      )`);
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    if (credentialType) {
      whereConditions.push(`c.credential_type = $${paramCount++}`);
      queryParams.push(credentialType);
    }

    if (teamId) {
      whereConditions.push(`c.team_id = $${paramCount++}`);
      queryParams.push(teamId);
    }

    if (folderId) {
      whereConditions.push(`c.folder_id = $${paramCount++}`);
      queryParams.push(folderId);
    }

    if (tags && tags.length > 0) {
      whereConditions.push(`c.tags && $${paramCount++}`);
      queryParams.push(tags);
    }

    // Validate sort fields
    const allowedSortFields = ['name', 'created_at', 'updated_at', 'credential_type'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Calculate offset
    const offset = (page - 1) * limit;

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM credentials c
      WHERE ${whereConditions.join(' AND ')}
    `;
    const { rows: countResult } = await query(countQuery, queryParams);
    const total = parseInt(countResult[0].total, 10);

    // Get credentials
    const dataQuery = `
      SELECT 
        c.id, c.name, c.description, c.credential_type,
        c.folder_id, c.team_id, c.owner_id, c.tags,
        c.created_at, c.updated_at, c.last_accessed_at,
        u.full_name as owner_name,
        t.name as team_name,
        f.name as folder_name
      FROM credentials c
      LEFT JOIN users u ON c.owner_id = u.id
      LEFT JOIN teams t ON c.team_id = t.id
      LEFT JOIN folders f ON c.folder_id = f.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY c.${sortField} ${sortDir}
      LIMIT $${paramCount++} OFFSET $${paramCount}
    `;
    
    queryParams.push(limit, offset);

    const { rows: credentials } = await query(dataQuery, queryParams);

    return {
      credentials,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Share a credential with another user
   * @param {Object} user - User sharing the credential
   * @param {string} credentialId - Credential UUID
   * @param {Object} shareData - Share details
   * @returns {Promise<Object>} Created share
   */
  async share(user, credentialId, shareData) {
    const { userId, permission, expiresAt } = shareData;

    // Get credential
    const { rows } = await query(
      'SELECT * FROM credentials WHERE id = $1',
      [credentialId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Credential');
    }

    const credential = rows[0];

    // Check share permission
    const canShare = await permissionService.canShare(user, credential);
    if (!canShare) {
      throw new AuthorizationError('You do not have permission to share this credential');
    }

    // Check if target user exists
    const { rows: targetUser } = await query(
      'SELECT id, email, role FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (targetUser.length === 0) {
      throw new NotFoundError('User to share with');
    }

    // Create or update share
    const { rows: share } = await query(
      `INSERT INTO credential_shares 
       (credential_id, shared_with_user_id, shared_by_user_id, permission, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (credential_id, shared_with_user_id)
       DO UPDATE SET 
         permission = EXCLUDED.permission,
         expires_at = EXCLUDED.expires_at,
         shared_by_user_id = EXCLUDED.shared_by_user_id
       RETURNING *`,
      [credentialId, userId, user.id, permission, expiresAt || null]
    );

    // Update is_shared flag
    await query(
      'UPDATE credentials SET is_shared = true WHERE id = $1',
      [credentialId]
    );

    // Audit log
    await auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'credential.share',
      resourceType: 'credential',
      resourceId: credentialId,
      resourceName: credential.name,
      metadata: {
        sharedWith: targetUser[0].email,
        permission,
        expiresAt: expiresAt || null,
      },
    });

    return share[0];
  }

  /**
   * Remove a share
   * @param {Object} user - User removing the share
   * @param {string} credentialId - Credential UUID
   * @param {string} userId - User to unshare with
   */
  async unshare(user, credentialId, userId) {
    // Get credential
    const { rows } = await query(
      'SELECT * FROM credentials WHERE id = $1',
      [credentialId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Credential');
    }

    const credential = rows[0];

    // Check share permission
    const canShare = await permissionService.canShare(user, credential);
    if (!canShare) {
      throw new AuthorizationError('You do not have permission to modify shares');
    }

    // Remove share
    await query(
      'DELETE FROM credential_shares WHERE credential_id = $1 AND shared_with_user_id = $2',
      [credentialId, userId]
    );

    // Update is_shared flag if no more shares
    const { rows: remainingShares } = await query(
      'SELECT COUNT(*) as count FROM credential_shares WHERE credential_id = $1',
      [credentialId]
    );

    if (parseInt(remainingShares[0].count, 10) === 0) {
      await query(
        'UPDATE credentials SET is_shared = false WHERE id = $1',
        [credentialId]
      );
    }

    // Audit log
    await auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'credential.unshare',
      resourceType: 'credential',
      resourceId: credentialId,
      resourceName: credential.name,
      metadata: { unsharedWithUserId: userId },
    });
  }
}

module.exports = new CredentialService();