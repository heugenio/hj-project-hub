import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaScope } from "@/lib/empresa-scope";
import { ensureEtapasPadrao } from "@/lib/whatsapp-api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Target, Trophy, TrendingDown, Sparkles, Percent, Search, User, UserPlus, Phone, CalendarDays, DollarSign, FileText, TagIcon } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import CrmClienteDialog from "@/components/crm/CrmClienteDialog";
import { getClientes, type Cliente } from "@/lib/api-os";

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

type Etapa = { id: string; nome: string; ordem: number; cor: string; is_ganho: boolean; is_perdido: boolean };
type Op = {
  id: string; etapa_id: string; titulo: string; descricao: string | null;
  valor_estimado: number; probabilidade: number; cliente_nome: string | null;
  cliente_id: string | null;
  telefone: string | null; canal_origem: string | null; ordem: number;
  ultimo_contato_em: string | null; data_prevista: string | null;
  foto_lead_url: string | null;
};

export default function Crm() {
  const { empresa_id, isReady, usrs_id } = useEmpresaScope();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverEtapa, setDragOverEtapa] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [clienteOp, setClienteOp] = useState<Op | null>(null);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteResults, setClienteResults] = useState<Cliente[]>([]);
  const [form, setForm] = useState<any>({ titulo: "", descricao: "", etapa_id: "", valor_estimado: 0, probabilidade: 50, cliente_id: "", cliente_nome: "", telefone: "", data_prevista: "" });

  useEffect(() => { if (isReady) ensureEtapasPadrao(empresa_id); }, [empresa_id, isReady]);

  const { data: etapas } = useQuery({
    queryKey: ["crm-etapas", empresa_id], enabled: isReady,
    queryFn: async () => {
      const { data } = await supabase.from("crm_etapas").select("*").eq("empresa_id", empresa_id).order("ordem");
      return (data ?? []) as Etapa[];
    },
  });

  const { data: ops } = useQuery({
    queryKey: ["crm-ops", empresa_id], enabled: isReady,
    queryFn: async () => {
      const { data } = await supabase.from("crm_oportunidades").select("*").eq("empresa_id", empresa_id).order("ordem");
      return (data ?? []) as Op[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!isReady) return;
    const ch = supabase.channel(`crm-${empresa_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_oportunidades", filter: `empresa_id=eq.${empresa_id}` },
        () => qc.invalidateQueries({ queryKey: ["crm-ops"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [empresa_id, isReady, qc]);

  const opsFiltered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (ops ?? []).filter((o) => !s || o.titulo.toLowerCase().includes(s) || (o.cliente_nome ?? "").toLowerCase().includes(s) || (o.telefone ?? "").includes(s));
  }, [ops, search]);

  const opsByEtapa = useMemo(() => {
    const m: Record<string, Op[]> = {};
    (etapas ?? []).forEach((e) => { m[e.id] = []; });
    opsFiltered.forEach((o) => { m[o.etapa_id]?.push(o); });
    return m;
  }, [etapas, opsFiltered]);

  const kpis = useMemo(() => {
    const abertas = opsFiltered.filter((o) => { const e = etapas?.find((x) => x.id === o.etapa_id); return !e?.is_ganho && !e?.is_perdido; });
    const ganhas = opsFiltered.filter((o) => etapas?.find((x) => x.id === o.etapa_id)?.is_ganho);
    const perdidas = opsFiltered.filter((o) => etapas?.find((x) => x.id === o.etapa_id)?.is_perdido);
    const totalAbertas = abertas.reduce((s, o) => s + Number(o.valor_estimado || 0), 0);
    const totalGanhas = ganhas.reduce((s, o) => s + Number(o.valor_estimado || 0), 0);
    const ponderado = abertas.reduce((s, o) => s + Number(o.valor_estimado || 0) * (o.probabilidade / 100), 0);
    const fechadas = ganhas.length + perdidas.length;
    const taxa = fechadas > 0 ? (ganhas.length / fechadas) * 100 : 0;
    return { abertas: abertas.length, totalAbertas, ganhas: ganhas.length, totalGanhas, perdidas: perdidas.length, ponderado, taxa };
  }, [opsFiltered, etapas]);

  const moveTo = async (opId: string, etapaId: string) => {
    const etapa = etapas?.find((e) => e.id === etapaId);
    const isFinal = etapa?.is_ganho || etapa?.is_perdido;
    const { error } = await supabase.from("crm_oportunidades").update({
      etapa_id: etapaId, ganho: etapa?.is_ganho ? true : etapa?.is_perdido ? false : null,
      fechada_em: isFinal ? new Date().toISOString() : null,
    }).eq("id", opId);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["crm-ops"] });
  };

  const openNew = (etapa_id?: string) => {
    setForm({ titulo: "", descricao: "", etapa_id: etapa_id ?? etapas?.[0]?.id ?? "", valor_estimado: 0, probabilidade: 50, cliente_id: "", cliente_nome: "", telefone: "", data_prevista: "" });
    setClienteResults([]);
    setClienteSearch("");
    setOpen(true);
  };

  const buscarClientesNovo = async () => {
    const q = clienteSearch.trim();
    if (!q) return;
    try {
      const isDoc = /\d/.test(q) && q.replace(/\D/g, "").length >= 11;
      const arr = await getClientes(isDoc ? { cpfcnpj: q.replace(/\D/g, "") } : { nome: q.toUpperCase() });
      setClienteResults(arr.slice(0, 10));
      if (!arr.length) toast.message("Nenhum cliente encontrado");
    } catch (e: any) { toast.error(e?.message || "Erro ao buscar"); }
  };

  const selecionarClienteNovo = (c: any) => {
    setForm((f: any) => ({
      ...f,
      cliente_id: String(c.PESS_ID || ""),
      cliente_nome: c.PESS_NOME || "",
      telefone: (c.PESS_FONE_CELULAR || c.PESS_FONE || "").replace(/\D/g, ""),
    }));
    setClienteResults([]);
    setClienteSearch(c.PESS_NOME || "");
  };

  const save = async () => {
    if (!form.titulo.trim() || !form.etapa_id) { toast.error("Título e etapa obrigatórios"); return; }
    const payload: any = {
      empresa_id, etapa_id: form.etapa_id,
      titulo: form.titulo.toUpperCase().trim(),
      descricao: form.descricao?.toUpperCase().trim() || null,
      cliente_id: form.cliente_id ? String(form.cliente_id) : null,
      cliente_nome: form.cliente_nome?.toUpperCase().trim() || null,
      telefone: form.telefone?.replace(/\D/g, "") || null,
      valor_estimado: Number(form.valor_estimado) || 0,
      probabilidade: Number(form.probabilidade) || 50,
      data_prevista: form.data_prevista || null,
      canal_origem: "manual",
      created_by: usrs_id || null,
    };
    const { error } = await supabase.from("crm_oportunidades").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Oportunidade criada");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["crm-ops"] });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>CRM — Funil de Vendas</h1>
          <p className="text-sm text-muted-foreground">Pipeline de oportunidades e leads</p>
        </div>
        <Button onClick={() => openNew()} className="gap-2"><Plus className="h-4 w-4" /> Nova oportunidade</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<Target className="h-4 w-4 text-blue-600" />} label="Em aberto" value={String(kpis.abertas)} sub={brl(kpis.totalAbertas)} />
        <Kpi icon={<Sparkles className="h-4 w-4 text-violet-600" />} label="Pipeline ponderado" value={brl(kpis.ponderado)} sub="Valor × probabilidade" />
        <Kpi icon={<Trophy className="h-4 w-4 text-emerald-600" />} label="Ganhas" value={String(kpis.ganhas)} sub={brl(kpis.totalGanhas)} />
        <Kpi icon={<Percent className="h-4 w-4 text-amber-600" />} label="Taxa de conversão" value={`${kpis.taxa.toFixed(1)}%`} sub={`${kpis.ganhas} ganhas / ${kpis.perdidas} perdidas`} />
      </div>

      <Card className="p-3">
        <div className="relative max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Buscar título, cliente ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {(etapas ?? []).map((etapa) => {
          const items = opsByEtapa[etapa.id] ?? [];
          const isOver = dragOverEtapa === etapa.id;
          return (
            <div key={etapa.id}
              onDragOver={(e) => { e.preventDefault(); setDragOverEtapa(etapa.id); }}
              onDragLeave={() => setDragOverEtapa(null)}
              onDrop={() => { if (draggingId) { moveTo(draggingId, etapa.id); setDraggingId(null); } setDragOverEtapa(null); }}
              className={`flex w-[280px] shrink-0 flex-col rounded-xl border bg-muted/30 transition-all ${isOver ? "ring-2 ring-primary/60 bg-primary/5" : ""} ${etapa.is_ganho ? "border-emerald-500/30" : etapa.is_perdido ? "border-destructive/30" : ""}`}>
              <div className="px-3 pt-3 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: etapa.cor }} />
                    <h3 className="text-xs font-semibold uppercase tracking-wider truncate">{etapa.nome}</h3>
                    {etapa.is_ganho && <Trophy className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                    {etapa.is_perdido && <TrendingDown className="h-3.5 w-3.5 text-destructive shrink-0" />}
                  </div>
                  <Badge variant="outline" className="text-[10px] h-5">{items.length}</Badge>
                </div>
                <div className="mt-1 text-[11px] font-medium text-muted-foreground">{brl(items.reduce((s, o) => s + Number(o.valor_estimado || 0), 0))}</div>
              </div>
              <div className="flex-1 px-2 pb-2 space-y-2 min-h-32 overflow-y-auto max-h-[calc(100vh-360px)]">
                {items.map((o) => (
                  <div key={o.id} draggable onDragStart={() => setDraggingId(o.id)} onDragEnd={() => setDraggingId(null)}
                    onClick={() => setClienteOp(o)}
                    className="rounded-lg border bg-card p-2.5 shadow-sm cursor-pointer hover:shadow transition-shadow active:cursor-grabbing">
                    <p className="text-sm font-medium truncate">{o.titulo}</p>
                    {o.cliente_nome && <p className="text-xs text-muted-foreground truncate">{o.cliente_nome}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-semibold text-primary">{brl(Number(o.valor_estimado || 0))}</span>
                      <div className="flex items-center gap-1">
                        {o.cliente_id ? (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5 border-emerald-500/50 text-emerald-600">
                            <User className="h-2.5 w-2.5" /> cliente
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5 text-amber-600 border-amber-500/50">
                            <UserPlus className="h-2.5 w-2.5" /> sem cliente
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] h-4">{o.probabilidade}%</Badge>
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="w-full h-8 text-xs" onClick={() => openNew(etapa.id)}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
          {/* Header com gradiente */}
          <div className="bg-gradient-to-br from-primary via-primary to-primary/80 px-6 py-5 text-primary-foreground">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-primary-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Nova oportunidade
                </DialogTitle>
                <p className="text-xs text-primary-foreground/80 mt-0.5">Adicione um lead ao seu funil de vendas</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Seção: Identificação */}
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <FileText className="h-3 w-3" /> Identificação
              </div>
              <Input placeholder="TÍTULO DA OPORTUNIDADE *" value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value.toUpperCase() })}
                className="h-10 text-sm font-medium" />
              <Textarea placeholder="DESCRIÇÃO / ANOTAÇÕES" value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value.toUpperCase() })}
                rows={2} className="resize-none text-sm" />
            </section>

            {/* Seção: Cliente */}
            <section className="space-y-2 rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <User className="h-3 w-3" /> Cliente
                </div>
                {form.cliente_id && (
                  <Badge variant="outline" className="text-[10px] h-5 border-emerald-500/50 text-emerald-600 gap-1">
                    <User className="h-2.5 w-2.5" /> ID {form.cliente_id}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9 h-9 text-xs" placeholder="BUSCAR CLIENTE CADASTRADO (NOME OU CPF/CNPJ)"
                    value={clienteSearch}
                    onChange={(e) => setClienteSearch(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarClientesNovo(); } }} />
                </div>
                <Button type="button" variant="secondary" size="sm" className="h-9" onClick={buscarClientesNovo}>
                  <Search className="h-3.5 w-3.5" />
                </Button>
                {form.cliente_id && (
                  <Button type="button" variant="ghost" size="sm" className="h-9"
                    onClick={() => { setForm({ ...form, cliente_id: "", cliente_nome: "", telefone: "" }); setClienteSearch(""); }}>
                    Limpar
                  </Button>
                )}
              </div>
              {clienteResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border bg-background divide-y shadow-sm">
                  {clienteResults.map((c) => (
                    <button key={c.PESS_ID} type="button" onClick={() => selecionarClienteNovo(c)}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-xs transition-colors">
                      <div className="font-medium truncate">{c.PESS_NOME}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {c.PESS_CPFCNPJ || "—"}{c.PESS_FONE_CELULAR ? ` · ${c.PESS_FONE_CELULAR}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <UserPlus className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9 h-9 text-xs" placeholder="NOME (LEAD AVULSO)"
                    value={form.cliente_nome}
                    onChange={(e) => setForm({ ...form, cliente_nome: e.target.value.toUpperCase() })} />
                </div>
                <div className="relative">
                  <Phone className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9 h-9 text-xs" placeholder="TELEFONE / WHATSAPP"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
                </div>
              </div>
            </section>

            {/* Seção: Negócio */}
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <DollarSign className="h-3 w-3" /> Detalhes do negócio
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase">Valor (R$)</label>
                  <Input type="number" placeholder="0,00" value={form.valor_estimado}
                    onChange={(e) => setForm({ ...form, valor_estimado: e.target.value })}
                    className="h-9 text-sm font-semibold" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase">Probabilidade</label>
                  <Input type="number" placeholder="50" min={0} max={100} value={form.probabilidade}
                    onChange={(e) => setForm({ ...form, probabilidade: e.target.value })}
                    className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase">Previsão</label>
                  <div className="relative">
                    <CalendarDays className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input type="date" value={form.data_prevista}
                      onChange={(e) => setForm({ ...form, data_prevista: e.target.value })}
                      className="pl-8 h-9 text-xs" />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1"><TagIcon className="h-3 w-3" /> Etapa do funil</label>
                <Select value={form.etapa_id} onValueChange={(v) => setForm({ ...form, etapa_id: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                  <SelectContent>
                    {(etapas ?? []).map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.cor }} />
                          {e.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>
          </div>

          <DialogFooter className="border-t bg-muted/30 px-6 py-3">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} className="gap-2">
              <Sparkles className="h-4 w-4" /> Criar oportunidade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {clienteOp && (
        <CrmClienteDialog
          open={!!clienteOp}
          onOpenChange={(v) => { if (!v) setClienteOp(null); }}
          oportunidade={clienteOp}
          onLinked={() => qc.invalidateQueries({ queryKey: ["crm-ops"] })}
        />
      )}
    </div>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </Card>
  );
}
