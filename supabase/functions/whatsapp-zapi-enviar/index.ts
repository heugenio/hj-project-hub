// Envia mensagem via Z-API e registra em whatsapp_mensagens
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { empresa_id, conversa_id, texto, gerada_por_ia, enviada_por } = body ?? {};
    if (!empresa_id || !conversa_id || !texto) {
      return new Response(JSON.stringify({ ok: false, error: "missing params" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const { data: cfg, error: cfgErr } = await supabase
      .from("whatsapp_configuracoes")
      .select("instance_id, token_api, client_token, ativo")
      .eq("empresa_id", empresa_id)
      .maybeSingle();
    if (cfgErr || !cfg) return new Response(JSON.stringify({ ok: false, error: "config not found" }), { status: 404, headers: { ...corsHeaders, "content-type": "application/json" } });
    if (!cfg.ativo) return new Response(JSON.stringify({ ok: false, error: "whatsapp disabled" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });

    const { data: conv } = await supabase
      .from("whatsapp_conversas")
      .select("telefone")
      .eq("id", conversa_id)
      .maybeSingle();
    if (!conv?.telefone) return new Response(JSON.stringify({ ok: false, error: "conversation not found" }), { status: 404, headers: { ...corsHeaders, "content-type": "application/json" } });

    const url = `https://api.z-api.io/instances/${cfg.instance_id}/token/${cfg.token_api}/send-text`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": cfg.client_token ?? "",
      },
      body: JSON.stringify({ phone: conv.telefone, message: texto }),
    });
    const respText = await resp.text();
    let respJson: any = null;
    try { respJson = JSON.parse(respText); } catch { respJson = { raw: respText }; }

    if (!resp.ok) {
      return new Response(JSON.stringify({ ok: false, error: respJson?.error ?? respText, status: resp.status }), { status: 502, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const external_id = respJson?.messageId ?? respJson?.id ?? null;
    const { data: msg, error: insErr } = await supabase
      .from("whatsapp_mensagens")
      .insert({
        empresa_id,
        conversa_id,
        direcao: "enviada",
        tipo: "texto",
        conteudo: texto,
        status: "enviada",
        external_id,
        gerada_por_ia: !!gerada_por_ia,
        enviada_por: enviada_por ?? null,
      })
      .select("*")
      .single();
    if (insErr) return new Response(JSON.stringify({ ok: false, error: insErr.message }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });

    return new Response(JSON.stringify({ ok: true, mensagem: msg, zapi: respJson }), { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
