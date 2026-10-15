-- 0001_auth_sessions : sessions Express/Kyros persistées (magasin de session).
CREATE TABLE IF NOT EXISTS auth_sessions (
    sid TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires BIGINT
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires);
