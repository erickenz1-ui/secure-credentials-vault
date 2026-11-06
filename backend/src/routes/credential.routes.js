/**
 * Credential Routes
 */

const express = require('express');
const router = express.Router();

const credentialController = require('../controllers/credential.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { requireStandardUser, requireAnyRole } = require('../middleware/authorize.middleware');
const {
  createCredentialSchema,
  updateCredentialSchema,
  shareCredentialSchema,
} = require('../utils/validators');

// All routes require authentication
router.use(authenticate);

// ============================================
// CREDENTIAL CRUD
// ============================================

// Create credential (standard users and above)
router.post(
  '/',
  requireStandardUser,
  validate({ body: createCredentialSchema }),
  credentialController.create
);

// List credentials (all roles)
router.get('/', requireAnyRole, credentialController.list);

// Get credential metadata (all roles)
router.get('/:id', requireAnyRole, credentialController.getById);

// Reveal credential secret (standard users and above)
router.get('/:id/reveal', requireStandardUser, credentialController.reveal);

// Update credential (standard users and above)
router.put(
  '/:id',
  requireStandardUser,
  validate({ body: updateCredentialSchema }),
  credentialController.update
);

// Delete credential (standard users and above)
router.delete('/:id', requireStandardUser, credentialController.delete);

// ============================================
// SHARING
// ============================================

// Share credential (standard users and above)
router.post(
  '/:id/share',
  requireStandardUser,
  validate({ body: shareCredentialSchema }),
  credentialController.share
);

// Remove share (standard users and above)
router.delete('/:id/share/:userId', requireStandardUser, credentialController.unshare);

// List shares (all roles)
router.get('/:id/shares', requireAnyRole, credentialController.listShares);

module.exports = router;