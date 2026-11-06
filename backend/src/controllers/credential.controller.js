/**
 * Credential Controller
 * Handles HTTP requests for credential endpoints
 */

const credentialService = require('../services/credential.service');
const auditService = require('../services/audit.service');

class CredentialController {
  
  /**
   * POST /api/credentials
   * Create a new credential
   */
  async create(req, res, next) {
    try {
      const credential = await credentialService.create(req.user, req.body);

      res.status(201).json({
        success: true,
        data: credential,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/credentials
   * List credentials with search/filter
   */
  async list(req, res, next) {
    try {
      const filters = {
        search: req.query.search,
        credentialType: req.query.type,
        teamId: req.query.teamId,
        folderId: req.query.folderId,
        tags: req.query.tags ? req.query.tags.split(',') : undefined,
        page: req.query.page || 1,
        limit: req.query.limit || 20,
        sortBy: req.query.sortBy || 'created_at',
        sortOrder: req.query.sortOrder || 'DESC',
      };

      const result = await credentialService.list(req.user, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/credentials/:id
   * Get credential metadata (no secret)
   */
  async getById(req, res, next) {
    try {
      const credential = await credentialService.getById(req.user, req.params.id);

      res.status(200).json({
        success: true,
        data: credential,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/credentials/:id/reveal
   * Reveal (decrypt) credential secret
   */
  async reveal(req, res, next) {
    try {
      const credential = await credentialService.reveal(req.user, req.params.id);

      // Add IP and user agent to audit log
      await auditService.log({
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'credential.reveal',
        resourceType: 'credential',
        resourceId: credential.id,
        resourceName: credential.name,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { credentialType: credential.credentialType },
      });

      res.status(200).json({
        success: true,
        data: credential,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/credentials/:id
   * Update a credential
   */
  async update(req, res, next) {
    try {
      const credential = await credentialService.update(req.user, req.params.id, req.body);

      res.status(200).json({
        success: true,
        data: credential,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/credentials/:id
   * Delete a credential
   */
  async delete(req, res, next) {
    try {
      await credentialService.delete(req.user, req.params.id);

      res.status(200).json({
        success: true,
        message: 'Credential deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/credentials/:id/share
   * Share a credential with a user
   */
  async share(req, res, next) {
    try {
      const share = await credentialService.share(req.user, req.params.id, req.body);

      res.status(200).json({
        success: true,
        data: share,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/credentials/:id/share/:userId
   * Remove a share
   */
  async unshare(req, res, next) {
    try {
      await credentialService.unshare(req.user, req.params.id, req.params.userId);

      res.status(200).json({
        success: true,
        message: 'Share removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/credentials/:id/shares
   * List all shares for a credential
   */
  async listShares(req, res, next) {
    try {
      const { query } = require('../config/database');
      
      const { rows: shares } = await query(
        `SELECT 
          cs.id,
          cs.permission,
          cs.expires_at,
          cs.created_at,
          u.id as user_id,
          u.email,
          u.full_name,
          u.role,
          su.email as shared_by_email,
          su.full_name as shared_by_name
         FROM credential_shares cs
         JOIN users u ON cs.shared_with_user_id = u.id
         LEFT JOIN users su ON cs.shared_by_user_id = su.id
         WHERE cs.credential_id = $1
         ORDER BY cs.created_at DESC`,
        [req.params.id]
      );

      res.status(200).json({
        success: true,
        data: shares,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CredentialController();