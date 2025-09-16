-- =====================================================
-- Supabase Migration: Auth Tables
-- Generated from Prisma schema for videoprompt project
-- Priority: Critical (Auth functionality)
-- =====================================================

-- 1. User table - Core authentication entity
CREATE TABLE IF NOT EXISTS "User" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  role TEXT NOT NULL,
  avatar_url TEXT,
  preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RefreshToken table - JWT refresh token management
CREATE TABLE IF NOT EXISTS "RefreshToken" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  device_id TEXT,
  user_agent TEXT,
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EmailVerification table - Email verification flow
CREATE TABLE IF NOT EXISTS "EmailVerification" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  code TEXT,
  user_id UUID REFERENCES "User"(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PasswordReset table - Password reset flow
CREATE TABLE IF NOT EXISTS "PasswordReset" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes for Performance Optimization
-- =====================================================

-- User table indexes
CREATE INDEX IF NOT EXISTS idx_user_email ON "User"(email);
CREATE INDEX IF NOT EXISTS idx_user_username ON "User"(username);
CREATE INDEX IF NOT EXISTS idx_user_created_at ON "User"(created_at);

-- RefreshToken table indexes
CREATE INDEX IF NOT EXISTS idx_refresh_token_user ON "RefreshToken"(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token_token ON "RefreshToken"(token);
CREATE INDEX IF NOT EXISTS idx_refresh_token_expires ON "RefreshToken"(expires_at);

-- EmailVerification table indexes
CREATE INDEX IF NOT EXISTS idx_email_verification_email ON "EmailVerification"(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_token ON "EmailVerification"(token);

-- PasswordReset table indexes
CREATE INDEX IF NOT EXISTS idx_password_reset_email ON "PasswordReset"(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON "PasswordReset"(token);

-- =====================================================
-- Triggers for automatic updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_updated_at
    BEFORE UPDATE ON "User"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE "User" IS 'Core user authentication and profile data';
COMMENT ON TABLE "RefreshToken" IS 'JWT refresh tokens for session management';
COMMENT ON TABLE "EmailVerification" IS 'Email verification tokens and codes';
COMMENT ON TABLE "PasswordReset" IS 'Password reset tokens and tracking';

COMMENT ON COLUMN "User".email_verified IS 'Whether user email has been verified';
COMMENT ON COLUMN "User".role IS 'User role (admin, user, etc.)';
COMMENT ON COLUMN "User".preferences IS 'User settings and preferences in JSON format';
COMMENT ON COLUMN "RefreshToken".expires_at IS 'Token expiration timestamp';
COMMENT ON COLUMN "RefreshToken".revoked_at IS 'When token was revoked (if applicable)';
COMMENT ON COLUMN "RefreshToken".used_at IS 'When token was last used';