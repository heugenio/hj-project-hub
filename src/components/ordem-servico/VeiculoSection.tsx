import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AutocompleteInput } from './AutocompleteInput';
import { getVeiculos, setVeiculo, getMarcasVeiculo, getModelosVeiculo, type Veiculo, type MarcaVeiculo, type ModeloVeiculo } from '@/lib/api-os';
import { Car, Plus, Gauge } from 'lucide-react';
import { toast } from 'sonner';

interface VeiculoSectionProps {
  veiculo: Veiculo | null;
  clienteId: string | null;
  onSelect: (veiculo: Veiculo) => void;
  hodometro: string;
  onHodometroChange: (value: string) => void;
}

export function VeiculoSection({ veiculo, clienteId, onSelect, hodometro, onHodometroChange }: VeiculoSectionProps) {
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Veiculo>>({});
  const [marcas, setMarcas] = useState<MarcaVeiculo[]>([]);
  const [modelos, setModelos] = useState<ModeloVeiculo[]>([]);
  const [loadingMarcas, setLoadingMarcas] = useState(false);

  const fetchVeiculos = useCallback(async (query: string) => {
    try {
      const results = await getVeiculos({ placa: query });
      return results.map((v) => ({
        id: v.VEIC_ID,
        label: v.VEIC_PLACA,
        sublabel: `${v.VEIC_MARCA || ''} ${v.VEIC_MODELO || ''} ${v.VEIC_COR || ''}`.trim(),
      }));
    } catch {
      return [];
    }
  }, []);

  const handleSelectVeiculo = useCallback(async (opt: { id: string }) => {
    try {
      const results = await getVeiculos({ id: opt.id });
      if (results.length > 0) {
        onSelect(results[0]);
        setSearchText(results[0].VEIC_PLACA);
      }
    } catch {
      toast.error('Erro ao carregar veículo');
    }
  }, [onSelect]);

  const loadMarcas = async () => {
    setLoadingMarcas(true);
    try {
      const result = await getMarcasVeiculo();
      setMarcas(result);
    } catch { /* silently fail */ }
    setLoadingMarcas(false);
  };

  const loadModelos = async (marcaId: string) => {
    try {
      const result = await getModelosVeiculo(marcaId);
      setModelos(result);
    } catch {
      setModelos([]);
    }
  };

  useEffect(() => {
    if (modalOpen && marcas.length === 0) loadMarcas();
  }, [modalOpen]);

  const handleSaveVeiculo = async () => {
    if (!form.VEIC_PLACA) {
      toast.error('Placa é obrigatória');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, PESS_ID: clienteId || undefined };
      const result = await setVeiculo(payload);
      onSelect(result);
      setSearchText(result.VEIC_PLACA);
      setModalOpen(false);
      setForm({});
      toast.success('Veículo cadastrado com sucesso!');
    } catch (e: any) {
      toast.error('Erro ao salvar veículo: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Car className="h-4 w-4 text-primary" />
            Veículo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <AutocompleteInput
              placeholder="Buscar por placa..."
              value={searchText}
              onChange={setSearchText}
              onSelect={handleSelectVeiculo}
              fetchOptions={fetchVeiculos}
              className="flex-1"
              minChars={3}
            />
            <Button size="sm" variant="outline" onClick={() => setModalOpen(true)} className="shrink-0">
              <Plus className="h-4 w-4 mr-1" /> Novo
            </Button>
          </div>
          <div>
            <Label className="text-xs">Hodômetro (Km)</Label>
            <div className="relative">
              <Gauge className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={hodometro} onChange={(e) => onHodometroChange(e.target.value)} className="h-9 text-sm pl-8" placeholder="Km atual do veículo" />
            </div>
          </div>
          {veiculo && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <Badge className="bg-primary/10 text-primary font-mono text-sm border-0">{veiculo.VEIC_PLACA}</Badge>
                <span className="text-xs text-muted-foreground">{veiculo.VEIC_ANO}</span>
              </div>
              <div className="text-sm font-medium text-foreground">
                {veiculo.VEIC_MARCA} {veiculo.VEIC_MODELO}
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                {veiculo.VEIC_COR && <span>Cor: {veiculo.VEIC_COR}</span>}
                {veiculo.VEIC_KM && (
                  <span className="flex items-center gap-1"><Gauge className="h-3 w-3" />{veiculo.VEIC_KM} km</span>
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
              <Car className="h-5 w-5 text-primary" /> Novo Veículo
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Placa *</Label>
              <Input
                value={form.VEIC_PLACA || ''}
                onChange={(e) => setForm((f) => ({ ...f, VEIC_PLACA: e.target.value.toUpperCase().slice(0, 7) }))}
                className="h-9 text-sm font-mono uppercase"
                maxLength={7}
              />
            </div>
            <div>
              <Label className="text-xs">Ano</Label>
              <Input value={form.VEIC_ANO || ''} onChange={(e) => setForm((f) => ({ ...f, VEIC_ANO: e.target.value }))} className="h-9 text-sm" maxLength={4} />
            </div>
            <div>
              <Label className="text-xs">Marca</Label>
              <Select
                value={form.MARC_VEIC_ID || ''}
                onValueChange={(v) => {
                  setForm((f) => ({ ...f, MARC_VEIC_ID: v, MODL_VEIC_ID: '' }));
                  loadModelos(v);
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={loadingMarcas ? 'Carregando...' : 'Selecione'} />
                </SelectTrigger>
                <SelectContent>
                  {marcas.map((m) => (
                    <SelectItem key={m.MARC_VEIC_ID} value={m.MARC_VEIC_ID}>{m.MARC_VEIC_NOME}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Modelo</Label>
              <Select
                value={form.MODL_VEIC_ID || ''}
                onValueChange={(v) => setForm((f) => ({ ...f, MODL_VEIC_ID: v }))}
                disabled={!form.MARC_VEIC_ID}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {modelos.map((m) => (
                    <SelectItem key={m.MODL_VEIC_ID} value={m.MODL_VEIC_ID}>{m.MODL_VEIC_NOME}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cor</Label>
              <Input value={form.VEIC_COR || ''} onChange={(e) => setForm((f) => ({ ...f, VEIC_COR: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Km</Label>
              <Input value={form.VEIC_KM || ''} onChange={(e) => setForm((f) => ({ ...f, VEIC_KM: e.target.value }))} className="h-9 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} size="sm">Cancelar</Button>
            <Button onClick={handleSaveVeiculo} disabled={saving} size="sm">
              {saving ? 'Salvando...' : 'Salvar e Selecionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
