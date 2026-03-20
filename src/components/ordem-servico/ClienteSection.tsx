import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AutocompleteInput } from './AutocompleteInput';
import { getClientes, setCliente, type Cliente } from '@/lib/api-os';
import { UserPlus, User, Phone, Mail, MapPin, Pencil, Search, Loader2, FileText, Building2, Home } from 'lucide-react';
import { toast } from 'sonner';

interface ClienteSectionProps {
  cliente: Cliente | null;
  onSelect: (cliente: Cliente) => void;
}

function maskCpfCnpj(v: string): string {
  const nums = v.replace(/\D/g, '');
  if (nums.length <= 11) {
    return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function maskCep(v: string): string {
  const nums = v.replace(/\D/g, '').slice(0, 8);
  if (nums.length > 5) return nums.replace(/(\d{5})(\d{1,3})/, '$1-$2');
  return nums;
}

const TIPOS_LOGRADOURO = ['Rua', 'Avenida', 'Travessa', 'Alameda', 'Praça', 'Rodovia', 'Estrada', 'Viela', 'Largo', 'Outro'];

async function buscarCep(cep: string): Promise<{
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
} | null> {
  const nums = cep.replace(/\D/g, '');
  if (nums.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${nums}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
}

export function ClienteSection({ cliente, onSelect }: ClienteSectionProps) {
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [form, setForm] = useState<Partial<Cliente>>({});
  const clientesCacheRef = useRef<Record<string, Cliente>>({});

  const fetchClientes = useCallback(async (query: string) => {
    try {
      const isDoc = /^\d/.test(query.replace(/\D/g, ''));
      const results = await getClientes(isDoc ? { cpfcnpj: query } : { nome: query });
      const nextCache = { ...clientesCacheRef.current };
      results.forEach((c) => {
        if (c.PESS_ID) nextCache[c.PESS_ID] = c;
      });
      clientesCacheRef.current = nextCache;
      return results.map((c) => ({
        id: c.PESS_ID,
        label: c.PESS_NOME,
        sublabel: maskCpfCnpj(c.PESS_CPFCNPJ || ''),
      }));
    } catch {
      return [];
    }
  }, []);

  const handleSelectCliente = useCallback(async (opt: { id: string; label?: string }) => {
    try {
      const cached = clientesCacheRef.current[opt.id];
      if (cached) {
        onSelect(cached);
        setSearchText(cached.PESS_NOME);
        return;
      }
      const byId = await getClientes({ id: opt.id });
      if (byId.length > 0) {
        onSelect(byId[0]);
        setSearchText(byId[0].PESS_NOME);
        clientesCacheRef.current[byId[0].PESS_ID] = byId[0];
        return;
      }
      if (opt.label) {
        const byName = await getClientes({ nome: opt.label });
        const fallback = byName.find((c) => c.PESS_ID === opt.id) ?? byName[0];
        if (fallback) {
          onSelect(fallback);
          setSearchText(fallback.PESS_NOME);
          clientesCacheRef.current[fallback.PESS_ID] = fallback;
          return;
        }
      }
      toast.error('Não foi possível selecionar este cliente.');
    } catch {
      toast.error('Erro ao carregar cliente');
    }
  }, [onSelect]);

  const handleCepBlur = async () => {
    const cep = form.ENDE_CEP?.replace(/\D/g, '') || '';
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const data = await buscarCep(cep);
      if (data) {
        // Separar tipo de logradouro do logradouro (ex: "Rua das Flores" -> tipo="Rua", logradouro="das Flores")
        let tipoLog = '';
        let logradouro = data.logradouro || '';
        const tiposConhecidos = ['Rua', 'Avenida', 'Travessa', 'Alameda', 'Praça', 'Rodovia', 'Estrada', 'Viela', 'Largo'];
        for (const tipo of tiposConhecidos) {
          if (logradouro.startsWith(tipo + ' ')) {
            tipoLog = tipo;
            logradouro = logradouro.substring(tipo.length + 1);
            break;
          }
        }
        setForm((f) => ({
          ...f,
          ENDE_TIPO_LOGRADOURO: tipoLog || f.ENDE_TIPO_LOGRADOURO,
          ENDE_LOGRADOURO: logradouro || f.ENDE_LOGRADOURO,
          ENDE_COMPLEMENTO: data.complemento || f.ENDE_COMPLEMENTO,
          BAIR_NOME: data.bairro || f.BAIR_NOME,
          MUNI_NOME: data.localidade || f.MUNI_NOME,
          ESTA_NOME: data.uf || f.ESTA_NOME,
          PESS_UF: data.uf || f.PESS_UF,
          PESS_CIDADE: data.localidade || f.PESS_CIDADE,
        }));
        toast.success('CEP encontrado!');
      } else {
        toast.error('CEP não encontrado');
      }
    } catch {
      toast.error('Erro ao buscar CEP');
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleSaveCliente = async () => {
    if (!form.PESS_NOME || !form.PESS_CPFCNPJ) {
      toast.error('Nome e CPF/CNPJ são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const result = await setCliente(form);
      onSelect(result);
      setSearchText(result.PESS_NOME);
      setModalOpen(false);
      setIsEditing(false);
      setForm({});
      toast.success(isEditing ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!');
    } catch (e: any) {
      toast.error('Erro ao salvar cliente: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditCliente = () => {
    if (!cliente) return;
    setForm({ ...cliente });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleOpenNew = () => {
    setForm({});
    setIsEditing(false);
    setModalOpen(true);
  };

  const updateField = (field: keyof Cliente) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const enderecoCompleto = [
    cliente?.ENDE_TIPO_LOGRADOURO,
    cliente?.ENDE_LOGRADOURO,
    cliente?.ENDE_NUMERO && `nº ${cliente.ENDE_NUMERO}`,
    cliente?.ENDE_COMPLEMENTO,
    cliente?.BAIR_NOME,
    cliente?.MUNI_NOME || cliente?.PESS_CIDADE,
    cliente?.ESTA_NOME || cliente?.PESS_UF,
    cliente?.ENDE_CEP && `CEP ${maskCep(cliente.ENDE_CEP)}`,
  ].filter(Boolean).join(', ');

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <AutocompleteInput
              placeholder="Buscar por nome ou CPF/CNPJ..."
              value={searchText}
              onChange={setSearchText}
              onSelect={handleSelectCliente}
              fetchOptions={fetchClientes}
              className="flex-1"
            />
            <Button size="sm" variant="outline" onClick={handleOpenNew} className="shrink-0">
              <UserPlus className="h-4 w-4 mr-1" /> Novo
            </Button>
          </div>
          {cliente && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-foreground">{cliente.PESS_NOME}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs font-mono">
                    {maskCpfCnpj(cliente.PESS_CPFCNPJ || '')}
                  </Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleEditCliente} title="Editar cliente">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground">
                {cliente.PESS_FONE && (
                  <span className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" />{cliente.PESS_FONE}</span>
                )}
                {cliente.PESS_EMAIL && (
                  <span className="flex items-center gap-1.5"><Mail className="h-3 w-3 shrink-0" />{cliente.PESS_EMAIL}</span>
                )}
                {enderecoCompleto && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {enderecoCompleto}
                  </span>
                )}
                {(cliente.DOCS_RG || cliente.DOCS_IE || cliente.DOCS_ICMUNI) && (
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3 w-3 shrink-0" />
                    {[
                      cliente.DOCS_RG && `RG: ${cliente.DOCS_RG}`,
                      cliente.DOCS_IE && `IE: ${cliente.DOCS_IE}`,
                      cliente.DOCS_ICMUNI && `IM: ${cliente.DOCS_ICMUNI}`,
                    ].filter(Boolean).join(' | ')}
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Card: Dados Pessoais */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Dados Pessoais
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Nome *</Label>
                  <Input value={form.PESS_NOME || ''} onChange={updateField('PESS_NOME')} className="h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">CPF/CNPJ *</Label>
                  <Input
                    value={maskCpfCnpj(form.PESS_CPFCNPJ || '')}
                    onChange={(e) => setForm((f) => ({ ...f, PESS_CPFCNPJ: e.target.value.replace(/\D/g, '').slice(0, 14) }))}
                    placeholder="Somente números"
                    className="h-9 text-sm font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs">Telefone</Label>
                  <Input value={form.PESS_FONE || ''} onChange={updateField('PESS_FONE')} className="h-9 text-sm" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">E-mail</Label>
                  <Input value={form.PESS_EMAIL || ''} onChange={updateField('PESS_EMAIL')} type="email" className="h-9 text-sm" />
                </div>
              </div>
            </div>

            {/* Card: Endereço */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5" /> Endereço
              </h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <Label className="text-xs">CEP</Label>
                  <div className="relative">
                    <Input
                      value={maskCep(form.ENDE_CEP || '')}
                      onChange={(e) => setForm((f) => ({ ...f, ENDE_CEP: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                      onBlur={handleCepBlur}
                      placeholder="00000-000"
                      className="h-9 text-sm font-mono pr-8"
                    />
                    {buscandoCep ? (
                      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground cursor-pointer" onClick={handleCepBlur} />
                    )}
                  </div>
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">Tipo Logradouro</Label>
                  <Select
                    value={form.ENDE_TIPO_LOGRADOURO || ''}
                    onValueChange={(v) => setForm((f) => ({ ...f, ENDE_TIPO_LOGRADOURO: v }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_LOGRADOURO.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Logradouro</Label>
                  <Input value={form.ENDE_LOGRADOURO || ''} onChange={updateField('ENDE_LOGRADOURO')} className="h-9 text-sm" />
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">Número</Label>
                  <Input value={form.ENDE_NUMERO || ''} onChange={updateField('ENDE_NUMERO')} className="h-9 text-sm" />
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">Complemento</Label>
                  <Input value={form.ENDE_COMPLEMENTO || ''} onChange={updateField('ENDE_COMPLEMENTO')} className="h-9 text-sm" />
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">Bairro</Label>
                  <Input value={form.BAIR_NOME || ''} onChange={(e) => setForm((f) => ({ ...f, BAIR_NOME: e.target.value }))} className="h-9 text-sm" />
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">Zona</Label>
                  <Input value={form.ENDE_ZONA || ''} onChange={updateField('ENDE_ZONA')} className="h-9 text-sm" placeholder="Norte, Sul..." />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Município</Label>
                  <Input value={form.MUNI_NOME || ''} onChange={(e) => setForm((f) => ({ ...f, MUNI_NOME: e.target.value }))} className="h-9 text-sm" />
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">Estado</Label>
                  <Input value={form.ESTA_NOME || ''} onChange={(e) => setForm((f) => ({ ...f, ESTA_NOME: e.target.value.toUpperCase().slice(0, 2) }))} className="h-9 text-sm" maxLength={2} />
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">Observação</Label>
                  <Input value={form.ENDE_OBSERVACAO || ''} onChange={updateField('ENDE_OBSERVACAO')} className="h-9 text-sm" />
                </div>
              </div>
            </div>

            {/* Card: Documentos */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Documentos
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">RG</Label>
                  <Input value={form.DOCS_RG || ''} onChange={updateField('DOCS_RG')} className="h-9 text-sm" placeholder="Nº RG" />
                </div>
                <div>
                  <Label className="text-xs">Inscrição Estadual</Label>
                  <Input
                    value={form.DOCS_IE || ''}
                    onChange={(e) => setForm((f) => ({ ...f, DOCS_IE: e.target.value.replace(/[^0-9./-]/g, '') }))}
                    className="h-9 text-sm font-mono"
                    placeholder="Nº IE"
                  />
                </div>
                <div>
                  <Label className="text-xs">Inscrição Municipal</Label>
                  <Input
                    value={form.DOCS_ICMUNI || ''}
                    onChange={(e) => setForm((f) => ({ ...f, DOCS_ICMUNI: e.target.value.replace(/[^0-9./-]/g, '') }))}
                    className="h-9 text-sm font-mono"
                    placeholder="Nº IM"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} size="sm">Cancelar</Button>
            <Button onClick={handleSaveCliente} disabled={saving} size="sm">
              {saving ? 'Salvando...' : 'Salvar e Selecionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
