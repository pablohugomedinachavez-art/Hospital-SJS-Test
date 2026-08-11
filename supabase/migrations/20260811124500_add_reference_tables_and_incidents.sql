-- Migration: add reference tables (document_types, blood_types, country_codes, file_types) and incidents

CREATE TABLE IF NOT EXISTS document_types (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blood_types (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS country_codes (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_types (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  user_id INTEGER,
  incident_type TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Seed some common values from the frontend
INSERT INTO document_types (code, display_name) VALUES
  ('dni', 'DNI'),
  ('ce', 'Carnet de Extranjería')
ON CONFLICT (code) DO NOTHING;

INSERT INTO blood_types (code, display_name) VALUES
  ('A+', 'A+'),('A-','A-'),('B+','B+'),('B-','B-'),('AB+','AB+'),('AB-','AB-'),('O+','O+'),('O-','O-')
ON CONFLICT (code) DO NOTHING;

INSERT INTO country_codes (code, display_name) VALUES
  ('+51','Perú'),
  ('+52','México'),
  ('+54','Argentina'),
  ('+57','Colombia'),
  ('+1','Estados Unidos')
ON CONFLICT (code) DO NOTHING;

-- Example file types
INSERT INTO file_types (code, display_name) VALUES
  ('pdf','PDF Document'),
  ('jpg','JPEG Image'),
  ('png','PNG Image'),
  ('docx','Word Document')
ON CONFLICT (code) DO NOTHING;
