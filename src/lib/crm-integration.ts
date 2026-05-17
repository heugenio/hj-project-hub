// Integração CRM <-> Operação (OS / Pedidos / Faturamento)
// Localiza ou cria uma oportunidade no CRM a partir do cliente da operação,
// registra evento de timeline e move automaticamente para a etapa correta.
import { supabase } from "@/integrations/supabase/client";

type EventoOperacao =
  | "os_criada"
  | "os_finalizada"
  | "pedido_criado"
  | "pedido_faturado";

interface CrmAutoQualificarParams {
  empresa_id: string;
  unem_id?: string;
  usrs_id?: string;
  evento: EventoOperacao;
  cliente_id?: string | null;
  cliente_nome?: string | null;
  telefone?: string | null;
  valor?: number;
  documento_numero?: string;
  origem?: string; // "OS", "Pedido", "Faturamento"
}

const normalizaTelefone = (t?: string | null) =>
  (t || "").replace(/\D/g, "").replace(/^55/, "");

// Mapeia evento -> heurística de etapa (busca por nome contém)
const ETAPA_ALVO: Record<EventoOperacao, { tokens: string[]; ganho?: boolean }> = {
  os_criada: { tokens: ["negocia", "qualific"] },
  pedido_criado: { tokens: ["negocia", "orçament", "orcament"] },
  os_finalizada: { tokens: ["pós", "pos", "ganh"], ganho: true },
  pedido_faturado: { tokens: ["pós", "pos", "ganh"], ganho: true },
};

export async function crmAutoQualificar(p: CrmAutoQualificarParams) {
  try {
    if (!p.empresa_id) return;

    // Garante etapas padrão
    await supabase.rpc("crm_criar_etapas_padrao", { _empresa_id: p.empresa_id });

    // 1. Procura oportunidade existente por telefone OU cliente_id OU nome
    const telNorm = normalizaTelefone(p.telefone);
    let opp: any = null;
    if (telNorm) {
      const { data } = await supabase
        .from("crm_oportunidades")
        .select("*")
        .eq("empresa_id", p.empresa_id)
        .ilike("telefone", `%${telNorm.slice(-9)}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      opp = data;
    }
    if (!opp && p.cliente_id) {
      const { data } = await supabase
        .from("crm_oportunidades")
        .select("*")
        .eq("empresa_id", p.empresa_id)
        .eq("cliente_id", String(p.cliente_id))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      opp = data;
    }
    if (!opp && p.cliente_nome) {
      const { data } = await supabase
        .from("crm_oportunidades")
        .select("*")
        .eq("empresa_id", p.empresa_id)
        .ilike("cliente_nome", p.cliente_nome.trim())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      opp = data;
    }

    // 2. Carrega etapas
    const { data: etapas } = await supabase
      .from("crm_etapas")
      .select("*")
      .eq("empresa_id", p.empresa_id)
      .order("ordem", { ascending: true });
    const lista = etapas || [];
    const cfg = ETAPA_ALVO[p.evento];
    let etapaAlvo =
      (cfg.ganho ? lista.find((e: any) => e.is_ganho) : null) ||
      lista.find((e: any) =>
        cfg.tokens.some((tk) => (e.nome || "").toLowerCase().includes(tk))
      ) ||
      lista[0];

    // 3. Se não há oportunidade, cria nova
    if (!opp) {
      const { data: nova } = await supabase
        .from("crm_oportunidades")
        .insert({
          empresa_id: p.empresa_id,
          unem_id: p.unem_id || null,
          etapa_id: etapaAlvo?.id,
          cliente_id: p.cliente_id ? String(p.cliente_id) : null,
          cliente_nome: p.cliente_nome || null,
          telefone: telNorm || null,
          titulo: `${p.origem || "Operação"} ${p.documento_numero || ""} — ${p.cliente_nome || telNorm || "Cliente"}`.trim(),
          valor_estimado: Number(p.valor || 0),
          canal_origem: p.origem || "operacao",
          ultimo_contato_em: new Date().toISOString(),
          ganho: cfg.ganho ? true : null,
          fechada_em: cfg.ganho ? new Date().toISOString() : null,
          created_by: p.usrs_id || null,
        })
        .select("*")
        .single();
      opp = nova;
    } else {
      // 4. Atualiza oportunidade existente: move etapa, valor, ganho, último contato
      const patch: any = {
        ultimo_contato_em: new Date().toISOString(),
      };
      if (etapaAlvo?.id && etapaAlvo.id !== opp.etapa_id) patch.etapa_id = etapaAlvo.id;
      if (cfg.ganho) {
        patch.ganho = true;
        patch.fechada_em = new Date().toISOString();
      }
      if (p.valor && Number(p.valor) > Number(opp.valor_estimado || 0)) {
        patch.valor_estimado = Number(p.valor);
      }
      if (!opp.cliente_id && p.cliente_id) patch.cliente_id = String(p.cliente_id);
      if (!opp.telefone && telNorm) patch.telefone = telNorm;
      await supabase.from("crm_oportunidades").update(patch).eq("id", opp.id);
    }

    // 5. Registra evento na timeline
    const titulos: Record<EventoOperacao, string> = {
      os_criada: `OS ${p.documento_numero || ""} criada`,
      os_finalizada: `OS ${p.documento_numero || ""} finalizada`,
      pedido_criado: `Pedido ${p.documento_numero || ""} criado`,
      pedido_faturado: `Pedido ${p.documento_numero || ""} faturado`,
    };
    const tipoTimeline =
      p.evento === "pedido_faturado" || p.evento === "os_finalizada"
        ? "pedido"
        : "nota";
    if (opp?.id) {
      await supabase.rpc("crm_registrar_evento", {
        _empresa_id: p.empresa_id,
        _oportunidade_id: opp.id,
        _tipo: tipoTimeline as any,
        _titulo: titulos[p.evento].trim(),
        _descricao: `Valor: R$ ${Number(p.valor || 0).toFixed(2)}`,
        _dados: {
          documento: p.documento_numero,
          valor: p.valor,
          origem: p.origem,
        },
        _user_id: p.usrs_id || null,
      });
    }
  } catch (err) {
    // Falha de integração nunca deve quebrar fluxo operacional
    console.warn("[crmAutoQualificar] erro silencioso:", err);
  }
}
