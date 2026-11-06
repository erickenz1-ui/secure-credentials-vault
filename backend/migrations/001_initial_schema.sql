-- ============================================
-- Credentials Vault - Initial Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,           -- argon2id hash
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'admin', 'manager', 'standard', 'read_only')),
    is_active BOOLEAN DEFAULT true,
    refresh_token_version INTEGER DEFAULT 0,       -- For session revocation
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,                        -- Account lockout
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. TEAMS TABLE
-- ============================================
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. TEAM MEMBERSHIPS (junction table)
-- ============================================
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_in_team VARCHAR(50) DEFAULT 'member' CHECK (role_in_team IN ('manager', 'member')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

-- ============================================
-- 4. FOLDERS (for organizing credentials)
-- ============================================
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,  -- NULL = personal folder
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    parent_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. CREDENTIALS TABLE (encrypted!)
-- ============================================
CREATE TABLE credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,                    -- e.g., "Production DB Password"
    description TEXT,
    credential_type VARCHAR(50) NOT NULL CHECK (credential_type IN (
        'password', 'api_key', 'private_key', 'certificate', 'ssh_key', 'other'
    )),
    
    -- Encrypted fields (AES-256-GCM)
    encrypted_data TEXT NOT NULL,                  -- Base64: IV + ciphertext + auth tag
    encrypted_key TEXT NOT NULL,                   -- Base64: DEK encrypted with master key
    encryption_version INTEGER DEFAULT 1,            -- For future key rotation
    
    -- Metadata (not encrypted, safe to search/filter)
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,  -- Owning team
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Access control
    is_shared BOOLEAN DEFAULT false,
    tags TEXT[],                                   -- Array of tags for search
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP,
    last_accessed_by UUID REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_credentials_owner ON credentials(owner_id);
CREATE INDEX idx_credentials_team ON credentials(team_id);
CREATE INDEX idx_credentials_folder ON credentials(folder_id);
CREATE INDEX idx_credentials_type ON credentials(credential_type);
CREATE INDEX idx_credentials_tags ON credentials USING GIN(tags);

-- ============================================
-- 6. CREDENTIAL SHARES (granular sharing)
-- ============================================
CREATE TABLE credential_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credential_id UUID REFERENCES credentials(id) ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    shared_by_user_id UUID REFERENCES users(id),
    permission VARCHAR(20) NOT NULL CHECK (permission IN ('read', 'write')),
    expires_at TIMESTAMP,                          -- Optional expiry
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(credential_id, shared_with_user_id)
);

-- ============================================
-- 7. AUDIT LOGS (tamper-evident, hash-chained)
-- ============================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Who
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(255),                       -- Denormalized (user might be deleted)
    user_role VARCHAR(50),
    
    -- What
    action VARCHAR(100) NOT NULL,                  -- e.g., 'credential.reveal', 'user.login'
    resource_type VARCHAR(50),                     -- e.g., 'credential', 'user', 'team'
    resource_id UUID,
    resource_name VARCHAR(255),                    -- Human-readable name
    
    -- Where
    ip_address INET,
    user_agent TEXT,
    
    -- Details (JSON, NO SECRETS!)
    metadata JSONB,
    
    -- Tamper evidence
    entry_hash VARCHAR(64) NOT NULL,               -- SHA-256 of (prev_hash + this_entry)
    previous_hash VARCHAR(64),                     -- NULL for first entry
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit queries
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);

-- ============================================
-- 8. PASSWORD RESET TOKENS
-- ============================================
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,               -- SHA-256 of token
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,                             -- NULL = still valid
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 9. REFRESH TOKENS (for session management)
-- ============================================
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,               -- SHA-256 of token
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,                          -- NULL = active
    ip_address INET,
    user_agent TEXT
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON folders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_credentials_updated_at BEFORE UPDATE ON credentials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();