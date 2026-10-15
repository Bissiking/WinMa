-- 0002_window_sessions : disposition des fenêtres par utilisateur Kyros.
CREATE TABLE IF NOT EXISTS window_sessions (
    owner_key TEXT PRIMARY KEY,
    windows_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
