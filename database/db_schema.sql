-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.tenants (
  id integer NOT NULL DEFAULT nextval('tenants_id_seq'::regclass),
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tenants_pkey PRIMARY KEY (id)
);
CREATE TABLE public.roles (
  id integer NOT NULL DEFAULT nextval('roles_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  display_name text,
  description text,
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.permissions (
  id integer NOT NULL DEFAULT nextval('permissions_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  description text,
  CONSTRAINT permissions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.role_permissions (
  role_id integer NOT NULL,
  permission_id integer NOT NULL,
  CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id),
  CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id)
);
CREATE TABLE public.users (
  id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  role text NOT NULL DEFAULT 'viewer'::text,
  tenant_id integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.locations (
  id integer NOT NULL DEFAULT nextval('locations_id_seq'::regclass),
  tenant_id integer NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT locations_pkey PRIMARY KEY (id),
  CONSTRAINT locations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.devices (
  id integer NOT NULL DEFAULT nextval('devices_id_seq'::regclass),
  tenant_id integer NOT NULL,
  location_id integer,
  name text NOT NULL,
  type text,
  status text NOT NULL DEFAULT 'available'::text,
  created_at timestamp with time zone NOT NULL,
  ip_address text,
  user_agent text,
  serial_number text,
  mac_address text,
  os_version text,
  last_heartbeat timestamp with time zone,
  CONSTRAINT devices_pkey PRIMARY KEY (id),
  CONSTRAINT devices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT devices_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id)
);
CREATE TABLE public.alerts (
  id integer NOT NULL DEFAULT nextval('alerts_id_seq'::regclass),
  tenant_id integer NOT NULL,
  device_id integer NOT NULL,
  user_id integer,
  alert_type text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'medium'::text,
  is_resolved smallint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL,
  resolved_at timestamp with time zone,
  metric_id integer,
  resolved_by integer,
  resolution_notes text,
  CONSTRAINT alerts_pkey PRIMARY KEY (id),
  CONSTRAINT alerts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT alerts_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id),
  CONSTRAINT alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT alerts_metric_id_fkey FOREIGN KEY (metric_id) REFERENCES public.metrics(id),
  CONSTRAINT alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id)
);
CREATE TABLE public.metrics (
  id integer NOT NULL DEFAULT nextval('metrics_id_seq'::regclass),
  tenant_id integer NOT NULL,
  device_id integer NOT NULL,
  metric_type text NOT NULL,
  value real NOT NULL,
  unit text,
  recorded_at timestamp with time zone NOT NULL,
  component_name text,
  metric_key text NOT NULL DEFAULT 'value'::text,
  CONSTRAINT metrics_pkey PRIMARY KEY (id),
  CONSTRAINT metrics_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT metrics_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id)
);
CREATE TABLE public.error_reports (
  id integer NOT NULL DEFAULT nextval('error_reports_id_seq'::regclass),
  tenant_id integer,
  user_id integer,
  context text,
  error_message text,
  error_code text,
  payload text,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT error_reports_pkey PRIMARY KEY (id),
  CONSTRAINT error_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT error_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.patients (
  id integer NOT NULL DEFAULT nextval('patients_id_seq'::regclass),
  tenant_id integer NOT NULL,
  full_name text NOT NULL,
  dni text NOT NULL,
  date_of_birth date,
  phone text,
  email text,
  sex text,
  blood_type text,
  allergies text,
  status text NOT NULL DEFAULT 'active'::text,
  medical_record_number text,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT patients_pkey PRIMARY KEY (id),
  CONSTRAINT patients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.medical_records (
  id integer NOT NULL DEFAULT nextval('medical_records_id_seq'::regclass),
  tenant_id integer NOT NULL,
  patient_id integer NOT NULL,
  record_type text NOT NULL,
  summary text NOT NULL,
  details text,
  created_by integer,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT medical_records_pkey PRIMARY KEY (id),
  CONSTRAINT medical_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT medical_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id),
  CONSTRAINT medical_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.consultations (
  id integer NOT NULL DEFAULT nextval('consultations_id_seq'::regclass),
  tenant_id integer NOT NULL,
  patient_id integer NOT NULL,
  doctor_name text NOT NULL,
  reason text NOT NULL,
  symptoms text,
  diagnosis text,
  treatment text,
  prescription text,
  created_at timestamp with time zone NOT NULL,
  triage_id bigint,
  CONSTRAINT consultations_pkey PRIMARY KEY (id),
  CONSTRAINT consultations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT consultations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id),
  CONSTRAINT fk_consultations_triage FOREIGN KEY (triage_id) REFERENCES public.triages(id)
);
CREATE TABLE public.appointments (
  id integer NOT NULL DEFAULT nextval('appointments_id_seq'::regclass),
  tenant_id integer NOT NULL,
  patient_id integer NOT NULL,
  doctor_name text NOT NULL,
  specialty text NOT NULL,
  appointment_date timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'::text,
  notes text,
  created_at timestamp with time zone NOT NULL,
  end_time text,
  priority character varying DEFAULT 'Media'::character varying CHECK (priority::text = ANY (ARRAY['Baja'::character varying, 'Media'::character varying, 'Alta'::character varying, 'Urgente'::character varying]::text[])),
  CONSTRAINT appointments_pkey PRIMARY KEY (id),
  CONSTRAINT appointments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id)
);
CREATE TABLE public.documents (
  id integer NOT NULL DEFAULT nextval('documents_id_seq'::regclass),
  tenant_id integer NOT NULL,
  patient_id integer NOT NULL,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_url text,
  description text,
  status text NOT NULL DEFAULT 'uploaded'::text,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT documents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id)
);
CREATE TABLE public.audit_logs (
  id integer NOT NULL DEFAULT nextval('audit_logs_id_seq'::regclass),
  tenant_id integer NOT NULL,
  user_id integer,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id integer,
  details text,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.sessions (
  id integer NOT NULL DEFAULT nextval('sessions_id_seq'::regclass),
  tenant_id integer NOT NULL,
  user_id integer NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL,
  last_seen timestamp with time zone,
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.device_actions (
  id integer NOT NULL DEFAULT nextval('device_actions_id_seq'::regclass),
  tenant_id integer NOT NULL,
  session_id integer,
  user_id integer,
  ip_address text,
  user_agent text,
  action_type text NOT NULL,
  entity_type text,
  entity_id integer,
  details text,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT device_actions_pkey PRIMARY KEY (id),
  CONSTRAINT device_actions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT device_actions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id),
  CONSTRAINT device_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.document_types (
  id integer NOT NULL DEFAULT nextval('document_types_id_seq'::regclass),
  code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  CONSTRAINT document_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.blood_types (
  id integer NOT NULL DEFAULT nextval('blood_types_id_seq'::regclass),
  code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  CONSTRAINT blood_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.country_codes (
  id integer NOT NULL DEFAULT nextval('country_codes_id_seq'::regclass),
  code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  CONSTRAINT country_codes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.file_types (
  id integer NOT NULL DEFAULT nextval('file_types_id_seq'::regclass),
  code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  CONSTRAINT file_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.incidents (
  id integer NOT NULL DEFAULT nextval('incidents_id_seq'::regclass),
  tenant_id integer NOT NULL,
  user_id integer,
  incident_type text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open'::text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone,
  CONSTRAINT incidents_pkey PRIMARY KEY (id),
  CONSTRAINT incidents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT incidents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.triages (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  patient_id bigint NOT NULL,
  weight_kg numeric NOT NULL,
  height_cm numeric NOT NULL,
  blood_pressure character varying NOT NULL,
  bmi numeric NOT NULL,
  abdominal_perimeter_cm numeric,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tenant_id integer,
  CONSTRAINT triages_pkey PRIMARY KEY (id),
  CONSTRAINT triages_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id),
  CONSTRAINT triages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.templates_formulario (
  id integer NOT NULL DEFAULT nextval('templates_formulario_id_seq'::regclass),
  nombre text NOT NULL,
  version integer DEFAULT 1,
  estado text DEFAULT 'activo'::text,
  structure jsonb NOT NULL,
  creado_por text,
  fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  tenant_id integer,
  CONSTRAINT templates_formulario_pkey PRIMARY KEY (id),
  CONSTRAINT templates_formulario_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.formularios_paciente (
  id integer NOT NULL DEFAULT nextval('formularios_paciente_id_seq'::regclass),
  patient_id text NOT NULL,
  document_type text NOT NULL,
  template_id integer,
  dynamic_values jsonb NOT NULL,
  pdf_url text,
  fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  tenant_id integer NOT NULL,
  CONSTRAINT formularios_paciente_pkey PRIMARY KEY (id),
  CONSTRAINT formularios_paciente_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates_formulario(id),
  CONSTRAINT formularios_paciente_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.device_peripherals (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id integer NOT NULL,
  device_id integer NOT NULL,
  peripheral_name text NOT NULL,
  connection_interface text NOT NULL,
  vendor_id text,
  product_id text,
  status text NOT NULL DEFAULT 'connected'::text,
  last_connected_at timestamp with time zone,
  last_disconnected_at timestamp with time zone,
  CONSTRAINT device_peripherals_pkey PRIMARY KEY (id),
  CONSTRAINT device_peripherals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT device_peripherals_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id)
);
CREATE TABLE public.peripheral_events (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id integer NOT NULL,
  device_id integer NOT NULL,
  peripheral_id integer NOT NULL,
  event_type text NOT NULL,
  details text,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT peripheral_events_pkey PRIMARY KEY (id),
  CONSTRAINT peripheral_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT peripheral_events_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id),
  CONSTRAINT peripheral_events_peripheral_id_fkey FOREIGN KEY (peripheral_id) REFERENCES public.device_peripherals(id)
);
CREATE TABLE public.device_storage_health (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id integer NOT NULL,
  device_id integer NOT NULL,
  drive_letter text NOT NULL,
  total_space_gb numeric NOT NULL,
  free_space_gb numeric NOT NULL,
  smart_status text DEFAULT 'PASSED'::text,
  wear_level_pct numeric,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT device_storage_health_pkey PRIMARY KEY (id),
  CONSTRAINT device_storage_health_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT device_storage_health_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id)
);
CREATE TABLE public.alert_rules (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id integer NOT NULL,
  rule_name text NOT NULL,
  metric_type text NOT NULL,
  condition_operator text NOT NULL,
  threshold_value real NOT NULL,
  severity text NOT NULL DEFAULT 'high'::text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT alert_rules_pkey PRIMARY KEY (id),
  CONSTRAINT alert_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.messages (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  sender_id text NOT NULL,
  content text NOT NULL,
  room_id text NOT NULL DEFAULT 'general'::text,
  status text DEFAULT 'sent'::text,
  CONSTRAINT messages_pkey PRIMARY KEY (id)
);
CREATE TABLE public.chat_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id integer NOT NULL,
  name text,
  is_group boolean DEFAULT false,
  created_by integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_rooms_pkey PRIMARY KEY (id),
  CONSTRAINT chat_rooms_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.chat_participants (
  id integer NOT NULL DEFAULT nextval('chat_participants_id_seq'::regclass),
  room_id uuid,
  user_id integer,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_participants_pkey PRIMARY KEY (id),
  CONSTRAINT chat_participants_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id),
  CONSTRAINT chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid,
  sender_id integer,
  sender_name text NOT NULL,
  content text,
  attachment_url text,
  attachment_type text,
  status text DEFAULT 'sent'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id),
  CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_presence (
  user_id integer NOT NULL,
  status text DEFAULT 'offline'::text,
  last_seen timestamp with time zone DEFAULT now(),
  CONSTRAINT user_presence_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_presence_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);