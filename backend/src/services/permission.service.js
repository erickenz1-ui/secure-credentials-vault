/**
 * Permission Service
 * Centralized scope resolution - decides who can do what to which credential
 * 
 * Access hierarchy (checked in order, first match wins):
 * 1. Super Admin → full access to everything
 * 2. Credential Owner → full access to own credentials
 * 3. Team Manager → access to team credentials (if manager of that team)
 * 4. Explicit Share → access if credential is shared with user
 * 5. Team Member → read access to team credentials (if team member)
 * 6. Deny
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

class PermissionService {
  
  // ============================================
  // ROLE HIERARCHY
  // ============================================
  
  /**
   * Role hierarchy levels (higher = more permissions)
   */
  static ROLE_LEVELS = {
    super_admin: 100,
    admin: 80,
    manager: 60,
    standard: 40,
    read_only: 20,
  };

  /**
   * Check if role A has at least the permissions of role B
   * @param {string} roleA - Role to check
   * @param {string} roleB - Minimum required role
   * @returns {boolean}
   */
  static hasRoleLevel(roleA, roleB) {
    return (this.ROLE_LEVELS[roleA] || 0) >= (this.ROLE_LEVELS[roleB] || 0);
  }

  // ============================================
  // CREDENTIAL ACCESS
  // ============================================

  /**
   * Check if user can view a credential (metadata)
   * @param {Object} user - User object with id and role
   * @param {Object} credential - Credential object
   * @returns {Promise<boolean>}
   */
  async canView(user, credential) {
    // Super admin can view everything
    if (user.role === 'super_admin') return true;

    // Owner can view
    if (credential.owner_id === user.id) return true;

    // Check explicit share
    if (await this.hasShare(credential.id, user.id)) return true;

    // Check team membership
    if (credential.team_id) {
      const isTeamMember = await this.isTeamMember(credential.team_id, user.id);
      if (isTeamMember) return true;
    }

    return false;
  }

  /**
   * Check if user can reveal (decrypt) the secret value
   * @param {Object} user - User object
   * @param {Object} credential - Credential object
   * @returns {Promise<boolean>}
   */
  async canReveal(user, credential) {
    // Read-only users can NEVER reveal secrets
    if (user.role === 'read_only') return false;

    // Super admin can reveal everything
    if (user.role === 'super_admin') return true;

    // Owner can reveal
    if (credential.owner_id === user.id) return true;

    // Check explicit share with read permission
    const share = await this.getShare(credential.id, user.id);
    if (share && share.permission === 'read') return true;

    // Check if user is manager of the credential's team
    if (credential.team_id) {
      const isManager = await this.isTeamManager(credential.team_id, user.id);
      if (isManager) return true;

      // Team members with standard+ role can reveal team credentials
      const isMember = await this.isTeamMember(credential.team_id, user.id);
      if (isMember && PermissionService.hasRoleLevel(user.role, 'standard')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user can edit/update a credential
   * @param {Object} user - User object
   * @param {Object} credential - Credential object
   * @returns {Promise<boolean>}
   */
  async canEdit(user, credential) {
    // Read-only users can never edit
    if (user.role === 'read_only') return false;

    // Super admin can edit everything
    if (user.role === 'super_admin') return true;

    // Owner can edit
    if (credential.owner_id === user.id) return true;

    // Check explicit share with write permission
    const share = await this.getShare(credential.id, user.id);
    if (share && share.permission === 'write') return true;

    // Team managers can edit team credentials
    if (credential.team_id) {
      const isManager = await this.isTeamManager(credential.team_id, user.id);
      if (isManager) return true;
    }

    return false;
  }

  /**
   * Check if user can delete a credential
   * @param {Object} user - User object
   * @param {Object} credential - Credential object
   * @returns {Promise<boolean>}
   */
  async canDelete(user, credential) {
    // Read-only users can never delete
    if (user.role === 'read_only') return false;

    // Super admin can delete everything
    if (user.role === 'super_admin') return true;

    // Owner can delete
    if (credential.owner_id === user.id) return true;

    // Team managers can delete team credentials
    if (credential.team_id) {
      const isManager = await this.isTeamManager(credential.team_id, user.id);
      if (isManager) return true;
    }

    return false;
  }

  /**
   * Check if user can share a credential with others
   * @param {Object} user - User object
   * @param {Object} credential - Credential object
   * @returns {Promise<boolean>}
   */
  async canShare(user, credential) {
    // Read-only users can never share
    if (user.role === 'read_only') return false;

    // Super admin can share everything
    if (user.role === 'super_admin') return true;

    // Owner can share
    if (credential.owner_id === user.id) return true;

    // Team managers can share team credentials
    if (credential.team_id) {
      const isManager = await this.isTeamManager(credential.team_id, user.id);
      if (isManager) return true;
    }

    return false;
  }

  // ============================================
  // TEAM HELPERS
  // ============================================

  /**
   * Check if user is a member of a team
   * @param {string} teamId - Team UUID
   * @param {string} userId - User UUID
   * @returns {Promise<boolean>}
   */
  async isTeamMember(teamId, userId) {
    const { rows } = await query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    return rows.length > 0;
  }

  /**
   * Check if user is a manager of a team
   * @param {string} teamId - Team UUID
   * @param {string} userId - User UUID
   * @returns {Promise<boolean>}
   */
  async isTeamManager(teamId, userId) {
    const { rows } = await query(
      `SELECT 1 FROM team_members 
       WHERE team_id = $1 AND user_id = $2 AND role_in_team = 'manager'`,
      [teamId, userId]
    );
    return rows.length > 0;
  }

  /**
   * Get user's role in a team
   * @param {string} teamId - Team UUID
   * @param {string} userId - User UUID
   * @returns {Promise<string|null>} 'manager', 'member', or null
   */
  async getTeamRole(teamId, userId) {
    const { rows } = await query(
      'SELECT role_in_team FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    return rows.length > 0 ? rows[0].role_in_team : null;
  }

  // ============================================
  // SHARE HELPERS
  // ============================================

  /**
   * Check if credential is shared with user
   * @param {string} credentialId - Credential UUID
   * @param {string} userId - User UUID
   * @returns {Promise<boolean>}
   */
  async hasShare(credentialId, userId) {
    const { rows } = await query(
      `SELECT 1 FROM credential_shares 
       WHERE credential_id = $1 AND shared_with_user_id = $2
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [credentialId, userId]
    );
    return rows.length > 0;
  }

  /**
   * Get share details for a user
   * @param {string} credentialId - Credential UUID
   * @param {string} userId - User UUID
   * @returns {Promise<Object|null>} Share object or null
   */
  async getShare(credentialId, userId) {
    const { rows } = await query(
      `SELECT id, permission, expires_at 
       FROM credential_shares 
       WHERE credential_id = $1 AND shared_with_user_id = $2
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [credentialId, userId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // ============================================
  // USER MANAGEMENT PERMISSIONS
  // ============================================

  /**
   * Check if user can manage another user
   * @param {Object} manager - User attempting to manage
   * @param {Object} target - User being managed
   * @returns {boolean}
   */
  canManageUser(manager, target) {
    // Super admin can manage everyone
    if (manager.role === 'super_admin') return true;

    // Admin can manage non-super-admin users
    if (manager.role === 'admin' && target.role !== 'super_admin') return true;

    // Managers can manage standard and read-only users in their teams
    if (manager.role === 'manager') {
      if (target.role === 'standard' || target.role === 'read_only') {
        // Additional check: must be in same team (checked in controller)
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user can manage a team
   * @param {Object} user - User object
   * @param {string} teamId - Team UUID
   * @returns {Promise<boolean>}
   */
  async canManageTeam(user, teamId) {
    // Super admin can manage all teams
    if (user.role === 'super_admin') return true;

    // Admin can manage all teams
    if (user.role === 'admin') return true;

    // Team managers can manage their own teams
    if (user.role === 'manager') {
      return await this.isTeamManager(teamId, user.id);
    }

    return false;
  }

  // ============================================
  // SCOPE QUERIES (for listing)
  // ============================================

  /**
   * Get all credential IDs accessible to a user
   * Used for listing/searching credentials
   * @param {string} userId - User UUID
   * @param {string} userRole - User role
   * @returns {Promise<string[]>} Array of credential UUIDs
   */
  async getAccessibleCredentialIds(userId, userRole) {
    // Super admin sees everything
    if (userRole === 'super_admin') {
      const { rows } = await query('SELECT id FROM credentials');
      return rows.map(r => r.id);
    }

    const { rows } = await query(
      `SELECT DISTINCT c.id
       FROM credentials c
       LEFT JOIN credential_shares cs ON c.id = cs.credential_id
       LEFT JOIN team_members tm ON c.team_id = tm.team_id
       WHERE c.owner_id = $1
          OR cs.shared_with_user_id = $1
          OR tm.user_id = $1`,
      [userId]
    );

    return rows.map(r => r.id);
  }

  /**
   * Get all team IDs accessible to a user
   * @param {string} userId - User UUID
   * @param {string} userRole - User role
   * @returns {Promise<string[]>} Array of team UUIDs
   */
  async getAccessibleTeamIds(userId, userRole) {
    // Super admin and admin see all teams
    if (userRole === 'super_admin' || userRole === 'admin') {
      const { rows } = await query('SELECT id FROM teams');
      return rows.map(r => r.id);
    }

    // Others see only teams they belong to
    const { rows } = await query(
      'SELECT team_id FROM team_members WHERE user_id = $1',
      [userId]
    );

    return rows.map(r => r.team_id);
  }
}

module.exports = new PermissionService();