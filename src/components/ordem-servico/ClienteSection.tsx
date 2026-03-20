import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AutocompleteInput } from './AutocompleteInput';
import { getClientes, setCliente, type Cliente } from '@/lib/api-os';
import { UserPlus, User, Phone, Mail, MapPin, Pencil, Search, Loader2, FileText, Home } from 'lucide-react';
import { toast } from 'sonner';

interface ClienteSectionProps {
  cliente: Cliente | null;
  onSelect: (cliente: Cliente) => void;
}

// ===== Masks =====
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

function maskTelefone(v: string): string {
  const nums = v.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 10) {
    return nums.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
  }
  return nums.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
}

function validarEmail(email: string): boolean {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarTelefone(tel: string): boolean {
  if (!tel) return true;
  const nums = tel.replace(/\D/g, '');
  return nums.length >= 10 && nums.length <= 11;
}

const TIPOS_LOGRADOURO = ['Rua', 'Avenida', 'Travessa', 'Alameda', 'Praça', 'Rodovia', 'Estrada', 'Viela', 'Largo', 'Outro'];

const ESTADOS_BR = [
  { uf: 'AC', nome: 'Acre' }, { uf: 'AL', nome: 'Alagoas' }, { uf: 'AP', nome: 'Amapá' },
  { uf: 'AM', nome: 'Amazonas' }, { uf: 'BA', nome: 'Bahia' }, { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' }, { uf: 'ES', nome: 'Espírito Santo' }, { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' }, { uf: 'MT', nome: 'Mato Grosso' }, { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' }, { uf: 'PA', nome: 'Pará' }, { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PR', nome: 'Paraná' }, { uf: 'PE', nome: 'Pernambuco' }, { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' }, { uf: 'RN', nome: 'Rio Grande do Norte' },
  { uf: 'RS', nome: 'Rio Grande do Sul' }, { uf: 'RO', nome: 'Rondônia' }, { uf: 'RR', nome: 'Roraima' },
  { uf: 'SC', nome: 'Santa Catarina' }, { uf: 'SP', nome: 'São Paulo' }, { uf: 'SE', nome: 'Sergipe' },
  { uf: 'TO', nome: 'Tocantins' },
];

// ===== CEP API =====
async function buscarCep(cep: string) {
  const nums = cep.replace(/\D/g, '');
  if (nums.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${nums}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return data as {
      logradouro?: string; complemento?: string; bairro?: string;
      localidade?: string; uf?: string;
    };
  } catch { return null; }
}

// ===== IBGE API for Municipios =====
async function fetchMunicipios(uf: string): Promise<{ id: number; nome: string }[]> {
  if (!uf || uf.length !== 2) return [];
  try {
    const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
    return await res.json();
  } catch { return []; }
}

// ===== IBGE API for Distritos (bairros approximation) =====
async function fetchDistritos(municipioId: number): Promise<{ id: number; nome: string }[]> {
  if (!municipioId) return [];
  try {
    const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${municipioId}/distritos?orderBy=nome`);
    return await res.json();
  } catch { return []; }
}

// ===== ReceitaWS for CNPJ lookup =====
async function buscarCnpjWeb(cnpj: string) {
  const nums = cnpj.replace(/\D/g, '');
  if (nums.length !== 14) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${nums}`);
    if (!res.ok) return null;
    const d = await res.json();
    return {
      PESS_NOME: d.razao_social || d.nome_fantasia || '',
      PESS_FONE: d.ddd_telefone_1 ? `(${d.ddd_telefone_1.substring(0,2)}) ${d.ddd_telefone_1.substring(2)}` : '',
      PESS_EMAIL: d.email || '',
      ENDE_CEP: d.cep?.replace(/\D/g, '') || '',
      ENDE_LOGRADOURO: d.logradouro || '',
      ENDE_NUMERO: d.numero || '',
      ENDE_COMPLEMENTO: d.complemento || '',
      BAIR_NOME: d.bairro || '',
      MUNI_NOME: d.municipio || '',
      ESTA_NOME: d.uf || '',
      PESS_UF: d.uf || '',
      PESS_CIDADE: d.municipio || '',
    } as Partial<Cliente>;
  } catch { return null; }
}

export function ClienteSection({ cliente, onSelect }: ClienteSectionProps) {
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [form, setForm] = useState<Partial<Cliente>>({});
  const [emailError, setEmailError] = useState('');
  const [telefoneError, setTelefoneError] = useState('');
  const [municipios, setMunicipios] = useState<{ id: number; nome: string }[]>([]);
  const [distritos, setDistritos] = useState<{ id: number; nome: string }[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [loadingDistritos, setLoadingDistritos] = useState(false);
  const [selectedMunicipioId, setSelectedMunicipioId] = useState<number | null>(null);
  const clientesCacheRef = useRef<Record<string, Cliente>>({});

  // Load municipios when estado changes
  useEffect(() => {
    const uf = form.ESTA_NOME;
    if (uf && uf.length === 2) {
      setLoadingMunicipios(true);
      fetchMunicipios(uf).then((m) => {
        setMunicipios(m);
        // Try to find current municipio
        if (form.MUNI_NOME) {
          const found = m.find((x) => x.nome.toLowerCase() === form.MUNI_NOME!.toLowerCase());
          if (found) setSelectedMunicipioId(found.id);
        }
        setLoadingMunicipios(false);
      });
    } else {
      setMunicipios([]);
      setSelectedMunicipioId(null);
    }
  }, [form.ESTA_NOME]);

  // Load distritos when municipio changes
  useEffect(() => {
    if (selectedMunicipioId) {
      setLoadingDistritos(true);
      fetchDistritos(selectedMunicipioId).then((d) => {
        setDistritos(d);
        setLoadingDistritos(false);
      });
    } else {
      setDistritos([]);
    }
  }, [selectedMunicipioId]);

  const fetchClientesSearch = useCallback(async (query: string) => {
    try {
      const isDoc = /^\d/.test(query.replace(/\D/g, ''));
      const results = await getClientes(isDoc ? { cpfcnpj: query } : { nome: query });
      const nextCache = { ...clientesCacheRef.current };
      results.forEach((c) => { if (c.PESS_ID) nextCache[c.PESS_ID] = c; });
      clientesCacheRef.current = nextCache;
      return results.map((c) => ({
        id: c.PESS_ID,
        label: c.PESS_NOME,
        sublabel: maskCpfCnpj(c.PESS_CPFCNPJ || ''),
      }));
    } catch { return []; }
  }, []);

  const handleSelectCliente = useCallback(async (opt: { id: string; label?: string }) => {
    try {
      const cached = clientesCacheRef.current[opt.id];
      if (cached) { onSelect(cached); setSearchText(cached.PESS_NOME); return; }
      const byId = await getClientes({ id: opt.id });
      if (byId.length > 0) {
        onSelect(byId[0]); setSearchText(byId[0].PESS_NOME);
        clientesCacheRef.current[byId[0].PESS_ID] = byId[0]; return;
      }
      if (opt.label) {
        const byName = await getClientes({ nome: opt.label });
        const fallback = byName.find((c) => c.PESS_ID === opt.id) ?? byName[0];
        if (fallback) { onSelect(fallback); setSearchText(fallback.PESS_NOME); clientesCacheRef.current[fallback.PESS_ID] = fallback; return; }
      }
      toast.error('Não foi possível selecionar este cliente.');
    } catch { toast.error('Erro ao carregar cliente'); }
  }, [onSelect]);

  // Search by CPF/CNPJ in modal — auto-fill if found, else try web
  const handleCpfCnpjBlur = async () => {
    const nums = form.PESS_CPFCNPJ?.replace(/\D/g, '') || '';
    if (nums.length < 11) return;

    setBuscandoCnpj(true);
    try {
      // Try API first
      const results = await getClientes({ cpfcnpj: nums });
      if (results.length > 0) {
        const c = results[0];
        setForm({ ...c });
        setIsEditing(true);
        toast.success('Cliente encontrado!');
        setBuscandoCnpj(false);
        return;
      }

      // If CNPJ (14 digits), try web
      if (nums.length === 14) {
        const webData = await buscarCnpjWeb(nums);
        if (webData) {
          setForm((f) => ({ ...f, ...webData, PESS_CPFCNPJ: nums }));
          toast.success('Dados do CNPJ encontrados na web!');
          setBuscandoCnpj(false);
          return;
        }
      }

      toast.info('CPF/CNPJ não encontrado. Preencha os dados manualmente.');
    } catch {
      toast.error('Erro na busca');
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const handleCepBlur = async () => {
    const cep = form.ENDE_CEP?.replace(/\D/g, '') || '';
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const data = await buscarCep(cep);
      if (data) {
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
    if (!validarEmail(form.PESS_EMAIL || '')) {
      toast.error('E-mail inválido');
      return;
    }
    if (!validarTelefone(form.PESS_FONE || '')) {
      toast.error('Telefone inválido');
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
    setEmailError('');
    setTelefoneError('');
    setMunicipios([]);
    setDistritos([]);
    setSelectedMunicipioId(null);
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
              fetchOptions={fetchClientesSearch}
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
                  <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3 shrink-0" />{enderecoCompleto}</span>
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
            {/* Card: Dados Pessoais — CPF/CNPJ first */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Dados Pessoais
              </h3>
              <div className="grid grid-cols-6 gap-3">
                {/* CPF/CNPJ first */}
                <div className="col-span-2">
                  <Label className="text-xs">CPF/CNPJ *</Label>
                  <div className="relative">
                    <Input
                      value={maskCpfCnpj(form.PESS_CPFCNPJ || '')}
                      onChange={(e) => setForm((f) => ({ ...f, PESS_CPFCNPJ: e.target.value.replace(/\D/g, '').slice(0, 14) }))}
                      onBlur={handleCpfCnpjBlur}
                      placeholder="Digite CPF ou CNPJ"
                      className="h-9 text-sm font-mono pr-8"
                    />
                    {buscandoCnpj ? (
                      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground cursor-pointer" onClick={handleCpfCnpjBlur} />
                    )}
                  </div>
                </div>
                <div className="col-span-4">
                  <Label className="text-xs">Nome *</Label>
                  <Input value={form.PESS_NOME || ''} onChange={updateField('PESS_NOME')} className="h-9 text-sm" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Telefone</Label>
                  <Input
                    value={maskTelefone(form.PESS_FONE || '')}
                    onChange={(e) => {
                      const nums = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setForm((f) => ({ ...f, PESS_FONE: nums }));
                      setTelefoneError(nums && !validarTelefone(nums) ? 'Telefone inválido' : '');
                    }}
                    placeholder="(00) 00000-0000"
                    className={`h-9 text-sm ${telefoneError ? 'border-destructive' : ''}`}
                  />
                  {telefoneError && <span className="text-[10px] text-destructive">{telefoneError}</span>}
                </div>
                <div className="col-span-4">
                  <Label className="text-xs">E-mail</Label>
                  <Input
                    value={form.PESS_EMAIL || ''}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, PESS_EMAIL: e.target.value }));
                      setEmailError(e.target.value && !validarEmail(e.target.value) ? 'E-mail inválido' : '');
                    }}
                    onBlur={() => setEmailError(form.PESS_EMAIL && !validarEmail(form.PESS_EMAIL) ? 'E-mail inválido' : '')}
                    type="email"
                    placeholder="email@exemplo.com"
                    className={`h-9 text-sm ${emailError ? 'border-destructive' : ''}`}
                  />
                  {emailError && <span className="text-[10px] text-destructive">{emailError}</span>}
                </div>
              </div>
            </div>

            {/* Card: Endereço */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5" /> Endereço
              </h3>
              <div className="grid grid-cols-12 gap-3">
                {/* CEP */}
                <div className="col-span-3">
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
                {/* Tipo Logradouro */}
                <div className="col-span-3">
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
                {/* Logradouro */}
                <div className="col-span-6">
                  <Label className="text-xs">Logradouro</Label>
                  <Input value={form.ENDE_LOGRADOURO || ''} onChange={updateField('ENDE_LOGRADOURO')} className="h-9 text-sm" />
                </div>
                {/* Número (smaller) */}
                <div className="col-span-2">
                  <Label className="text-xs">Número</Label>
                  <Input value={form.ENDE_NUMERO || ''} onChange={updateField('ENDE_NUMERO')} className="h-9 text-sm" />
                </div>
                {/* Complemento (larger) */}
                <div className="col-span-5">
                  <Label className="text-xs">Complemento</Label>
                  <Input value={form.ENDE_COMPLEMENTO || ''} onChange={updateField('ENDE_COMPLEMENTO')} className="h-9 text-sm" />
                </div>
                {/* Observação (larger) */}
                <div className="col-span-5">
                  <Label className="text-xs">Observação</Label>
                  <Input value={form.ENDE_OBSERVACAO || ''} onChange={updateField('ENDE_OBSERVACAO')} className="h-9 text-sm" />
                </div>
                {/* Estado (Select) */}
                <div className="col-span-3">
                  <Label className="text-xs">Estado</Label>
                  <Select
                    value={form.ESTA_NOME || ''}
                    onValueChange={(v) => {
                      setForm((f) => ({ ...f, ESTA_NOME: v, PESS_UF: v, MUNI_NOME: '', BAIR_NOME: '' }));
                      setSelectedMunicipioId(null);
                      setDistritos([]);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_BR.map((e) => (
                        <SelectItem key={e.uf} value={e.uf}>{e.uf} - {e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Município (Select dependent on Estado) */}
                <div className="col-span-5">
                  <Label className="text-xs">Município {loadingMunicipios && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</Label>
                  {municipios.length > 0 ? (
                    <Select
                      value={form.MUNI_NOME || ''}
                      onValueChange={(v) => {
                        const mun = municipios.find((m) => m.nome === v);
                        setForm((f) => ({ ...f, MUNI_NOME: v, PESS_CIDADE: v, BAIR_NOME: '' }));
                        setSelectedMunicipioId(mun?.id || null);
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecione o município" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {municipios.map((m) => (
                          <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={form.MUNI_NOME || ''}
                      onChange={(e) => setForm((f) => ({ ...f, MUNI_NOME: e.target.value, PESS_CIDADE: e.target.value }))}
                      placeholder={form.ESTA_NOME ? 'Carregando...' : 'Selecione o estado primeiro'}
                      className="h-9 text-sm"
                      disabled={!form.ESTA_NOME}
                    />
                  )}
                </div>
                {/* Bairro (Select dependent on Município, fallback to input) */}
                <div className="col-span-4">
                  <Label className="text-xs">Bairro {loadingDistritos && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</Label>
                  {distritos.length > 1 ? (
                    <Select
                      value={form.BAIR_NOME || ''}
                      onValueChange={(v) => setForm((f) => ({ ...f, BAIR_NOME: v }))}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecione o bairro" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {distritos.map((d) => (
                          <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={form.BAIR_NOME || ''}
                      onChange={(e) => setForm((f) => ({ ...f, BAIR_NOME: e.target.value }))}
                      className="h-9 text-sm"
                      placeholder="Bairro"
                    />
                  )}
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
            <Button onClick={handleSaveCliente} disabled={saving || !!emailError || !!telefoneError} size="sm">
              {saving ? 'Salvando...' : 'Salvar e Selecionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
