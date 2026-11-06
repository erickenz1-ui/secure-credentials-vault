/**
 * User Controller
 * Handles HTTP requests for user management endpoints
 */

const userService = require('../services/user.service');

class UserController {
  
  /**
   * POST /api/users
   * Create a new user
   */
  async create(req, res, next) {
    try {
      const user = await userService.create(req.user, req.body);

      res.status(201).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users
   * List users with filters
   */
  async list(req, res, next) {
    try {
      const filters = {
        search: req.query.search,
        role: req.query.role,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
        page: req.query.page || 1,
        limit: req.query.limit || 20,
        sortBy: req.query.sortBy || 'created_at',
        sortOrder: req.query.sortOrder || 'DESC',
      };

      const result = await userService.list(req.user, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users/:id
   * Get user by ID
   */
  async getById(req, res, next) {
    try {
      const user = await userService.getById(req.user, req.params.id);

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/users/:id
   * Update a user
   */
  async update(req, res, next) {
    try {
      const user = await userService.update(req.user, req.params.id, req.body);

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/users/:id
   * Delete a user
   */
  async delete(req, res, next) {
    try {
      await userService.delete(req.user, req.params.id);

      res.status(200).json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();