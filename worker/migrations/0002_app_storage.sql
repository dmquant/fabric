PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS app_storage_logs (
  id TEXT PRIMARY KEY,
  app_name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_app_storage_logs_app ON app_storage_logs (app_name, created_at DESC);

CREATE TABLE IF NOT EXISTS app_storage_objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  size INTEGER NOT NULL,
  checksum TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(app_name, filename)
);

CREATE INDEX IF NOT EXISTS idx_app_storage_objects_app ON app_storage_objects (app_name, filename);
