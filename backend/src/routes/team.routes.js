/**
 * Team Routes
 */

const express = require('express');
const router = express.Router();

const teamController = require('../controllers/team.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin, requireManager, requireAnyRole } = require('../middleware/authorize.middleware');
const {
  createTeamSchema,
  updateTeamSchema,
  addTeamMemberSchema,
} = require('../utils/validators');

// All routes require authentication
router.use(authenticate);

// ============================================
// TEAM CRUD
// ============================================

// Create team (admin and above)
router.post(
  '/',
  requireAdmin,
  validate({ body: createTeamSchema }),
  teamController.create
);

// List teams (all roles - filtered by access)
router.get('/', requireAnyRole, teamController.list);

// Get team by ID (all roles - checked in service)
router.get('/:id', requireAnyRole, teamController.getById);

// Update team (manager and above)
router.put(
  '/:id',
  requireManager,
  validate({ body: updateTeamSchema }),
  teamController.update
);

// Delete team (admin and above)
router.delete('/:id', requireAdmin, teamController.delete);

// ============================================
// TEAM MEMBERS
// ============================================

// Add member (manager and above)
router.post(
  '/:id/members',
  requireManager,
  validate({ body: addTeamMemberSchema }),
  teamController.addMember
);

// Remove member (manager and above)
router.delete('/:id/members/:userId', requireManager, teamController.removeMember);

module.exports = router;