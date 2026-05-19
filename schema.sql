CREATE TABLE IF NOT EXISTS audit_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  name TEXT NOT NULL,
  business TEXT NOT NULL,
  website TEXT,
  phone TEXT,
  industry TEXT,
  issue TEXT,
  message TEXT,
  source TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_requests_created_at ON audit_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_requests_industry ON audit_requests(industry);
