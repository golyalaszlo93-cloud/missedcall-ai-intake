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

CREATE TABLE IF NOT EXISTS missed_call_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  provider TEXT NOT NULL,
  business TEXT,
  from_phone TEXT NOT NULL,
  to_phone TEXT,
  call_status TEXT,
  service_type TEXT,
  raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_missed_call_events_created_at ON missed_call_events(created_at);
CREATE INDEX IF NOT EXISTS idx_missed_call_events_from_phone ON missed_call_events(from_phone);

CREATE TABLE IF NOT EXISTS customer_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  business_context TEXT,
  last_service TEXT,
  preferences TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone ON customer_profiles(phone);

CREATE TABLE IF NOT EXISTS follow_up_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  audit_request_id INTEGER,
  missed_call_event_id INTEGER,
  phone TEXT,
  channel TEXT NOT NULL DEFAULT 'sms',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_due_at ON follow_up_tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_status ON follow_up_tasks(status);

CREATE TABLE IF NOT EXISTS sms_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  provider TEXT NOT NULL,
  direction TEXT NOT NULL,
  from_phone TEXT,
  to_phone TEXT,
  body TEXT,
  provider_message_id TEXT,
  status TEXT,
  raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at ON sms_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_sms_messages_from_phone ON sms_messages(from_phone);
CREATE INDEX IF NOT EXISTS idx_sms_messages_direction ON sms_messages(direction);
