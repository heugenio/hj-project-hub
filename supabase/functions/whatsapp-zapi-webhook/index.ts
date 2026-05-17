// Z-API webhook receiver. URL pattern: /whatsapp-zapi-webhook?empresa_id=XXX&secret=YYY
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function mapTipo(p: any): "texto" | "imagem" | "audio" | "video" | "documento" | "localizacao" | "contato" | "sticker" | "sistema" {
  if (p.image) return "imagem";
  if (p.audio) return "audio";
  if (p.video) return "video";
  if (p.document) return "documento";
  if (p.sticker) return "sticker";
  if (p.location) return "localizacao";
  if (p.contact) return "contato";
  return "texto";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const empresa_id = url.searchParams.get("empresa_id");
    const secret = url.searchParams.get("secret");
    if (!empresa_id || !secret) return new Response("missing params", { status: 400, headers: corsHeaders });

    const { data: cfg } = await supabase
      .from("whatsapp_configuracoes")
      .select("webhook_secret, ativo")
      .eq("empresa_id", empresa_id)
      .maybeSingle();
    if (!cfg || cfg.webhook_secret !== secret) return new Response("forbidden", { status: 403, headers: corsHeaders });
    if (!cfg.ativo) return new Response("disabled", { status: 200, headers: corsHeaders });

    const payload = await req.json().catch(() => ({} as any));
    // Ignora mensagens enviadas pela própria instância (eco)
    if (payload?.fromMe === true || payload?.isStatusReply === true) {
      return new Response("ignored", { status: 200, headers: corsHeaders });
    }

    const telefone: string = String(payload?.phone ?? payload?.from ?? "").replace(/\D/g, "");
    if (!telefone) return new Response("no phone", { status: 200, headers: corsHeaders });

    const nome = payload?.senderName ?? payload?.chatName ?? payload?.notifyName ?? null;
    const foto = payload?.senderPhoto ?? payload?.photo ?? null;
    const tipo = mapTipo(payload);
    const conteudo: string =
      payload?.text?.message ??
      payload?.image?.caption ??
      payload?.video?.caption ??
      payload?.document?.caption ??
      payload?.audio?.caption ??
      "";
    const midia_url =
      payload?.image?.imageUrl ??
      payload?.video?.videoUrl ??
      payload?.audio?.audioUrl ??
      payload?.document?.documentUrl ??
      null;
    const midia_mime = payload?.image?.mimeType ?? payload?.video?.mimeType ?? payload?.audio?.mimeType ?? payload?.document?.mimeType ?? null;
    const external_id = payload?.messageId ?? payload?.id ?? null;
    const ts = payload?.momment ? new Date(Number(payload.momment)).toISOString() : new Date().toISOString();

    const { data: result, error } = await supabase.rpc("whatsapp_processar_mensagem_recebida", {
      _empresa_id: empresa_id,
      _telefone: telefone,
      _nome_contato: nome,
      _foto_url: foto,
      _conteudo: conteudo || null,
      _tipo: tipo,
      _midia_url: midia_url,
      _midia_mime: midia_mime,
      _external_id: external_id,
      _enviada_em: ts,
    });
    if (error) {
      console.error("rpc error", error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    // Aciona IA se configurada
    const { data: iaCfg } = await supabase
      .from("whatsapp_ia_config")
      .select("ativo, pausar_quando_humano_responder")
      .eq("empresa_id", empresa_id)
      .maybeSingle();

    if (iaCfg?.ativo && result?.conversa_id) {
      const { data: conv } = await supabase
        .from("whatsapp_conversas")
        .select("ia_ativa")
        .eq("id", result.conversa_id)
        .maybeSingle();
      if (conv?.ia_ativa) {
        // Dispara IA assíncrona
        fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-ia-responder`, {
          method: "POST",
          headers: { "content-type": "application/json", "authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({ empresa_id, conversa_id: result.conversa_id }),
        }).catch((e) => console.error("ia trigger", e));
      }
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
