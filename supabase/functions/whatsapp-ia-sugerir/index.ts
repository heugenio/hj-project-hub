// Gera 3 sugestões de resposta para o atendente, sem enviar
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
    const { empresa_id, conversa_id } = await req.json();
    if (!empresa_id || !conversa_id) return new Response("missing", { status: 400, headers: corsHeaders });

    const { data: cfg } = await supabase
      .from("whatsapp_ia_config").select("modelo, personalidade, prompt_personalizado").eq("empresa_id", empresa_id).maybeSingle();
    const { data: ultimas } = await supabase
      .from("whatsapp_mensagens")
      .select("direcao, conteudo, tipo")
      .eq("conversa_id", conversa_id)
      .order("enviada_em", { ascending: false })
      .limit(15);
    const historico = (ultimas ?? []).reverse();

    const sys = [
      cfg?.personalidade ?? "Você é um vendedor virtual cordial e objetivo.",
      cfg?.prompt_personalizado ?? "",
      "Gere exatamente 3 sugestões de resposta curtas em pt-BR, separadas por '|||'. Sem numeração, sem aspas, sem prefixos.",
    ].filter(Boolean).join("\n\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": Deno.env.get("LOVABLE_API_KEY") ?? "",
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: cfg?.modelo ?? "google/gemini-3-flash-preview",
        temperature: 0.8,
        max_tokens: 400,
        messages: [
          { role: "system", content: sys },
          ...historico.map((m) => ({
            role: m.direcao === "recebida" ? "user" : "assistant",
            content: m.conteudo ?? `[${m.tipo}]`,
          })),
        ],
      }),
    });
    if (aiResp.status === 429) return new Response(JSON.stringify({ ok: false, error: "rate" }), { status: 429, headers: { ...corsHeaders, "content-type": "application/json" } });
    if (aiResp.status === 402) return new Response(JSON.stringify({ ok: false, error: "credits" }), { status: 402, headers: { ...corsHeaders, "content-type": "application/json" } });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      return new Response(JSON.stringify({ ok: false, error: t }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
    }
    const ai = await aiResp.json();
    const txt: string = ai?.choices?.[0]?.message?.content ?? "";
    const sugestoes = txt.split("|||").map((s) => s.trim()).filter(Boolean).slice(0, 3);

    return new Response(JSON.stringify({ ok: true, sugestoes }), { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
