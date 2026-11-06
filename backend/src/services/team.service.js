/**
 * Team Service
 * Business logic for team management
 */

const { query, transaction } = require('../config/database');
const permissionService = require('./permission.service');
const auditService = require('./audit.service');
const {
  NotFoundError,
  AuthorizationError,
  ConflictError,
} = require('../utils/errors');

class TeamService {
  
  /**
   * Create a new team
   * @param {Object} user - User creating the team
   * @param {Object} teamData - Team data
   * @returns {Promise<Object>} Created team
   */
  async create(user, teamData) {
    const { name, description } = teamData;

    // Only admin and above can create teams
    if (user.role !== 'super_admin' && user.role !== 'admin') {
      throw new AuthorizationError('Only administrators can create teams');
    }

    // Check if team name already exists
    const { rows: existing } = await query(
      'SELECT id FROM teams WHERE name = $1',
      [name]
    );

    if (existing.length > 0) {
      throw new ConflictError('Team name already exists');
    }

    // Create team
    const { rows } = await query(
      `INSERT INTO teams (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_at`,
      [name, description || null, user.id]
    );

    const team = rows[0];

    // Audit log
    await auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'team.create',
      resourceType: 'team',
      resourceId: team.id,
      resourceName: team.name,
    });

    return team;
  }

  /**
   * Get team by ID
   * @param {Object} user - User making the request
   * @param {string} teamId - Team ID
   * @returns {Promise<Object>} Team data with members
   */
  async getById(user, teamId) {
    // Get team
    const { rows: teams } = await query(
      `SELECT t.id, t.name, t.description, t.created_at,
              u.full_name as created_by_name
       FROM teams t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id = $1`,
      [teamId]
    );

    if (teams.length === 0) {
      throw new NotFoundError('Team');
    }

    const team = teams[0];

    // Check access (must be team member, admin, or have credentials in this team)
    const isMember = await permissionService.isTeamMember(teamId, user.id);
    const isAdmin = user.role === 'super_admin' || user.role === 'admin';
    
    if (!isMember && !isAdmin) {
      throw new AuthorizationError('You do not have access to this team');
    }

    // Get members
    const { rows: members } = await query(
      `SELECT 
        tm.id as membership_id,
        tm.role_in_team,
        tm.joined_at,
        u.id as user_id,
        u.email,
        u.full_name,
        u.role as user_role
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = $1
       ORDER BY tm.role_in_team DESC, u.full_name ASC`,
      [teamId]
    );

    // Get credential count
    const { rows: credCount } = await query(
      'SELECT COUNT(*) as count FROM credentials WHERE team_id = $1',
      [teamId]
    );

    return {
      ...team,
      members,
      credentialCount: parseInt(credCount[0].count, 10),
    };
  }

  /**
   * List teams accessible to user
   * @param {Object} user - User making the request
   * @param {Object} filters - Search filters
   * @returns {Promise<Object>} Paginated teams
   */
  async list(user, filters = {}) {
    const { search, page = 1, limit = 20 } = filters;

    const whereConditions = ['1=1'];
    const queryParams = [];
    let paramCount = 1;

    // Non-admins only see teams they belong to
    if (user.role !== 'super_admin' && user.role !== 'admin') {
      whereConditions.push(`t.id IN (
        SELECT team_id FROM team_members WHERE user_id = $${paramCount++}
      )`);
      queryParams.push(user.id);
    }

    if (search) {
      whereConditions.push(`(t.name ILIKE $${paramCount} OR t.description ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    const offset = (page - 1) * limit;

    // Get total
    const { rows: countResult } = await query(
      `SELECT COUNT(*) as total FROM teams t WHERE ${whereConditions.join(' AND ')}`,
      queryParams
    );
    const total = parseInt(countResult[0].total, 10);

    // Get teams with member counts
    const { rows: teams } = await query(
      `SELECT 
        t.id, t.name, t.description, t.created_at,
        u.full_name as created_by_name,
        (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) as member_count,
        (SELECT COUNT(*) FROM credentials c WHERE c.team_id = t.id) as credential_count
       FROM teams t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY t.name ASC
       LIMIT $${paramCount++} OFFSET $${paramCount}`,
      [...queryParams, limit, offset]
    );

    return {
      teams,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update a team
   * @param {Object} user - User making the update
   * @param {string} teamId - Team ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated team
   */
  async update(user, teamId, updates) {
    // Check permission
    const canManage = await permissionService.canManageTeam(user, teamId);
    if (!canManage) {
      throw new AuthorizationError('You do not have permission to update this team');
    }

    // Get existing team
    const { rows: existing } = await query(
      'SELECT * FROM teams WHERE id = $1',
      [teamId]
    );

    if (existing.length === 0) {
      throw new NotFoundError('Team');
    }

    const team = existing[0];

    // Build update
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      // Check name uniqueness
      const { rows: nameCheck } = await query(
        'SELECT id FROM teams WHERE name = $1 AND id != $2',
        [updates.name, teamId]
      );
      if (nameCheck.length > 0) {
        throw new ConflictError('Team name already exists');
      }
      updateFields.push(`name = $${paramCount++}`);
      updateValues.push(updates.name);
    }

    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      updateValues.push(updates.description);
    }

    if (updateFields.length === 0) {
      return team;
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(teamId);

    const { rows } = await query(
      `UPDATE teams SET ${updateFields.join(', ')} WHERE id = $${paramCount}
       RETURNING id, name, description, updated_at`,
      updateValues
    );

    // Audit log
    await auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'team.update',
      resourceType: 'team',
      resourceId: teamId,
      resourceName: updates.name || team.name,
      metadata: { updatedFields: Object.keys(updates) },
    });

    return rows[0];
  }

  /**
   * Delete a team
   * @param {Object} user - User making the deletion
   * @param {string} teamId - Team ID
   */
  async delete(user, teamId) {
    // Only admin and above can delete teams
    if (user.role !== 'super_admin' && user.role !== 'admin') {
      throw new AuthorizationError('Only administrators can delete teams');
    }

    // Get team
    const { rows } = await query(
      'SELECT * FROM teams WHERE id = $1',
      [teamId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Team');
    }

    const team = rows[0];

    // Delete team (CASCADE will remove memberships, credentials will have team_id set to NULL)
    await query('DELETE FROM teams WHERE id = $1', [teamId]);

    // Audit log
    await auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'team.delete',
      resourceType: 'team',
      resourceId: teamId,
      resourceName: team.name,
    });
  }

  /**
   * Add member to team
   * @param {Object} user - User adding the member
   * @param {string} teamId - Team ID
   * @param {Object} memberData - Member data
   * @returns {Promise<Object>} Created membership
   */
  async addMember(user, teamId, memberData) {
    const { userId, roleInTeam } = memberData;

    // Check permission
    const canManage = await permissionService.canManageTeam(user, teamId);
    if (!canManage) {
      throw new AuthorizationError('You do not have permission to add members to this team');
    }

    // Check team exists
    const { rows: teams } = await query(
      'SELECT * FROM teams WHERE id = $1',
      [teamId]
    );

    if (teams.length === 0) {
      throw new NotFoundError('Team');
    }

    const team = teams[0];

    // Check user exists
    const { rows: users } = await query(
      'SELECT id, email, full_name FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (users.length === 0) {
      throw new NotFoundError('User');
    }

    const targetUser = users[0];

    // Add member (upsert if already exists)
    const { rows } = await query(
      `INSERT INTO team_members (team_id, user_id, role_in_team)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id)
       DO UPDATE SET role_in_team = EXCLUDED.role_in_team
       RETURNING *`,
      [teamId, userId, roleInTeam || 'member']
    );

    // Audit log
    await auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'team.add_member',
      resourceType: 'team',
      resourceId: teamId,
      resourceName: team.name,
      metadata: {
        addedUser: targetUser.email,
        roleInTeam: roleInTeam || 'member',
      },
    });

    return rows[0];
  }

  /**
   * Remove member from team
   * @param {Object} user - User removing the member
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID to remove
   */
  async removeMember(user, teamId, userId) {
    // Check permission
    const canManage = await permissionService.canManageTeam(user, teamId);
    if (!canManage) {
      throw new AuthorizationError('You do not have permission to remove members from this team');
    }

    // Check team exists
    const { rows: teams } = await query(
      'SELECT * FROM teams WHERE id = $1',
      [teamId]
    );

    if (teams.length === 0) {
      throw new NotFoundError('Team');
    }

    const team = teams[0];

    // Get member info for audit
    const { rows: members } = await query(
      `SELECT u.email FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = $1 AND tm.user_id = $2`,
      [teamId, userId]
    );

    if (members.length === 0) {
      throw new NotFoundError('Team membership');
    }

    // Remove member
    await query(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    // Audit log
    await auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'team.remove_member',
      resourceType: 'team',
      resourceId: teamId,
      resourceName: team.name,
      metadata: { removedUser: members[0].email },
    });
  }
}

module.exports = new TeamService();