ALTER TABLE public.whatsapp_ia_config
  ADD COLUMN IF NOT EXISTS ramo_atividade text,
  ADD COLUMN IF NOT EXISTS especialidade text;