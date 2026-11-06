-- ============================================
-- Seed Data for Development
-- ============================================
-- WARNING: This is for DEVELOPMENT ONLY!
-- Passwords are 'Password123!' for all users (change in production!)

-- Note: In real migration, we'd use actual argon2 hashes
-- For now, we'll insert placeholder hashes and update them via script

-- 1. Create users (password hashes will be set by seed script)
INSERT INTO users (email, password_hash, full_name, role) VALUES
('superadmin@vault.local', '$argon2id$v=19$m=65536,t=3,p=4$PLACEHOLDER', 'Super Administrator', 'super_admin'),
('admin@vault.local', '$argon2id$v=19$m=65536,t=3,p=4$PLACEHOLDER', 'Admin User', 'admin'),
('manager@vault.local', '$argon2id$v=19$m=65536,t=3,p=4$PLACEHOLDER', 'Manager User', 'manager'),
('user@vault.local', '$argon2id$v=19$m=65536,t=3,p=4$PLACEHOLDER', 'Standard User', 'standard'),
('readonly@vault.local', '$argon2id$v=19$m=65536,t=3,p=4$PLACEHOLDER', 'Read-Only User', 'read_only');

-- 2. Create teams
INSERT INTO teams (name, description, created_by) VALUES
('Engineering', 'Engineering team credentials', (SELECT id FROM users WHERE email = 'admin@vault.local')),
('DevOps', 'DevOps and infrastructure', (SELECT id FROM users WHERE email = 'admin@vault.local')),
('Finance', 'Finance department', (SELECT id FROM users WHERE email = 'admin@vault.local'));

-- 3. Add team members
-- Engineering team
INSERT INTO team_members (team_id, user_id, role_in_team)
SELECT 
    (SELECT id FROM teams WHERE name = 'Engineering'),
    (SELECT id FROM users WHERE email = 'manager@vault.local'),
    'manager';

INSERT INTO team_members (team_id, user_id, role_in_team)
SELECT 
    (SELECT id FROM teams WHERE name = 'Engineering'),
    (SELECT id FROM users WHERE email = 'user@vault.local'),
    'member';

-- DevOps team
INSERT INTO team_members (team_id, user_id, role_in_team)
SELECT 
    (SELECT id FROM teams WHERE name = 'DevOps'),
    (SELECT id FROM users WHERE email = 'admin@vault.local'),
    'manager';

-- 4. Create folders
INSERT INTO folders (name, description, team_id, owner_id) VALUES
('Databases', 'Database credentials', (SELECT id FROM teams WHERE name = 'Engineering'), (SELECT id FROM users WHERE email = 'manager@vault.local')),
('APIs', 'Third-party API keys', (SELECT id FROM teams WHERE name = 'Engineering'), (SELECT id FROM users WHERE email = 'manager@vault.local')),
('Infrastructure', 'Server and cloud credentials', (SELECT id FROM teams WHERE name = 'DevOps'), (SELECT id FROM users WHERE email = 'admin@vault.local')),
('Personal', 'Personal credentials', NULL, (SELECT id FROM users WHERE email = 'user@vault.local'));

-- 5. Create sample credentials (encrypted data will be added by seed script)
-- These are placeholders - actual encrypted data will be inserted by the seed script
INSERT INTO credentials (name, description, credential_type, encrypted_data, encrypted_key, folder_id, team_id, owner_id, tags)
VALUES
('Production DB Password', 'Main PostgreSQL database', 'password', 'PLACEHOLDER', 'PLACEHOLDER', 
 (SELECT id FROM folders WHERE name = 'Databases'), (SELECT id FROM teams WHERE name = 'Engineering'),
 (SELECT id FROM users WHERE email = 'manager@vault.local'), ARRAY['database', 'production', 'critical']),
 
('Stripe API Key', 'Payment processing', 'api_key', 'PLACEHOLDER', 'PLACEHOLDER',
 (SELECT id FROM folders WHERE name = 'APIs'), (SELECT id FROM teams WHERE name = 'Engineering'),
 (SELECT id FROM users WHERE email = 'manager@vault.local'), ARRAY['payment', 'api', 'production']),
 
('AWS Root Key', 'AWS administrative access', 'api_key', 'PLACEHOLDER', 'PLACEHOLDER',
 (SELECT id FROM folders WHERE name = 'Infrastructure'), (SELECT id FROM teams WHERE name = 'DevOps'),
 (SELECT id FROM users WHERE email = 'admin@vault.local'), ARRAY['aws', 'cloud', 'critical']),
 
('GitHub Deploy Key', 'CI/CD deployment', 'ssh_key', 'PLACEHOLDER', 'PLACEHOLDER',
 (SELECT id FROM folders WHERE name = 'Infrastructure'), (SELECT id FROM teams WHERE name = 'DevOps'),
 (SELECT id FROM users WHERE email = 'admin@vault.local'), ARRAY['github', 'cicd']);

-- 6. Share a credential with read-only user
INSERT INTO credential_shares (credential_id, shared_with_user_id, shared_by_user_id, permission)
SELECT
    (SELECT id FROM credentials WHERE name = 'Production DB Password'),
    (SELECT id FROM users WHERE email = 'readonly@vault.local'),
    (SELECT id FROM users WHERE email = 'manager@vault.local'),
    'read';

-- 7. Initial audit log entry (genesis entry)
INSERT INTO audit_logs (user_id, user_email, user_role, action, resource_type, metadata, entry_hash, previous_hash)
VALUES
(NULL, 'system', 'system', 'system.initialized', 'system', '{"version": "1.0.0"}', 
 'genesis_hash_placeholder', NULL);