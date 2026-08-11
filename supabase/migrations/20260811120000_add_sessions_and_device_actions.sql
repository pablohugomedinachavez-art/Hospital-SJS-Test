-- Migration: add sessions and device_actions tables

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS device_actions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  session_id INTEGER,
  user_id INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Backfill: (optional) copy recent audit_logs into device_actions with NULL session_id
-- INSERT INTO device_actions (tenant_id, user_id, ip_address, action_type, entity_type, entity_id, details, created_at)
-- SELECT tenant_id, user_id, NULL, action, entity_type, entity_id, details, created_at FROM audit_logs WHERE created_at > now() - interval '30 days';
