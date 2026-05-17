// Vincula uma oportunidade do CRM a um cliente cadastrado no sistema legado
// e permite criar / completar as informações cadastrais do cliente.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, Link2, UserPlus, Save, X, CheckCircle2, User, Phone, Mail, MapPin,
  ShoppingCart, Wrench, Sparkles, FileText, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getClientes, setCliente, type Cliente } from "@/lib/api-os";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  oportunidade: {
    id: string;
    titulo: string;
    cliente_id?: string | null;
    cliente_nome?: string | null;
    telefone?: string | null;
  };
  onLinked?: () => void;
}

const onlyDigits = (s?: string | null) => (s || "").replace(/\D/g, "");

export default function CrmClienteDialog({ open, onOpenChange, oportunidade, onLinked }: Props) {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Cliente[]>([]);
  const [linked, setLinked] = useState<Cliente | null>(null);
  const [form, setForm] = useState<Partial<Cliente>>({});
  const [showForm, setShowForm] = useState(false);

  // Ao abrir: tenta carregar cliente vinculado
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setResults([]);
    setShowForm(false);
    (async () => {
      if (oportunidade.cliente_id) {
        try {
          const arr = await getClientes({ id: oportunidade.cliente_id });
          if (arr?.[0]) {
            setLinked(arr[0]);
            setForm(arr[0]);
            return;
          }
        } catch {/* ignore */}
      }
      setLinked(null);
      setForm({
        PESS_NOME: (oportunidade.cliente_nome || "").toUpperCase(),
        PESS_FONE_CELULAR: oportunidade.telefone || "",
        PESS_FISICO_JURIDICO: "F",
        PESS_TIPO: "F",
      });
    })();
  }, [open, oportunidade.cliente_id, oportunidade.cliente_nome, oportunidade.telefone]);

  const buscar = async () => {
    const q = search.trim();
    if (!q) return;
    setBusy(true);
    try {
      const isDoc = /\d/.test(q) && onlyDigits(q).length >= 11;
      const arr = await getClientes(isDoc ? { cpfcnpj: onlyDigits(q) } : { nome: q.toUpperCase() });
      setResults(arr.slice(0, 15));
      if (!arr.length) toast.message("Nenhum cliente encontrado");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao buscar clientes");
    } finally { setBusy(false); }
  };

  const vincularNoCrm = async (cli: Cliente) => {
    const patch: any = {
      cliente_id: String(cli.PESS_ID),
      cliente_nome: cli.PESS_NOME,
    };
    const tel = cli.PESS_FONE_CELULAR || cli.PESS_FONE;
    if (tel) patch.telefone = onlyDigits(tel);
    const { error } = await supabase.from("crm_oportunidades").update(patch).eq("id", oportunidade.id);
    if (error) { toast.error(error.message); return; }
    setLinked(cli);
    setForm(cli);
    setResults([]);
    setSearch("");
    setShowForm(false);
    toast.success("Cliente vinculado à oportunidade");
    onLinked?.();
  };

  const salvarCliente = async () => {
    if (!form.PESS_NOME?.trim()) { toast.error("Nome é obrigatório"); return; }
    const docDigits = onlyDigits(form.PESS_CPFCNPJ);
    if (!linked && !docDigits) { toast.error("CPF/CNPJ é obrigatório para cadastrar novo cliente"); return; }
    setBusy(true);
    try {
      const unemId = (auth?.unidade as any)?.unem_Id || (auth?.unidade as any)?.Unem_Id || "";
      const payload: any = {
        ...form,
        PESS_NOME: form.PESS_NOME?.toUpperCase().trim(),
        PESS_CPFCNPJ: docDigits,
        PESS_FONE: onlyDigits(form.PESS_FONE),
        PESS_FONE_CELULAR: onlyDigits(form.PESS_FONE_CELULAR),
        PESS_FISICO_JURIDICO: form.PESS_FISICO_JURIDICO || (docDigits.length > 11 ? "J" : "F"),
        PESS_TIPO: form.PESS_TIPO || (docDigits.length > 11 ? "J" : "F"),
        UNEM_ID: unemId,
      };
      const saved = await setCliente(payload);
      let novo: Cliente = (Array.isArray(saved) ? saved[0] : saved) as Cliente;
      if (!novo?.PESS_ID && docDigits) {
        try {
          const arr = await getClientes({ cpfcnpj: docDigits });
          if (arr?.[0]) novo = arr[0];
        } catch { /* ignore */ }
      }
      if (!novo?.PESS_ID && linked?.PESS_ID) novo.PESS_ID = linked.PESS_ID;
      toast.success(linked ? "Cliente atualizado" : "Cliente cadastrado");
      if (novo?.PESS_ID) {
        await vincularNoCrm(novo);
      } else {
        toast.message("Cliente salvo, mas não foi possível recuperar o ID para vincular.");
        onLinked?.();
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar cliente");
    } finally { setBusy(false); }
  };

  const desvincular = async () => {
    const { error } = await supabase.from("crm_oportunidades")
      .update({ cliente_id: null }).eq("id", oportunidade.id);
    if (error) { toast.error(error.message); return; }
    setLinked(null);
    toast.success("Vínculo removido");
    onLinked?.();
  };

  const gerar = (destino: "pedido" | "os") => {
    if (!linked?.PESS_ID) { toast.error("Vincule um cliente antes de gerar"); return; }
    const prefill = {
      origem: "crm",
      oportunidade_id: oportunidade.id,
      titulo: oportunidade.titulo,
      cliente_id: String(linked.PESS_ID),
      cliente_nome: linked.PESS_NOME,
      cliente_cpfcnpj: linked.PESS_CPFCNPJ || "",
      telefone: linked.PESS_FONE_CELULAR || linked.PESS_FONE || "",
    };
    try { sessionStorage.setItem(destino === "pedido" ? "crm_prefill_pedido" : "crm_prefill_os", JSON.stringify(prefill)); } catch {/* ignore */}
    const url = destino === "pedido"
      ? `/pedidos?cliente_id=${encodeURIComponent(prefill.cliente_id)}&novo=1`
      : `/ordem-servico?cliente_id=${encodeURIComponent(prefill.cliente_id)}&novo=1`;
    onOpenChange(false);
    navigate(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0">
        {/* Header com gradiente */}
        <div className="bg-gradient-to-br from-primary via-primary to-primary/70 px-6 py-5 text-primary-foreground">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <Link2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold text-primary-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Cliente da oportunidade
              </DialogTitle>
              <p className="text-xs text-primary-foreground/80 mt-0.5 truncate">{oportunidade.titulo}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Status do vínculo */}
          {linked ? (
            <div className="rounded-xl border bg-gradient-to-br from-emerald-50 to-emerald-100/40 dark:from-emerald-950/40 dark:to-emerald-900/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{linked.PESS_NOME}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />ID {linked.PESS_ID}</span>
                      {linked.PESS_CPFCNPJ && <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />{linked.PESS_CPFCNPJ}</span>}
                      {linked.PESS_FONE_CELULAR && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{linked.PESS_FONE_CELULAR}</span>}
                      {linked.PESS_EMAIL && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{linked.PESS_EMAIL}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="outline" size="sm" className="h-8" onClick={() => setShowForm((s) => !s)}>
                    {showForm ? "Fechar" : "Completar"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive" onClick={desvincular}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Ações: gerar Pedido / OS */}
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-emerald-500/20">
                <button
                  type="button"
                  onClick={() => gerar("pedido")}
                  className="group flex items-center gap-3 rounded-lg border bg-card p-3 text-left hover:border-primary hover:shadow-md transition-all"
                >
                  <div className="h-9 w-9 rounded-lg bg-blue-500/15 flex items-center justify-center group-hover:bg-blue-500/25 transition-colors">
                    <ShoppingCart className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">Gerar Pedido</div>
                    <div className="text-[10px] text-muted-foreground">Converter em venda</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
                <button
                  type="button"
                  onClick={() => gerar("os")}
                  className="group flex items-center gap-3 rounded-lg border bg-card p-3 text-left hover:border-primary hover:shadow-md transition-all"
                >
                  <div className="h-9 w-9 rounded-lg bg-amber-500/15 flex items-center justify-center group-hover:bg-amber-500/25 transition-colors">
                    <Wrench className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">Gerar O.S.</div>
                    <div className="text-[10px] text-muted-foreground">Ordem de serviço</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-amber-100/40 dark:from-amber-950/40 dark:to-amber-900/10 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <UserPlus className="h-5 w-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Sem cliente vinculado</div>
                  <div className="text-[11px] text-muted-foreground">Busque um cliente existente ou cadastre um novo a partir do lead.</div>
                </div>
              </div>
            </div>
          )}

          {/* Busca */}
          {!linked && (
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <Search className="h-3 w-3" /> Buscar cliente cadastrado
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 h-9"
                    placeholder="NOME OU CPF/CNPJ"
                    value={search}
                    onChange={(e) => setSearch(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") buscar(); }}
                  />
                </div>
                <Button onClick={buscar} disabled={busy} size="sm" className="h-9">Buscar</Button>
                <Button variant="outline" size="sm" className="h-9" onClick={() => setShowForm(true)}>
                  <UserPlus className="h-4 w-4 mr-1" /> Novo
                </Button>
              </div>
              {results.length > 0 && (
                <div className="max-h-56 overflow-y-auto rounded-lg border divide-y shadow-sm">
                  {results.map((c) => (
                    <button
                      key={c.PESS_ID}
                      type="button"
                      onClick={() => vincularNoCrm(c)}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                    >
                      <div className="text-sm font-medium truncate">{c.PESS_NOME}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {c.PESS_CPFCNPJ || "—"}
                        {c.PESS_FONE_CELULAR ? ` · ${c.PESS_FONE_CELULAR}` : ""}
                        {c.PESS_EMAIL ? ` · ${c.PESS_EMAIL}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Formulário de criar / completar */}
          {(showForm || (!linked && results.length === 0)) && (
            <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <Sparkles className="h-3 w-3" />
                {linked ? "Completar informações" : "Cadastrar novo cliente"}
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-medium text-muted-foreground uppercase">Dados pessoais</div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="NOME *" value={form.PESS_NOME || ""}
                    onChange={(e) => setForm({ ...form, PESS_NOME: e.target.value.toUpperCase() })} className="h-9 text-xs" />
                  <Input placeholder={linked ? "CPF / CNPJ" : "CPF / CNPJ *"} value={form.PESS_CPFCNPJ || ""}
                    onChange={(e) => setForm({ ...form, PESS_CPFCNPJ: e.target.value })} className="h-9 text-xs" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-medium text-muted-foreground uppercase">Contato</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Phone className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9 h-9 text-xs" placeholder="CELULAR" value={form.PESS_FONE_CELULAR || ""}
                      onChange={(e) => setForm({ ...form, PESS_FONE_CELULAR: e.target.value })} />
                  </div>
                  <div className="relative">
                    <Phone className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9 h-9 text-xs" placeholder="TELEFONE" value={form.PESS_FONE || ""}
                      onChange={(e) => setForm({ ...form, PESS_FONE: e.target.value })} />
                  </div>
                </div>
                <div className="relative">
                  <Mail className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9 h-9 text-xs" placeholder="E-MAIL" value={form.PESS_EMAIL || ""}
                    onChange={(e) => setForm({ ...form, PESS_EMAIL: e.target.value.toUpperCase() })} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Endereço
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input className="col-span-2 h-9 text-xs" placeholder="LOGRADOURO" value={form.ENDE_LOGRADOURO || ""}
                    onChange={(e) => setForm({ ...form, ENDE_LOGRADOURO: e.target.value.toUpperCase() })} />
                  <Input className="h-9 text-xs" placeholder="NÚMERO" value={form.ENDE_NUMERO || ""}
                    onChange={(e) => setForm({ ...form, ENDE_NUMERO: e.target.value.toUpperCase() })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input className="h-9 text-xs" placeholder="CEP" value={form.ENDE_CEP || ""}
                    onChange={(e) => setForm({ ...form, ENDE_CEP: e.target.value })} />
                  <Input className="h-9 text-xs" placeholder="BAIRRO" value={form.BAIR_NOME || ""}
                    onChange={(e) => setForm({ ...form, BAIR_NOME: e.target.value.toUpperCase() })} />
                  <Input className="h-9 text-xs" placeholder="MUNICÍPIO" value={form.MUNI_NOME || ""}
                    onChange={(e) => setForm({ ...form, MUNI_NOME: e.target.value.toUpperCase() })} />
                </div>
              </div>
            </section>
          )}
        </div>

        <DialogFooter className="border-t bg-muted/30 px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {(showForm || !linked) && (
            <Button onClick={salvarCliente} disabled={busy} className="gap-2">
              <Save className="h-4 w-4" /> {linked ? "Atualizar cliente" : "Salvar e vincular"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
