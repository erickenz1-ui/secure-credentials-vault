/**
 * Zod validation schemas
 * Used by validate.middleware.js to validate request data
 */

const { z } = require('zod');
const config = require('../config');

// ============================================
// AUTH SCHEMAS
// ============================================

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(config.passwordPolicy.minLength, `Password must be at least ${config.passwordPolicy.minLength} characters`)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  fullName: z.string().min(2).max(255),
  role: z.enum(['super_admin', 'admin', 'manager', 'standard', 'read_only']).default('standard'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(config.passwordPolicy.minLength, `Password must be at least ${config.passwordPolicy.minLength} characters`)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string()
    .min(config.passwordPolicy.minLength, `Password must be at least ${config.passwordPolicy.minLength} characters`)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

// ============================================
// CREDENTIAL SCHEMAS
// ============================================

const createCredentialSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  credentialType: z.enum(['password', 'api_key', 'private_key', 'certificate', 'ssh_key', 'other']),
  secretData: z.string().min(1, 'Secret data is required'),
  folderId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).max(10).optional(),
});

const updateCredentialSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  credentialType: z.enum(['password', 'api_key', 'private_key', 'certificate', 'ssh_key', 'other']).optional(),
  secretData: z.string().optional(), // Only if updating the secret
  folderId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).max(10).optional(),
});

const shareCredentialSchema = z.object({
  userId: z.string().uuid(),
  permission: z.enum(['read', 'write']).default('read'),
  expiresAt: z.string().datetime().optional().nullable(),
});

// ============================================
// USER SCHEMAS
// ============================================

const updateUserSchema = z.object({
  fullName: z.string().min(2).max(255).optional(),
  role: z.enum(['super_admin', 'admin', 'manager', 'standard', 'read_only']).optional(),
  isActive: z.boolean().optional(),
});

const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(config.passwordPolicy.minLength, `Password must be at least ${config.passwordPolicy.minLength} characters`)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  fullName: z.string().min(2).max(255),
  role: z.enum(['super_admin', 'admin', 'manager', 'standard', 'read_only']).default('standard'),
});

// ============================================
// TEAM SCHEMAS
// ============================================

const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

const updateTeamSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
});

const addTeamMemberSchema = z.object({
  userId: z.string().uuid(),
  roleInTeam: z.enum(['manager', 'member']).default('member'),
});

// ============================================
// FOLDER SCHEMAS
// ============================================

const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  teamId: z.string().uuid().optional().nullable(),
  parentFolderId: z.string().uuid().optional().nullable(),
});

module.exports = {
  // Auth
  loginSchema,
  registerSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  
  // Credentials
  createCredentialSchema,
  updateCredentialSchema,
  shareCredentialSchema,
  
  // Users
  updateUserSchema,
  createUserSchema,
  
  // Teams
  createTeamSchema,
  updateTeamSchema,
  addTeamMemberSchema,
  
  // Folders
  createFolderSchema,
};