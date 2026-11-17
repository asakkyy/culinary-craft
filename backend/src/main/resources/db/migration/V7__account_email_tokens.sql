ALTER TABLE demo_users ADD COLUMN email_verified_at TIMESTAMPTZ;
-- Existing users must prove mailbox ownership. Only separately provisioned ADMIN is trusted.
UPDATE demo_users SET email_verified_at = CURRENT_TIMESTAMP WHERE role = 'ADMIN' AND status <> 'LEGACY';
CREATE TABLE account_email_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES demo_users(id) ON DELETE CASCADE,
    purpose VARCHAR(16) NOT NULL CHECK (purpose IN ('VERIFY', 'RESET')),
    email VARCHAR(254) NOT NULL,
    token_version BIGINT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE(user_id, purpose)
);
CREATE INDEX account_email_tokens_expiry ON account_email_tokens(expires_at);
