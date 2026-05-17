import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaScope } from "@/lib/empresa-scope";
import { Copy, Loader2 } from "lucide-react";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;

const ESPECIALIDADES_GENERICAS = [
  "Atendimento ao cliente",
  "Vendas consultivas",
  "Pós-venda e suporte",
  "Orçamentos rápidos",
];

const ESPECIALIDADES_POR_RAMO: Record<string, string[]> = {
  autopecas: [
    "Peças para linha leve (passeio)",
    "Peças para linha pesada (caminhões)",
    "Peças para motos",
    "Suspensão e direção",
    "Freios e embreagem",
    "Motor e injeção eletrônica",
    "Acessórios e som automotivo",
    "Pneus, rodas e calotas",
  ],
  oficina_mecanica: [
    "Mecânica geral",
    "Injeção eletrônica e scanner",
    "Suspensão e alinhamento",
    "Freios e embreagem",
    "Câmbio automático",
    "Ar-condicionado automotivo",
    "Funilaria e pintura",
    "Elétrica automotiva",
  ],
  borracharia_pneus: [
    "Venda de pneus novos",
    "Recapagem",
    "Alinhamento e balanceamento",
    "Geometria",
    "Pneus agrícolas / linha pesada",
  ],
  concessionaria: [
    "Venda de veículos novos",
    "Venda de seminovos",
    "Financiamento e consórcio",
    "Avaliação e troca",
    "Pós-venda e revisões",
  ],
  lava_jato: ["Lavagem simples", "Lavagem detalhada", "Polimento e cristalização", "Higienização interna", "Vitrificação"],
  posto_combustivel: ["Combustíveis", "Loja de conveniência", "Troca de óleo", "Lubrificantes"],
  farmacia: ["Medicamentos de prescrição", "Genéricos", "Dermocosméticos", "Perfumaria", "Aplicação de injetáveis", "Manipulação"],
  supermercado: ["Hortifruti", "Açougue", "Padaria interna", "Bebidas", "Limpeza e higiene", "Mercearia"],
  restaurante: ["Almoço executivo", "À la carte", "Delivery", "Eventos e buffet", "Pizzaria", "Comida japonesa"],
  padaria: ["Pães artesanais", "Confeitaria", "Salgados", "Bolos sob encomenda", "Café da manhã"],
  moda: ["Moda feminina", "Moda masculina", "Moda infantil", "Calçados", "Moda fitness", "Moda plus size", "Moda íntima"],
  cosmeticos: ["Cabelos", "Pele/skincare", "Maquiagem", "Perfumaria", "Unhas"],
  petshop: ["Banho e tosa", "Ração e alimentação", "Acessórios", "Veterinária", "Farmácia veterinária"],
  materiais_construcao: ["Material básico (cimento, areia)", "Hidráulica", "Elétrica", "Acabamentos e pisos", "Tintas", "Ferramentas"],
  moveis_decoracao: ["Móveis planejados", "Móveis prontos", "Decoração", "Colchões", "Eletrodomésticos"],
  eletronicos: ["Notebooks e computadores", "Smartphones", "Áudio e vídeo", "Games", "Suprimentos de informática"],
  celulares_assistencia: ["Troca de tela", "Troca de bateria", "Reparo de placa", "Venda de aparelhos", "Acessórios"],
  imobiliaria: ["Locação residencial", "Locação comercial", "Venda residencial", "Venda comercial", "Lançamentos"],
  clinica_medica: ["Clínica geral", "Odontologia", "Estética", "Fisioterapia", "Psicologia", "Exames de imagem"],
  academia: ["Musculação", "Funcional", "Crossfit", "Pilates", "Lutas"],
  salao_beleza: ["Cabelo", "Barbearia", "Manicure/pedicure", "Estética facial", "Sobrancelhas"],
  educacao: ["Idiomas", "Reforço escolar", "Pré-vestibular", "Cursos profissionalizantes", "Educação infantil"],
  advocacia: ["Trabalhista", "Cível", "Tributário", "Previdenciário", "Contabilidade fiscal", "Contabilidade gerencial"],
  turismo: ["Pacotes nacionais", "Pacotes internacionais", "Hotelaria", "Aluguel por temporada", "Receptivo"],
  agropecuaria: ["Insumos agrícolas", "Sementes", "Defensivos", "Nutrição animal", "Máquinas e implementos"],
  industria: ["Metalurgia", "Plásticos", "Alimentos", "Têxtil", "Química"],
  servicos_gerais: ["Manutenção predial", "Limpeza", "Jardinagem", "Reformas"],
  outro: ["Outro (descrever)"],
};

export default function ConfiguracoesCrm() {
  const { empresa_id, isReady } = useEmpresaScope();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wa, setWa] = useState<any>({ provedor: "zapi", instance_id: "", token_api: "", client_token: "", numero_whatsapp: "", ativo: false, webhook_secret: "", webhook_path: "" });
  const [ia, setIa] = useState<any>({ ativo: false, modelo: "google/gemini-3-flash-preview", temperatura: 0.7, max_tokens: 400, personalidade: "", prompt_personalizado: "", saudacao: "", horario_inicio: "", horario_fim: "", mensagem_ausencia: "", pausar_quando_humano_responder: true, ramo_atividade: "", especialidade: "" });

  useEffect(() => {
    if (!isReady) return;
    (async () => {
      setLoading(true);
      const [{ data: w }, { data: i }] = await Promise.all([
        supabase.from("whatsapp_configuracoes").select("*").eq("empresa_id", empresa_id).maybeSingle(),
        supabase.from("whatsapp_ia_config").select("*").eq("empresa_id", empresa_id).maybeSingle(),
      ]);
      if (w) setWa(w);
      if (i) setIa(i);
      setLoading(false);
    })();
  }, [empresa_id, isReady]);

  const webhookUrl = wa.webhook_secret
    ? `${SUPA_URL}/functions/v1/whatsapp-zapi-webhook?empresa_id=${encodeURIComponent(empresa_id)}&secret=${wa.webhook_secret}`
    : "";

  const saveWa = async () => {
    setSaving(true);
    const payload = { ...wa, empresa_id };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    const { data, error } = await supabase.from("whatsapp_configuracoes")
      .upsert(payload, { onConflict: "empresa_id" }).select("*").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    setWa(data);
    toast.success("Configuração WhatsApp salva");
  };

  const saveIa = async () => {
    setSaving(true);
    const payload = { ...ia, empresa_id, temperatura: Number(ia.temperatura), max_tokens: Number(ia.max_tokens), horario_inicio: ia.horario_inicio || null, horario_fim: ia.horario_fim || null };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    const { data, error } = await supabase.from("whatsapp_ia_config")
      .upsert(payload, { onConflict: "empresa_id" }).select("*").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    setIa(data);
    toast.success("Configuração IA salva");
  };

  if (loading) return <div className="p-6 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Configurações CRM / WhatsApp / IA</h1>
        <p className="text-sm text-muted-foreground">Empresa atual: {empresa_id || "—"}</p>
      </div>

      <Tabs defaultValue="whatsapp">
        <TabsList>
          <TabsTrigger value="whatsapp">WhatsApp (Z-API)</TabsTrigger>
          <TabsTrigger value="ia">Agente IA</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Z-API</CardTitle>
              <CardDescription>Cole as credenciais da sua instância Z-API.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Instance ID</Label><Input value={wa.instance_id ?? ""} onChange={(e) => setWa({ ...wa, instance_id: e.target.value })} /></div>
                <div><Label>Token</Label><Input value={wa.token_api ?? ""} onChange={(e) => setWa({ ...wa, token_api: e.target.value })} /></div>
                <div><Label>Client-Token (Account Token)</Label><Input value={wa.client_token ?? ""} onChange={(e) => setWa({ ...wa, client_token: e.target.value })} /></div>
                <div><Label>Número WhatsApp</Label><Input value={wa.numero_whatsapp ?? ""} onChange={(e) => setWa({ ...wa, numero_whatsapp: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={wa.ativo} onCheckedChange={(v) => setWa({ ...wa, ativo: v })} />
                <Label>Ativo (recebe webhooks e permite envio)</Label>
              </div>
              {webhookUrl && (
                <div className="space-y-1 rounded-lg border bg-muted/40 p-3">
                  <Label className="text-xs">URL do Webhook (cole no painel Z-API → "Ao receber" e "Status da mensagem")</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] break-all bg-background border rounded px-2 py-1">{webhookUrl}</code>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copiado"); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex justify-end"><Button onClick={saveWa} disabled={saving}>{saving ? "Salvando..." : "Salvar WhatsApp"}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ia" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Agente de IA</CardTitle>
              <CardDescription>Respostas automáticas no WhatsApp via AI Gateway.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Switch checked={ia.ativo} onCheckedChange={(v) => setIa({ ...ia, ativo: v })} />
                <Label>IA ativa</Label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Modelo</Label>
                  <Select value={ia.modelo} onValueChange={(v) => setIa({ ...ia, modelo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google/gemini-3-flash-preview">Gemini 3 Flash (rápido)</SelectItem>
                      <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                      <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                      <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
                      <SelectItem value="openai/gpt-5">GPT-5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Temperatura</Label><Input type="number" step="0.1" min={0} max={2} value={ia.temperatura} onChange={(e) => setIa({ ...ia, temperatura: e.target.value })} /></div>
                <div><Label>Max tokens</Label><Input type="number" value={ia.max_tokens} onChange={(e) => setIa({ ...ia, max_tokens: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ramo de Atividade</Label>
                  <Select value={ia.ramo_atividade ?? ""} onValueChange={(v) => setIa({ ...ia, ramo_atividade: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o ramo..." /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="autopecas">Auto Peças e Acessórios</SelectItem>
                      <SelectItem value="oficina_mecanica">Oficina Mecânica</SelectItem>
                      <SelectItem value="borracharia_pneus">Borracharia / Pneus</SelectItem>
                      <SelectItem value="concessionaria">Concessionária / Revenda de Veículos</SelectItem>
                      <SelectItem value="lava_jato">Lava-Jato / Estética Automotiva</SelectItem>
                      <SelectItem value="posto_combustivel">Posto de Combustível</SelectItem>
                      <SelectItem value="farmacia">Farmácia / Drogaria</SelectItem>
                      <SelectItem value="supermercado">Supermercado / Mercearia</SelectItem>
                      <SelectItem value="restaurante">Restaurante / Lanchonete</SelectItem>
                      <SelectItem value="padaria">Padaria / Confeitaria</SelectItem>
                      <SelectItem value="moda">Moda / Vestuário / Calçados</SelectItem>
                      <SelectItem value="cosmeticos">Cosméticos / Beleza</SelectItem>
                      <SelectItem value="petshop">Pet Shop / Veterinária</SelectItem>
                      <SelectItem value="materiais_construcao">Materiais de Construção</SelectItem>
                      <SelectItem value="moveis_decoracao">Móveis / Decoração</SelectItem>
                      <SelectItem value="eletronicos">Eletrônicos / Informática</SelectItem>
                      <SelectItem value="celulares_assistencia">Celulares / Assistência Técnica</SelectItem>
                      <SelectItem value="imobiliaria">Imobiliária</SelectItem>
                      <SelectItem value="clinica_medica">Clínica Médica / Odontológica</SelectItem>
                      <SelectItem value="academia">Academia / Estúdio Fitness</SelectItem>
                      <SelectItem value="salao_beleza">Salão de Beleza / Barbearia</SelectItem>
                      <SelectItem value="educacao">Educação / Cursos</SelectItem>
                      <SelectItem value="advocacia">Advocacia / Contabilidade</SelectItem>
                      <SelectItem value="turismo">Turismo / Hotelaria</SelectItem>
                      <SelectItem value="agropecuaria">Agropecuária</SelectItem>
                      <SelectItem value="industria">Indústria / Fabricação</SelectItem>
                      <SelectItem value="servicos_gerais">Serviços Gerais</SelectItem>
                      <SelectItem value="outro">Outro (descrever em Especialidade)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Especialidade / Nicho específico</Label>
                  <Select
                    value={ia.especialidade ?? ""}
                    onValueChange={(v) => setIa({ ...ia, especialidade: v === "__custom__" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={ia.ramo_atividade ? "Selecione a especialidade..." : "Selecione o ramo primeiro"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {(ESPECIALIDADES_POR_RAMO[ia.ramo_atividade as string] ?? ESPECIALIDADES_GENERICAS).map((esp) => (
                        <SelectItem key={esp} value={esp}>{esp}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">Outra (digitar)</SelectItem>
                    </SelectContent>
                  </Select>
                  {(!ESPECIALIDADES_POR_RAMO[ia.ramo_atividade as string]?.includes(ia.especialidade) && ia.especialidade !== "") || ia.especialidade === "" ? (
                    <Input
                      className="mt-2"
                      placeholder="Ou descreva a especialidade..."
                      value={ia.especialidade ?? ""}
                      onChange={(e) => setIa({ ...ia, especialidade: e.target.value })}
                    />
                  ) : null}
                </div>
              </div>
              <div>
                <Label>Personalidade</Label>
                <Textarea rows={2} value={ia.personalidade ?? ""} onChange={(e) => setIa({ ...ia, personalidade: e.target.value })} />
              </div>
              <div>
                <Label>Prompt personalizado (contexto da empresa, produtos, regras)</Label>
                <Textarea rows={4} value={ia.prompt_personalizado ?? ""} onChange={(e) => setIa({ ...ia, prompt_personalizado: e.target.value })} />
              </div>
              <div>
                <Label>Saudação</Label>
                <Input value={ia.saudacao ?? ""} onChange={(e) => setIa({ ...ia, saudacao: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Horário início</Label><Input type="time" value={ia.horario_inicio ?? ""} onChange={(e) => setIa({ ...ia, horario_inicio: e.target.value })} /></div>
                <div><Label>Horário fim</Label><Input type="time" value={ia.horario_fim ?? ""} onChange={(e) => setIa({ ...ia, horario_fim: e.target.value })} /></div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={ia.pausar_quando_humano_responder} onCheckedChange={(v) => setIa({ ...ia, pausar_quando_humano_responder: v })} />
                  <Label className="text-xs">Pausar quando humano responder</Label>
                </div>
              </div>
              <div>
                <Label>Mensagem fora do horário</Label>
                <Textarea rows={2} value={ia.mensagem_ausencia ?? ""} onChange={(e) => setIa({ ...ia, mensagem_ausencia: e.target.value })} />
              </div>
              <div className="flex justify-end"><Button onClick={saveIa} disabled={saving}>{saving ? "Salvando..." : "Salvar IA"}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
