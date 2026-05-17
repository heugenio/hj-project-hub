import { supabase } from "@/integrations/supabase/client";

export async function ensureEtapasPadrao(empresa_id: string) {
  if (!empresa_id) return;
  const { data } = await supabase.from("crm_etapas").select("id").eq("empresa_id", empresa_id).limit(1);
  if (data && data.length > 0) return;
  await supabase.rpc("crm_criar_etapas_padrao", { _empresa_id: empresa_id });
}

export async function enviarMensagemWhatsapp(params: { empresa_id: string; conversa_id: string; texto: string; enviada_por?: string; }) {
  const { data, error } = await supabase.functions.invoke("whatsapp-zapi-enviar", { body: params });
  if (error) throw error;
  return data;
}

export async function sugerirRespostaIA(params: { empresa_id: string; conversa_id: string; }) {
  const { data, error } = await supabase.functions.invoke("whatsapp-ia-sugerir", { body: params });
  if (error) throw error;
  return data as { ok: boolean; sugestoes?: string[]; error?: string };
}

export async function toggleIAConversa(conversa_id: string, ia_ativa: boolean, by?: string) {
  return supabase.from("whatsapp_conversas").update({
    ia_ativa,
    ia_pausada_em: ia_ativa ? null : new Date().toISOString(),
    ia_pausada_por: ia_ativa ? null : (by ?? null),
  }).eq("id", conversa_id);
}
