-- 0004_user_preferences : paramètres d'apparence et préférences de compte,
-- clés par empreinte SHA-256 de l'identifiant Kyros (isolation des utilisateurs).
-- L'insertion reste possible depuis les fichiers JSON historiques (repli lecture).
CREATE TABLE IF NOT EXISTS user_settings (
    owner_key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_preferences (
    owner_key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
