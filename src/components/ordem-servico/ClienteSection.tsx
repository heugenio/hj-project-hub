import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AutocompleteInput } from './AutocompleteInput';
import { getClientes, setCliente, type Cliente } from '@/lib/api-os';
import { UserPlus, User, Phone, Mail, MapPin, Pencil } from 'lucide-react';
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

export function ClienteSection({ cliente, onSelect }: ClienteSectionProps) {
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
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
                {(cliente.PESS_ENDERECO || cliente.PESS_CIDADE) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {[cliente.PESS_ENDERECO, cliente.PESS_CIDADE, cliente.PESS_UF].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Nome *</Label>
              <Input value={form.PESS_NOME || ''} onChange={(e) => setForm((f) => ({ ...f, PESS_NOME: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">CPF/CNPJ *</Label>
              <Input
                value={form.PESS_CPFCNPJ || ''}
                onChange={(e) => setForm((f) => ({ ...f, PESS_CPFCNPJ: e.target.value.replace(/\D/g, '').slice(0, 14) }))}
                placeholder="Somente números"
                className="h-9 text-sm font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={form.PESS_FONE || ''} onChange={(e) => setForm((f) => ({ ...f, PESS_FONE: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">E-mail</Label>
              <Input value={form.PESS_EMAIL || ''} onChange={(e) => setForm((f) => ({ ...f, PESS_EMAIL: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Cidade</Label>
              <Input value={form.PESS_CIDADE || ''} onChange={(e) => setForm((f) => ({ ...f, PESS_CIDADE: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">UF</Label>
              <Input value={form.PESS_UF || ''} onChange={(e) => setForm((f) => ({ ...f, PESS_UF: e.target.value.toUpperCase().slice(0, 2) }))} className="h-9 text-sm" maxLength={2} />
            </div>
          </div>
          <DialogFooter>
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
