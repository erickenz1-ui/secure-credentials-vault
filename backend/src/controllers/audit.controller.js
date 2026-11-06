/**
 * Audit Controller
 * Handles HTTP requests for audit log endpoints
 */

const auditService = require('../services/audit.service');
const { query } = require('../config/database');
const { AuthorizationError } = require('../utils/errors');

class AuditController {
  
  /**
   * GET /api/audit
   * List audit logs (admin and above)
   */
  async list(req, res, next) {
    try {
      // Only admin and above can view audit logs
      if (!['super_admin', 'admin'].includes(req.user.role)) {
        throw new AuthorizationError('Insufficient permissions to view audit logs');
      }

      const {
        userId,
        action,
        resourceType,
        resourceId,
        startDate,
        endDate,
        page = 1,
        limit = 50,
      } = req.query;

      // Build WHERE clause
      const whereConditions = ['1=1'];
      const queryParams = [];
      let paramCount = 1;

      if (userId) {
        whereConditions.push(`user_id = $${paramCount++}`);
        queryParams.push(userId);
      }

      if (action) {
        whereConditions.push(`action ILIKE $${paramCount++}`);
        queryParams.push(`%${action}%`);
      }

      if (resourceType) {
        whereConditions.push(`resource_type = $${paramCount++}`);
        queryParams.push(resourceType);
      }

      if (resourceId) {
        whereConditions.push(`resource_id = $${paramCount++}`);
        queryParams.push(resourceId);
      }

      if (startDate) {
        whereConditions.push(`timestamp >= $${paramCount++}`);
        queryParams.push(new Date(startDate));
      }

      if (endDate) {
        whereConditions.push(`timestamp <= $${paramCount++}`);
        queryParams.push(new Date(endDate));
      }

      const offset = (page - 1) * limit;

      // Get total count
      const { rows: countResult } = await query(
        `SELECT COUNT(*) as total FROM audit_logs WHERE ${whereConditions.join(' AND ')}`,
        queryParams
      );
      const total = parseInt(countResult[0].total, 10);

      // Get logs
      const { rows: logs } = await query(
        `SELECT 
          id, timestamp, user_id, user_email, user_role,
          action, resource_type, resource_id, resource_name,
          ip_address, metadata
         FROM audit_logs
         WHERE ${whereConditions.join(' AND ')}
         ORDER BY timestamp DESC
         LIMIT $${paramCount++} OFFSET $${paramCount}`,
        [...queryParams, limit, offset]
      );

      res.status(200).json({
        success: true,
        data: {
          logs,
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/audit/verify
   * Verify audit log integrity (super admin only)
   */
  async verifyIntegrity(req, res, next) {
    try {
      // Only super admin can verify integrity
      if (req.user.role !== 'super_admin') {
        throw new AuthorizationError('Only super administrators can verify audit integrity');
      }

      const result = await auditService.verifyIntegrity();

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/audit/actions
   * Get list of distinct actions (for filtering)
   */
  async getActions(req, res, next) {
    try {
      const { rows } = await query(
        `SELECT DISTINCT action FROM audit_logs ORDER BY action`
      );

      res.status(200).json({
        success: true,
        data: rows.map(r => r.action),
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuditController();