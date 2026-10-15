-- 0003_document_items : métadonnées de l'arborescence Documents.
-- Les fichiers physiques restent sur disque (storage/documents/<owner>/<uuid>).
CREATE TABLE IF NOT EXISTS document_items (
    id TEXT PRIMARY KEY,
    owner_key TEXT NOT NULL,
    parent_id TEXT REFERENCES document_items(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('file', 'folder')),
    name TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER NOT NULL DEFAULT 0 CHECK (size >= 0),
    storage_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    trashed_at TEXT,
    trash_root_id TEXT
);
CREATE INDEX IF NOT EXISTS document_items_owner_parent ON document_items(owner_key, parent_id, trashed_at);
CREATE INDEX IF NOT EXISTS document_items_owner_trash ON document_items(owner_key, trash_root_id, trashed_at);
