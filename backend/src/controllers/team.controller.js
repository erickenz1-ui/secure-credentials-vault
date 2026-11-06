/**
 * Team Controller
 * Handles HTTP requests for team management endpoints
 */

const teamService = require('../services/team.service');

class TeamController {
  
  /**
   * POST /api/teams
   * Create a new team
   */
  async create(req, res, next) {
    try {
      const team = await teamService.create(req.user, req.body);

      res.status(201).json({
        success: true,
        data: team,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/teams
   * List teams
   */
  async list(req, res, next) {
    try {
      const filters = {
        search: req.query.search,
        page: req.query.page || 1,
        limit: req.query.limit || 20,
      };

      const result = await teamService.list(req.user, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/teams/:id
   * Get team by ID
   */
  async getById(req, res, next) {
    try {
      const team = await teamService.getById(req.user, req.params.id);

      res.status(200).json({
        success: true,
        data: team,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/teams/:id
   * Update a team
   */
  async update(req, res, next) {
    try {
      const team = await teamService.update(req.user, req.params.id, req.body);

      res.status(200).json({
        success: true,
        data: team,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/teams/:id
   * Delete a team
   */
  async delete(req, res, next) {
    try {
      await teamService.delete(req.user, req.params.id);

      res.status(200).json({
        success: true,
        message: 'Team deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/teams/:id/members
   * Add member to team
   */
  async addMember(req, res, next) {
    try {
      const membership = await teamService.addMember(req.user, req.params.id, req.body);

      res.status(201).json({
        success: true,
        data: membership,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/teams/:id/members/:userId
   * Remove member from team
   */
  async removeMember(req, res, next) {
    try {
      await teamService.removeMember(req.user, req.params.id, req.params.userId);

      res.status(200).json({
        success: true,
        message: 'Member removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TeamController();