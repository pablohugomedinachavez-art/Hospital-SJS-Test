ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS user_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'devices_user_id_fkey'
      AND conrelid = 'public.devices'::regclass
  ) THEN
    ALTER TABLE public.devices
    ADD CONSTRAINT devices_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS devices_user_id_idx ON public.devices(user_id);
