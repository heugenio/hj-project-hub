// Gera resposta com Lovable AI Gateway e envia via Z-API
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function dentroDoHorario(cfg: any): boolean {
  const now = new Date();
  const dia = now.getDay();
  const dias: number[] = cfg.dias_semana ?? [0,1,2,3,4,5,6];
  if (!dias.includes(dia)) return false;
  if (cfg.horario_inicio && cfg.horario_fim) {
    const [hi, mi] = String(cfg.horario_inicio).split(":").map(Number);
    const [hf, mf] = String(cfg.horario_fim).split(":").map(Number);
    const cur = now.getHours() * 60 + now.getMinutes();
    const ini = hi * 60 + mi;
    const fim = hf * 60 + mf;
    if (cur < ini || cur > fim) return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { empresa_id, conversa_id } = await req.json();
    if (!empresa_id || !conversa_id) return new Response("missing", { status: 400, headers: corsHeaders });

    const { data: cfg } = await supabase
      .from("whatsapp_ia_config").select("*").eq("empresa_id", empresa_id).maybeSingle();
    if (!cfg?.ativo) return new Response("ia off", { status: 200, headers: corsHeaders });

    const { data: conv } = await supabase
      .from("whatsapp_conversas").select("ia_ativa, telefone, nome_contato").eq("id", conversa_id).maybeSingle();
    if (!conv?.ia_ativa) return new Response("conv ia off", { status: 200, headers: corsHeaders });

    if (!dentroDoHorario(cfg)) {
      if (cfg.mensagem_ausencia) {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-zapi-enviar`, {
          method: "POST",
          headers: { "content-type": "application/json", "authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({ empresa_id, conversa_id, texto: cfg.mensagem_ausencia, gerada_por_ia: true }),
        });
      }
      return new Response("fora horario", { status: 200, headers: corsHeaders });
    }

    const { data: ultimas } = await supabase
      .from("whatsapp_mensagens")
      .select("direcao, conteudo, tipo, enviada_em")
      .eq("conversa_id", conversa_id)
      .order("enviada_em", { ascending: false })
      .limit(20);
    const historico = (ultimas ?? []).reverse();

    const systemPrompt = [
      cfg.personalidade ?? "Você é um vendedor virtual cordial e prestativo.",
      cfg.prompt_personalizado ?? "",
      `Contato: ${conv.nome_contato ?? conv.telefone}.`,
      "Responda em português brasileiro, com mensagens curtas e objetivas, no estilo WhatsApp.",
    ].filter(Boolean).join("\n\n");

    const messages = [
      { role: "system", content: systemPrompt },
      ...historico.map((m) => ({
        role: m.direcao === "recebida" ? "user" : "assistant",
        content: m.conteudo ?? `[${m.tipo}]`,
      })),
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": Deno.env.get("LOVABLE_API_KEY") ?? "",
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: cfg.modelo ?? "google/gemini-3-flash-preview",
        messages,
        temperature: Number(cfg.temperatura ?? 0.7),
        max_tokens: Number(cfg.max_tokens ?? 400),
      }),
    });

    if (aiResp.status === 429) return new Response("rate limit", { status: 429, headers: corsHeaders });
    if (aiResp.status === 402) return new Response("credits", { status: 402, headers: corsHeaders });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("ai error", t);
      return new Response(JSON.stringify({ ok: false, error: t }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
    }
    const ai = await aiResp.json();
    const texto = ai?.choices?.[0]?.message?.content?.trim();
    if (!texto) return new Response("empty", { status: 200, headers: corsHeaders });

    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-zapi-enviar`, {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ empresa_id, conversa_id, texto, gerada_por_ia: true }),
    });

    return new Response(JSON.stringify({ ok: true, texto }), { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
