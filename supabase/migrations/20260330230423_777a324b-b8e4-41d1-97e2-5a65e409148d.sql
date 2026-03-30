
ALTER TABLE public.campanhas_agendadas ADD COLUMN IF NOT EXISTS base_url TEXT DEFAULT 'http://3.214.255.198:8085';
ALTER TABLE public.campanhas_agendadas ADD COLUMN IF NOT EXISTS empr_id TEXT;
