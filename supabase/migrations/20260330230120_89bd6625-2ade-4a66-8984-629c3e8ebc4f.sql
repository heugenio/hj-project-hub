
-- Table for scheduled/recurring campaigns
CREATE TABLE public.campanhas_agendadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'RODIZIO',
  canal TEXT NOT NULL DEFAULT 'whatsapp',
  recorrencia TEXT NOT NULL DEFAULT 'semanal',
  dia_semana INTEGER DEFAULT 1,
  horario TIME DEFAULT '09:00:00',
  mensagem TEXT NOT NULL DEFAULT '',
  imagem_url TEXT,
  filtro_grupo TEXT,
  filtro_produto TEXT,
  filtro_unem_id TEXT,
  todas_unidades BOOLEAN DEFAULT true,
  ativo BOOLEAN DEFAULT true,
  ultima_execucao TIMESTAMPTZ,
  proxima_execucao TIMESTAMPTZ,
  total_enviados INTEGER DEFAULT 0,
  total_erros INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- No RLS since this is an internal system table accessed via service role
ALTER TABLE public.campanhas_agendadas ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to manage campaigns
CREATE POLICY "Authenticated users can manage campaigns"
  ON public.campanhas_agendadas
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
