
-- =====================================================
-- ENUMS
-- =====================================================
DO $$ BEGIN CREATE TYPE public.whatsapp_provedor AS ENUM ('zapi','evolution','meta_cloud','apibrasil'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.whatsapp_msg_direcao AS ENUM ('recebida','enviada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.whatsapp_msg_tipo AS ENUM ('texto','imagem','audio','video','documento','localizacao','contato','sticker','sistema'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.whatsapp_msg_status AS ENUM ('pendente','enviada','entregue','lida','falha'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.whatsapp_conversa_status AS ENUM ('aberta','arquivada','resolvida'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.crm_timeline_tipo AS ENUM ('mensagem','ligacao','tarefa','nota','etapa','orcamento','pedido','cobranca','sistema'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- HELPER: touch_updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- =====================================================
-- CRM ETAPAS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.crm_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id text NOT NULL,
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  cor text NOT NULL DEFAULT '#1E5BAA',
  is_ganho boolean NOT NULL DEFAULT false,
  is_perdido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_etapas_empresa ON public.crm_etapas (empresa_id, ordem);
ALTER TABLE public.crm_etapas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all crm_etapas" ON public.crm_etapas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- CRM OPORTUNIDADES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.crm_oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id text NOT NULL,
  unem_id text,
  etapa_id uuid NOT NULL REFERENCES public.crm_etapas(id) ON DELETE RESTRICT,
  cliente_id text,
  cliente_nome text,
  vendedor_id text,
  vendedor_nome text,
  titulo text NOT NULL,
  descricao text,
  telefone text,
  conversa_id uuid,
  canal_origem text,
  foto_lead_url text,
  nome_whatsapp text,
  valor_estimado numeric(14,2) NOT NULL DEFAULT 0,
  probabilidade int NOT NULL DEFAULT 50 CHECK (probabilidade BETWEEN 0 AND 100),
  origem text,
  data_prevista date,
  ordem int NOT NULL DEFAULT 0,
  ganho boolean,
  motivo_perda text,
  ultimo_contato_em timestamptz,
  fechada_em timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_op_empresa_etapa ON public.crm_oportunidades (empresa_id, etapa_id, ordem);
CREATE INDEX IF NOT EXISTS idx_crm_op_telefone ON public.crm_oportunidades (empresa_id, telefone);
CREATE INDEX IF NOT EXISTS idx_crm_op_conversa ON public.crm_oportunidades (conversa_id);
ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all crm_oportunidades" ON public.crm_oportunidades FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_crm_op_touch BEFORE UPDATE ON public.crm_oportunidades
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================
-- CRM TIMELINE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.crm_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id text NOT NULL,
  oportunidade_id uuid NOT NULL REFERENCES public.crm_oportunidades(id) ON DELETE CASCADE,
  tipo crm_timeline_tipo NOT NULL,
  titulo text NOT NULL,
  descricao text,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id text,
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_timeline_op ON public.crm_timeline (oportunidade_id, ocorrido_em DESC);
ALTER TABLE public.crm_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all crm_timeline" ON public.crm_timeline FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- WHATSAPP CONFIGURACOES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id text NOT NULL UNIQUE,
  provedor whatsapp_provedor NOT NULL DEFAULT 'zapi',
  instance_id text,
  token_api text,
  client_token text,
  numero_whatsapp text,
  webhook_secret text NOT NULL DEFAULT encode(gen_random_bytes(24),'hex'),
  webhook_path text NOT NULL DEFAULT encode(gen_random_bytes(8),'hex'),
  ativo boolean NOT NULL DEFAULT false,
  configuracoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all whatsapp_configuracoes" ON public.whatsapp_configuracoes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_wa_config_touch BEFORE UPDATE ON public.whatsapp_configuracoes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================
-- WHATSAPP CONVERSAS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id text NOT NULL,
  telefone text NOT NULL,
  nome_contato text,
  foto_url text,
  cliente_id text,
  oportunidade_id uuid REFERENCES public.crm_oportunidades(id) ON DELETE SET NULL,
  vendedor_id text,
  status whatsapp_conversa_status NOT NULL DEFAULT 'aberta',
  ultima_mensagem text,
  ultima_mensagem_em timestamptz,
  ultima_direcao whatsapp_msg_direcao,
  nao_lidas integer NOT NULL DEFAULT 0,
  ia_ativa boolean NOT NULL DEFAULT true,
  ia_pausada_em timestamptz,
  ia_pausada_por text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, telefone)
);
CREATE INDEX IF NOT EXISTS idx_wa_conv_empresa ON public.whatsapp_conversas (empresa_id, status, ultima_mensagem_em DESC);
ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all whatsapp_conversas" ON public.whatsapp_conversas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_wa_conv_touch BEFORE UPDATE ON public.whatsapp_conversas
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================
-- WHATSAPP MENSAGENS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id text NOT NULL,
  conversa_id uuid NOT NULL REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  direcao whatsapp_msg_direcao NOT NULL,
  tipo whatsapp_msg_tipo NOT NULL DEFAULT 'texto',
  conteudo text,
  midia_url text,
  midia_mime text,
  midia_nome text,
  status whatsapp_msg_status NOT NULL DEFAULT 'enviada',
  external_id text,
  reply_to_id uuid,
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  gerada_por_ia boolean NOT NULL DEFAULT false,
  enviada_em timestamptz NOT NULL DEFAULT now(),
  enviada_por text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_msg_conv ON public.whatsapp_mensagens (conversa_id, enviada_em DESC);
CREATE INDEX IF NOT EXISTS idx_wa_msg_external ON public.whatsapp_mensagens (empresa_id, external_id);
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all whatsapp_mensagens" ON public.whatsapp_mensagens FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- WHATSAPP IA CONFIG
-- =====================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_ia_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT false,
  modelo text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  temperatura numeric NOT NULL DEFAULT 0.7,
  max_tokens integer NOT NULL DEFAULT 400,
  personalidade text DEFAULT 'Você é um vendedor virtual cordial, humano, objetivo e prestativo.',
  prompt_personalizado text,
  saudacao text DEFAULT 'Olá 👋 Seja muito bem-vindo(a)! Como posso ajudar você hoje?',
  horario_inicio time,
  horario_fim time,
  dias_semana int[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  mensagem_ausencia text DEFAULT 'Olá! No momento estamos fora do horário de atendimento. Retornaremos assim que possível.',
  mensagem_pos_orcamento text,
  mensagem_pos_venda text,
  enviar_foto_produto boolean NOT NULL DEFAULT true,
  enviar_preco_produto boolean NOT NULL DEFAULT true,
  pausar_quando_humano_responder boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_ia_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all whatsapp_ia_config" ON public.whatsapp_ia_config FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_wa_ia_touch BEFORE UPDATE ON public.whatsapp_ia_config
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================
-- FK whatsapp_conversas <-> crm_oportunidades (conversa_id)
-- (já criada inline; FK reversa em oportunidade.conversa_id sem REFERENCES para evitar dependência circular)
-- =====================================================

-- =====================================================
-- FUNCAO: criar_etapas_padrao
-- =====================================================
CREATE OR REPLACE FUNCTION public.crm_criar_etapas_padrao(_empresa_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM crm_etapas WHERE empresa_id = _empresa_id) THEN RETURN; END IF;
  INSERT INTO public.crm_etapas (empresa_id, nome, ordem, cor, is_ganho, is_perdido) VALUES
    (_empresa_id, 'Novo Lead', 1, '#64748B', false, false),
    (_empresa_id, 'Primeiro Atendimento', 2, '#0EA5E9', false, false),
    (_empresa_id, 'Qualificação', 3, '#1E5BAA', false, false),
    (_empresa_id, 'Orçamento Enviado', 4, '#F59E0B', false, false),
    (_empresa_id, 'Negociação', 5, '#A855F7', false, false),
    (_empresa_id, 'Aguardando Retorno', 6, '#EAB308', false, false),
    (_empresa_id, 'Venda Ganha', 7, '#10B981', true, false),
    (_empresa_id, 'Venda Perdida', 8, '#EF4444', false, true),
    (_empresa_id, 'Pós-venda', 9, '#0E2A47', false, false);
END $$;

-- =====================================================
-- FUNCAO: registrar evento timeline
-- =====================================================
CREATE OR REPLACE FUNCTION public.crm_registrar_evento(
  _empresa_id text, _oportunidade_id uuid, _tipo crm_timeline_tipo,
  _titulo text, _descricao text DEFAULT NULL, _dados jsonb DEFAULT '{}'::jsonb,
  _user_id text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.crm_timeline (empresa_id, oportunidade_id, tipo, titulo, descricao, dados, user_id)
  VALUES (_empresa_id, _oportunidade_id, _tipo, _titulo, _descricao, COALESCE(_dados,'{}'::jsonb), _user_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- =====================================================
-- TRIGGER: oportunidade mudou de etapa -> timeline
-- =====================================================
CREATE OR REPLACE FUNCTION public.crm_op_etapa_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_etapa_nome text;
BEGIN
  IF TG_OP='INSERT' OR NEW.etapa_id IS DISTINCT FROM OLD.etapa_id THEN
    SELECT nome INTO v_etapa_nome FROM crm_etapas WHERE id = NEW.etapa_id;
    PERFORM crm_registrar_evento(NEW.empresa_id, NEW.id, 'etapa'::crm_timeline_tipo,
      COALESCE('Movido para: '||v_etapa_nome, 'Etapa alterada'),
      NULL, jsonb_build_object('etapa_id', NEW.etapa_id, 'etapa_nome', v_etapa_nome), NEW.created_by);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_crm_op_etapa ON public.crm_oportunidades;
CREATE TRIGGER trg_crm_op_etapa AFTER INSERT OR UPDATE OF etapa_id ON public.crm_oportunidades
FOR EACH ROW EXECUTE FUNCTION public.crm_op_etapa_changed();

-- =====================================================
-- TRIGGER: nova mensagem -> timeline + atualiza conversa
-- =====================================================
CREATE OR REPLACE FUNCTION public.wa_msg_to_timeline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_op_id uuid; v_titulo text;
BEGIN
  SELECT oportunidade_id INTO v_op_id FROM whatsapp_conversas WHERE id = NEW.conversa_id;
  IF v_op_id IS NOT NULL THEN
    v_titulo := CASE NEW.direcao
      WHEN 'recebida' THEN 'Mensagem recebida (WhatsApp)'
      ELSE 'Mensagem enviada (WhatsApp)' END;
    PERFORM crm_registrar_evento(NEW.empresa_id, v_op_id, 'mensagem'::crm_timeline_tipo, v_titulo,
      LEFT(COALESCE(NEW.conteudo, NEW.tipo::text), 240),
      jsonb_build_object('mensagem_id', NEW.id, 'tipo', NEW.tipo, 'direcao', NEW.direcao, 'ia', NEW.gerada_por_ia),
      NEW.enviada_por);
  END IF;
  UPDATE whatsapp_conversas SET
    ultima_mensagem = LEFT(COALESCE(NEW.conteudo, NEW.tipo::text), 200),
    ultima_mensagem_em = NEW.enviada_em,
    ultima_direcao = NEW.direcao,
    nao_lidas = CASE WHEN NEW.direcao='recebida' THEN nao_lidas + 1 ELSE nao_lidas END
  WHERE id = NEW.conversa_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wa_msg_timeline ON public.whatsapp_mensagens;
CREATE TRIGGER trg_wa_msg_timeline AFTER INSERT ON public.whatsapp_mensagens
FOR EACH ROW EXECUTE FUNCTION public.wa_msg_to_timeline();

-- =====================================================
-- FUNCAO: processar mensagem recebida (cria lead/conversa/op)
-- =====================================================
CREATE OR REPLACE FUNCTION public.whatsapp_processar_mensagem_recebida(
  _empresa_id text,
  _telefone text,
  _nome_contato text,
  _foto_url text,
  _conteudo text,
  _tipo whatsapp_msg_tipo,
  _midia_url text,
  _midia_mime text,
  _external_id text,
  _enviada_em timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_conv_id uuid;
  v_op_id uuid;
  v_etapa_id uuid;
  v_msg_id uuid;
  v_criou_lead boolean := false;
BEGIN
  PERFORM crm_criar_etapas_padrao(_empresa_id);

  SELECT id, oportunidade_id INTO v_conv_id, v_op_id
    FROM whatsapp_conversas WHERE empresa_id = _empresa_id AND telefone = _telefone;

  IF v_conv_id IS NULL THEN
    SELECT id INTO v_etapa_id FROM crm_etapas
      WHERE empresa_id = _empresa_id ORDER BY ordem ASC LIMIT 1;

    INSERT INTO crm_oportunidades (empresa_id, etapa_id, titulo, valor_estimado,
      telefone, canal_origem, foto_lead_url, nome_whatsapp, cliente_nome,
      ultimo_contato_em, ordem)
    VALUES (_empresa_id, v_etapa_id,
      'Lead WhatsApp: '||COALESCE(_nome_contato, _telefone),
      0, _telefone, 'whatsapp', _foto_url, _nome_contato, _nome_contato, _enviada_em, 0)
    RETURNING id INTO v_op_id;
    v_criou_lead := true;

    INSERT INTO whatsapp_conversas (empresa_id, telefone, nome_contato, foto_url,
      oportunidade_id, status)
    VALUES (_empresa_id, _telefone, _nome_contato, _foto_url, v_op_id, 'aberta')
    RETURNING id INTO v_conv_id;

    UPDATE crm_oportunidades SET conversa_id = v_conv_id WHERE id = v_op_id;
  ELSE
    UPDATE whatsapp_conversas SET
      nome_contato = COALESCE(nome_contato, _nome_contato),
      foto_url = COALESCE(foto_url, _foto_url),
      status = 'aberta'
    WHERE id = v_conv_id;
  END IF;

  IF _external_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM whatsapp_mensagens
    WHERE empresa_id = _empresa_id AND external_id = _external_id
  ) THEN
    SELECT id INTO v_msg_id FROM whatsapp_mensagens
      WHERE empresa_id = _empresa_id AND external_id = _external_id LIMIT 1;
  ELSE
    INSERT INTO whatsapp_mensagens (empresa_id, conversa_id, direcao, tipo,
      conteudo, midia_url, midia_mime, status, external_id, enviada_em)
    VALUES (_empresa_id, v_conv_id, 'recebida'::whatsapp_msg_direcao, _tipo,
      _conteudo, _midia_url, _midia_mime, 'entregue'::whatsapp_msg_status, _external_id, COALESCE(_enviada_em, now()))
    RETURNING id INTO v_msg_id;
  END IF;

  IF v_op_id IS NOT NULL THEN
    UPDATE crm_oportunidades SET ultimo_contato_em = COALESCE(_enviada_em, now())
    WHERE id = v_op_id;
  END IF;

  RETURN jsonb_build_object(
    'conversa_id', v_conv_id,
    'oportunidade_id', v_op_id,
    'mensagem_id', v_msg_id,
    'criou_lead', v_criou_lead
  );
END $$;

-- =====================================================
-- REALTIME
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_timeline;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_oportunidades;
