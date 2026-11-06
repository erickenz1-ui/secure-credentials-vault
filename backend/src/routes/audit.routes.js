/**
 * Audit Routes
 */

const express = require('express');
const router = express.Router();

const auditController = require('../controllers/audit.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/authorize.middleware');

// All routes require authentication
router.use(authenticate);

// ============================================
// AUDIT LOGS
// ============================================

// List audit logs (admin and above)
router.get('/', requireAdmin, auditController.list);

// Verify integrity (super admin only)
router.get('/verify', auditController.verifyIntegrity);

// Get distinct actions (admin and above)
router.get('/actions', requireAdmin, auditController.getActions);

module.exports = router;