import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cpf } = await req.json();
    const nums = (cpf || "").replace(/\D/g, "");
    if (nums.length !== 11) {
      return new Response(
        JSON.stringify({ error: "CPF inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const formattedCpf = nums.replace(
      /(\d{3})(\d{3})(\d{3})(\d{2})/,
      "$1.$2.$3-$4"
    );

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Você é um assistente que busca dados públicos de pessoas físicas brasileiras a partir do CPF.
Busque na internet informações públicas disponíveis sobre o CPF fornecido.
Retorne APENAS um JSON válido com os campos encontrados (omita campos não encontrados):
{
  "nome": "Nome completo da pessoa",
  "data_nascimento": "YYYY-MM-DD",
  "sexo": "M" ou "F",
  "telefone": "apenas números com DDD",
  "celular": "apenas números com DDD",
  "email": "email se encontrado",
  "cep": "apenas números",
  "logradouro": "endereço",
  "numero": "número",
  "bairro": "bairro",
  "cidade": "cidade",
  "uf": "UF com 2 letras"
}
Se não encontrar NENHUMA informação, retorne: {"encontrado": false}
Não invente dados. Retorne apenas dados que encontrar em fontes públicas.`,
            },
            {
              role: "user",
              content: `Busque dados públicos do CPF: ${formattedCpf}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_cpf_data",
                description: "Return structured person data found for the CPF",
                parameters: {
                  type: "object",
                  properties: {
                    encontrado: { type: "boolean", description: "Whether data was found" },
                    nome: { type: "string" },
                    data_nascimento: { type: "string", description: "YYYY-MM-DD format" },
                    sexo: { type: "string", enum: ["M", "F"] },
                    telefone: { type: "string", description: "Phone with DDD, digits only" },
                    celular: { type: "string", description: "Mobile with DDD, digits only" },
                    email: { type: "string" },
                    cep: { type: "string", description: "CEP digits only" },
                    logradouro: { type: "string" },
                    numero: { type: "string" },
                    bairro: { type: "string" },
                    cidade: { type: "string" },
                    uf: { type: "string", description: "2-letter state code" },
                  },
                  required: ["encontrado"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "return_cpf_data" } },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes para busca por IA." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro na busca por IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      // Fallback: try to parse content as JSON
      const content = result.choices?.[0]?.message?.content || "";
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return new Response(JSON.stringify(parsed), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {}
      return new Response(
        JSON.stringify({ encontrado: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cpf-lookup error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
