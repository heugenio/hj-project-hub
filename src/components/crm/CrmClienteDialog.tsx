// Vincula uma oportunidade do CRM a um cliente cadastrado no sistema legado
// e permite criar / completar as informações cadastrais do cliente.
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Link2, UserPlus, Save, X, CheckCircle2 } from "lucide-react";
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
      // Pré-preenche formulário com dados do lead
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
    setBusy(true);
    try {
      const payload: Partial<Cliente> = {
        ...form,
        PESS_NOME: form.PESS_NOME?.toUpperCase().trim(),
        PESS_CPFCNPJ: onlyDigits(form.PESS_CPFCNPJ),
        PESS_FONE: onlyDigits(form.PESS_FONE),
        PESS_FONE_CELULAR: onlyDigits(form.PESS_FONE_CELULAR),
      };
      const saved = await setCliente(payload);
      const novo = (Array.isArray(saved) ? saved[0] : saved) as Cliente;
      if (!novo?.PESS_ID && linked?.PESS_ID) novo.PESS_ID = linked.PESS_ID;
      toast.success(linked ? "Cliente atualizado" : "Cliente cadastrado");
      if (novo?.PESS_ID) await vincularNoCrm(novo);
      else onLinked?.();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Cliente da oportunidade
          </DialogTitle>
        </DialogHeader>

        <div className="text-xs text-muted-foreground -mt-2 mb-1 truncate">
          {oportunidade.titulo}
        </div>

        {/* Status do vínculo */}
        {linked ? (
          <div className="flex items-center justify-between rounded-md border bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{linked.PESS_NOME}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  ID {linked.PESS_ID}
                  {linked.PESS_CPFCNPJ ? ` · ${linked.PESS_CPFCNPJ}` : ""}
                  {linked.PESS_FONE_CELULAR ? ` · ${linked.PESS_FONE_CELULAR}` : ""}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm((s) => !s)}>
                {showForm ? "Fechar" : "Completar dados"}
              </Button>
              <Button variant="ghost" size="sm" onClick={desvincular}>
                <X className="h-3.5 w-3.5 mr-1" /> Desvincular
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <Badge variant="outline" className="mr-2">Sem vínculo</Badge>
            Busque um cliente existente ou cadastre um novo a partir dos dados do lead.
          </div>
        )}

        {/* Busca */}
        {!linked && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="BUSCAR POR NOME OU CPF/CNPJ"
                  value={search}
                  onChange={(e) => setSearch(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") buscar(); }}
                />
              </div>
              <Button onClick={buscar} disabled={busy}>Buscar</Button>
              <Button variant="outline" onClick={() => setShowForm(true)}>
                <UserPlus className="h-4 w-4 mr-1" /> Novo
              </Button>
            </div>
            {results.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
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
          </div>
        )}

        {/* Formulário de criar / completar */}
        {(showForm || (!linked && results.length === 0)) && (
          <div className="space-y-2 border-t pt-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase">
              {linked ? "Completar informações" : "Cadastrar novo cliente"}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="NOME *" value={form.PESS_NOME || ""}
                onChange={(e) => setForm({ ...form, PESS_NOME: e.target.value.toUpperCase() })} />
              <Input placeholder="CPF / CNPJ" value={form.PESS_CPFCNPJ || ""}
                onChange={(e) => setForm({ ...form, PESS_CPFCNPJ: e.target.value })} />
              <Input placeholder="CELULAR" value={form.PESS_FONE_CELULAR || ""}
                onChange={(e) => setForm({ ...form, PESS_FONE_CELULAR: e.target.value })} />
              <Input placeholder="TELEFONE" value={form.PESS_FONE || ""}
                onChange={(e) => setForm({ ...form, PESS_FONE: e.target.value })} />
              <Input className="col-span-2" placeholder="E-MAIL" value={form.PESS_EMAIL || ""}
                onChange={(e) => setForm({ ...form, PESS_EMAIL: e.target.value.toUpperCase() })} />
              <Input className="col-span-2" placeholder="ENDEREÇO" value={form.ENDE_LOGRADOURO || ""}
                onChange={(e) => setForm({ ...form, ENDE_LOGRADOURO: e.target.value.toUpperCase() })} />
              <Input placeholder="NÚMERO" value={form.ENDE_NUMERO || ""}
                onChange={(e) => setForm({ ...form, ENDE_NUMERO: e.target.value.toUpperCase() })} />
              <Input placeholder="CEP" value={form.ENDE_CEP || ""}
                onChange={(e) => setForm({ ...form, ENDE_CEP: e.target.value })} />
              <Input placeholder="BAIRRO" value={form.BAIR_NOME || ""}
                onChange={(e) => setForm({ ...form, BAIR_NOME: e.target.value.toUpperCase() })} />
              <Input placeholder="MUNICÍPIO" value={form.MUNI_NOME || ""}
                onChange={(e) => setForm({ ...form, MUNI_NOME: e.target.value.toUpperCase() })} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {(showForm || !linked) && (
            <Button onClick={salvarCliente} disabled={busy}>
              <Save className="h-4 w-4 mr-1" /> {linked ? "Atualizar cliente" : "Salvar e vincular"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
