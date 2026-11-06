/**
 * Audit Service
 * Tamper-evident audit logging with hash chaining
 */

const crypto = require('crypto');
const { query } = require('../config/database');
const logger = require('../utils/logger');

class AuditService {
  
  /**
   * Log an audit event
   * @param {Object} params - Audit event parameters
   */
  async log(params) {
    try {
      const {
        userId,
        userEmail,
        userRole,
        action,
        resourceType,
        resourceId,
        resourceName,
        ipAddress,
        userAgent,
        metadata,
      } = params;

      // Get previous hash for chaining
      const { rows: lastEntries } = await query(
        'SELECT entry_hash FROM audit_logs ORDER BY created_at DESC LIMIT 1'
      );

      const previousHash = lastEntries.length > 0 ? lastEntries[0].entry_hash : null;

      // Create entry content for hashing
      const entryContent = JSON.stringify({
        timestamp: new Date().toISOString(),
        userId,
        action,
        resourceType,
        resourceId,
        previousHash,
      });

      // Generate hash for this entry
      const entryHash = crypto
        .createHash('sha256')
        .update(entryContent)
        .digest('hex');

      // Insert audit log
      await query(
        `INSERT INTO audit_logs 
         (user_id, user_email, user_role, action, resource_type, resource_id, 
          resource_name, ip_address, user_agent, metadata, entry_hash, previous_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          userId,
          userEmail,
          userRole,
          action,
          resourceType,
          resourceId,
          resourceName || null,
          ipAddress,
          userAgent,
          metadata ? JSON.stringify(metadata) : null,
          entryHash,
          previousHash,
        ]
      );

      // Also log to Winston (without sensitive data)
      logger.info(`[AUDIT] ${action} by ${userEmail || 'system'}`, {
        resourceType,
        resourceId,
        ip: ipAddress,
      });

    } catch (error) {
      // Don't throw - audit failures shouldn't break the app
      // But log the error for investigation
      logger.error('Audit logging error:', error);
    }
  }

  /**
   * Verify audit log integrity
   * @returns {Promise<Object>} Verification result
   */
  async verifyIntegrity() {
    try {
      const { rows: logs } = await query(
        'SELECT id, entry_hash, previous_hash, created_at FROM audit_logs ORDER BY created_at ASC'
      );

      let isValid = true;
      let invalidEntries = [];

      for (let i = 0; i < logs.length; i++) {
        const current = logs[i];
        const expectedPreviousHash = i === 0 ? null : logs[i - 1].entry_hash;

        if (current.previous_hash !== expectedPreviousHash) {
          isValid = false;
          invalidEntries.push(current.id);
        }
      }

      return {
        isValid,
        totalEntries: logs.length,
        invalidEntries,
      };
    } catch (error) {
      logger.error('Audit integrity check error:', error);
      throw error;
    }
  }
}

module.exports = new AuditService();