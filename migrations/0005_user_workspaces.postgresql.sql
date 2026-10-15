-- 0005_user_workspaces : espaces de travail nommés (bureaux persistants).
-- Un seul espace actif par utilisateur ; la disposition courante vit dans
-- window_sessions et est copiée dans l'espace actif lors des bascules.
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    owner_key TEXT NOT NULL,
    name TEXT NOT NULL,
    windows_json TEXT NOT NULL DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces (owner_key);
