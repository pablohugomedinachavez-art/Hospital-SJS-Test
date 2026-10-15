ALTER TABLE public.consultations
ADD COLUMN IF NOT EXISTS priority character varying(16) NOT NULL DEFAULT 'Media'
CHECK (priority IN ('Baja', 'Media', 'Alta', 'Urgente'));
