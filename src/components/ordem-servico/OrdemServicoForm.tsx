import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Wrench, Save, CheckCircle, XCircle, Printer, Send,
  Loader2, FileText, Users, ClipboardList, MessageSquare, ArrowLeft, Car, User
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ClienteSection } from './ClienteSection';
import { VeiculoSection } from './VeiculoSection';
import { ItensTable } from './ItensTable';
import { ResumoFinanceiro } from './ResumoFinanceiro';
import { AutocompleteInput } from './AutocompleteInput';
import {
  getTiposOrdemServicos, getVendedores, getTecnicos, getMidias,
  setOrdemServico as saveOS, getPessoasVeiculos,
  type Cliente, type Veiculo, type ItemOS, type TipoOS,
  type Vendedor, type Tecnico, type Midia, type OrdemServicoFull,
  type PessoaVeiculo
} from '@/lib/api-os';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface OrdemServicoFormProps {
  onBack: () => void;
}

export default function OrdemServicoForm({ onBack }: OrdemServicoFormProps) {
  const { auth } = useAuth();

  const [tiposOS, setTiposOS] = useState<TipoOS[]>([]);
  const [tipoOS, setTipoOS] = useState('');
  const [numeroOS, setNumeroOS] = useState('NOVA');
  const [statusOS, setStatusOS] = useState('Aberto');
  const [hodometro, setHodometro] = useState('');

  const [cliente, setClienteState] = useState<Cliente | null>(null);
  const [veiculo, setVeiculoState] = useState<Veiculo | null>(null);
  const [itens, setItens] = useState<ItemOS[]>([]);

  const [vendedorText, setVendedorText] = useState('');
  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [tecnicoText, setTecnicoText] = useState('');
  const [tecnico, setTecnico] = useState<Tecnico | null>(null);

  const [midias, setMidias] = useState<Midia[]>([]);
  const [midiaId, setMidiaId] = useState('');
  const [loadingMidias, setLoadingMidias] = useState(false);

  const [observacoes, setObservacoes] = useState('');
  const [checklist, setChecklist] = useState('');

  const [saving, setSaving] = useState(false);
  const [loadingTipos, setLoadingTipos] = useState(false);

  // Cross-link selection dialog state
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
  const [selectionDialogType, setSelectionDialogType] = useState<'veiculo' | 'cliente'>('veiculo');
  const [selectionDialogItems, setSelectionDialogItems] = useState<PessoaVeiculo[]>([]);
  const [loadingCrossLink, setLoadingCrossLink] = useState(false);

  // Refs to prevent re-triggering cross-link
  const skipVeiculoCrossLinkRef = useRef(false);
  const skipClienteCrossLinkRef = useRef(false);

  useEffect(() => {
    setLoadingTipos(true);
    getTiposOrdemServicos()
      .then((tipos) => {
        setTiposOS(tipos);
        const padrao = tipos.find((t) => (t.TPOS_PADRAO || '').toUpperCase() === 'SIM');
        if (padrao) setTipoOS(padrao.TPOS_ID);
      })
      .catch(() => {})
      .finally(() => setLoadingTipos(false));

    setLoadingMidias(true);
    getMidias({})
      .then(setMidias)
      .catch(() => {})
      .finally(() => setLoadingMidias(false));

    // Auto-set vendedor from logged user's PESS_ID
    const pessId = auth?.user?.pess_ID;
    if (pessId) {
      getVendedores({ id: pessId })
        .then((r: any[]) => {
          if (r.length > 0) {
            const v = r[0];
            const id = v.VDDR_ID || v.vDDR_ID || '';
            const nome = v.VDDR_NOME || v.vDDR_NOME || v.PESS_NOME || v.pESS_NOME || '';
            if (id) {
              setVendedor({ VDDR_ID: id, VDDR_NOME: nome });
              setVendedorText(nome);
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  // When cliente is selected and no veiculo → fetch vehicles
  const handleClienteSelect = useCallback(async (c: Cliente) => {
    setClienteState(c);

    if (skipClienteCrossLinkRef.current) {
      skipClienteCrossLinkRef.current = false;
      return;
    }

    // Only auto-fetch if no veiculo is selected yet
    if (veiculo) return;

    setLoadingCrossLink(true);
    try {
      const results = await getPessoasVeiculos({ pess_id: c.PESS_ID });
      if (results.length === 1 && results[0].VEIC_ID) {
        skipVeiculoCrossLinkRef.current = true;
        setVeiculoState({
          VEIC_ID: results[0].VEIC_ID,
          VEIC_PLACA: results[0].VEIC_PLACA || '',
          VEIC_MARCA: results[0].VEIC_MARCA,
          VEIC_MODELO: results[0].VEIC_MODELO,
          VEIC_ANO: results[0].VEIC_ANO,
          VEIC_COR: results[0].VEIC_COR,
          VEIC_KM: results[0].VEIC_KM,
          PESS_ID: c.PESS_ID,
        });
        toast.info('Veículo do cliente selecionado automaticamente');
      } else if (results.length > 1) {
        setSelectionDialogType('veiculo');
        setSelectionDialogItems(results);
        setSelectionDialogOpen(true);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingCrossLink(false);
    }
  }, [veiculo]);

  // When veiculo is selected and no cliente → fetch owners
  const handleVeiculoSelect = useCallback(async (v: Veiculo) => {
    setVeiculoState(v);

    if (skipVeiculoCrossLinkRef.current) {
      skipVeiculoCrossLinkRef.current = false;
      return;
    }

    // Only auto-fetch if no cliente is selected yet
    if (cliente) return;

    setLoadingCrossLink(true);
    try {
      const results = await getPessoasVeiculos({ veic_id: v.VEIC_ID });
      if (results.length === 1 && results[0].PESS_ID) {
        skipClienteCrossLinkRef.current = true;
        setClienteState({
          PESS_ID: results[0].PESS_ID,
          PESS_NOME: results[0].PESS_NOME || '',
          PESS_CPFCNPJ: results[0].PESS_CPFCNPJ || '',
        });
        toast.info('Cliente do veículo selecionado automaticamente');
      } else if (results.length > 1) {
        setSelectionDialogType('cliente');
        setSelectionDialogItems(results);
        setSelectionDialogOpen(true);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingCrossLink(false);
    }
  }, [cliente]);

  const handleCrossLinkSelect = (item: PessoaVeiculo) => {
    if (selectionDialogType === 'veiculo' && item.VEIC_ID) {
      skipVeiculoCrossLinkRef.current = true;
      setVeiculoState({
        VEIC_ID: item.VEIC_ID,
        VEIC_PLACA: item.VEIC_PLACA || '',
        VEIC_MARCA: item.VEIC_MARCA,
        VEIC_MODELO: item.VEIC_MODELO,
        VEIC_ANO: item.VEIC_ANO,
        VEIC_COR: item.VEIC_COR,
        VEIC_KM: item.VEIC_KM,
        PESS_ID: item.PESS_ID,
      });
      toast.success('Veículo selecionado');
    } else if (selectionDialogType === 'cliente' && item.PESS_ID) {
      skipClienteCrossLinkRef.current = true;
      setClienteState({
        PESS_ID: item.PESS_ID,
        PESS_NOME: item.PESS_NOME || '',
        PESS_CPFCNPJ: item.PESS_CPFCNPJ || '',
      });
      toast.success('Cliente selecionado');
    }
    setSelectionDialogOpen(false);
    setSelectionDialogItems([]);
  };

  const fetchVendedores = useCallback(async (query: string) => {
    try {
      const r = await getVendedores({ nome: query });
      return r.map((v: any) => ({ id: v.VDDR_ID || v.vDDR_ID || v.Vddr_ID || '', label: v.VDDR_NOME || v.vDDR_NOME || v.PESS_NOME || v.pESS_NOME || '' }));
    } catch { return []; }
  }, []);

  const fetchTecnicos = useCallback(async (query: string) => {
    try {
      const r = await getTecnicos({ nome: query });
      return r.map((t) => ({ id: t.TCNC_ID, label: t.TCNC_NOME }));
    } catch { return []; }
  }, []);

  const subtotal = itens.reduce((s, i) => s + (i.ITOS_QTDE * i.ITOS_VLR_UNITARIO), 0);
  const descontoTotal = itens.reduce((s, i) => s + i.ITOS_DESCONTO, 0);
  const totalFinal = Math.max(0, subtotal - descontoTotal);

  const handleSave = async (finalizar = false) => {
    if (!cliente) { toast.error('Selecione um cliente'); return; }
    if (!veiculo) { toast.error('Selecione um veículo'); return; }

    setSaving(true);
    try {
      const payload: Partial<OrdemServicoFull> = {
        TPOS_ID: tipoOS || undefined,
        PESS_ID: cliente.PESS_ID,
        VEIC_ID: veiculo.VEIC_ID,
        VDDR_ID: vendedor?.VDDR_ID,
        TCNC_ID: tecnico?.TCNC_ID,
        MDIA_ID: midiaId || undefined,
        ORSV_OBSERVACOES: observacoes,
        ORSV_NR_CHECKLIST: checklist,
        ORSV_HODOMETRO: hodometro,
        ORSV_VLR_SUBTOTAL: subtotal,
        ORSV_VLR_DESCONTO: descontoTotal,
        ORSV_VLR_TOTAL: totalFinal,
        ORSV_STATUS: finalizar ? 'Finalizado' : 'Aberto',
        UNEM_ID: auth?.unidade?.unem_Id,
        itens,
      };
      console.log('=== PAYLOAD OS ===', JSON.stringify(payload, null, 2));
      const result = await saveOS(payload);
      if (result.ORSV_NUMERO) setNumeroOS(result.ORSV_NUMERO);
      setStatusOS(finalizar ? 'Finalizado' : 'Aberto');
      toast.success(finalizar ? 'OS finalizada com sucesso!' : 'OS salva com sucesso!');
    } catch (e: any) {
      toast.error('Erro ao salvar OS: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const statusColors: Record<string, string> = {
    Aberto: 'bg-primary/15 text-primary border-primary/30',
    Finalizado: 'bg-accent/15 text-accent border-accent/30',
    Cancelado: 'bg-destructive/15 text-destructive border-destructive/30',
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Wrench className="h-6 w-6" /> Nova Ordem de Serviço
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Cadastro de OS para manutenção de veículos</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Nº OS</div>
            <div className="text-lg font-bold font-mono text-foreground">{numeroOS}</div>
          </div>
          <Badge className={`${statusColors[statusOS] || 'bg-muted text-muted-foreground'} border text-xs px-3 py-1`}>
            {statusOS}
          </Badge>
        </div>
      </div>

      {/* Cliente + Veículo FIRST */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ClienteSection cliente={cliente} onSelect={handleClienteSelect} />
        <VeiculoSection
          veiculo={veiculo}
          clienteId={cliente?.PESS_ID || null}
          onSelect={handleVeiculoSelect}
          hodometro={hodometro}
          onHodometroChange={setHodometro}
        />
      </div>

      {/* Loading cross-link indicator */}
      {loadingCrossLink && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground px-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Buscando vínculos...
        </div>
      )}

      {/* Dados da OS (Tipo + Origem + Status) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Dados da OS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo de OS</Label>
              <Select value={tipoOS} onValueChange={setTipoOS}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={loadingTipos ? 'Carregando...' : 'Selecione o tipo'} />
                </SelectTrigger>
                <SelectContent>
                  {tiposOS.map((t) => (
                    <SelectItem key={t.TPOS_ID} value={t.TPOS_ID}>{t.TPOS_NOME}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Origem do Cliente</Label>
              <Select value={midiaId} onValueChange={setMidiaId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={loadingMidias ? 'Carregando...' : 'Selecione a mídia'} />
                </SelectTrigger>
                <SelectContent>
                  {midias.map((m) => (
                    <SelectItem key={m.MDIA_ID} value={m.MDIA_ID}>{m.MDIA_NOME}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Itens */}
      <ItensTable itens={itens} onChange={setItens} unemId={auth?.unidade?.unem_Id} />

      {/* Equipe + Resumo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Equipe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Vendedor</Label>
              <AutocompleteInput
                placeholder="Buscar vendedor..."
                value={vendedorText}
                onChange={setVendedorText}
                onSelect={(opt) => { setVendedor({ VDDR_ID: opt.id, VDDR_NOME: opt.label }); setVendedorText(opt.label); }}
                fetchOptions={fetchVendedores}
              />
            </div>
            <div>
              <Label className="text-xs">Técnico</Label>
              <AutocompleteInput
                placeholder="Buscar técnico..."
                value={tecnicoText}
                onChange={setTecnicoText}
                onSelect={(opt) => { setTecnico({ TCNC_ID: opt.id, TCNC_NOME: opt.label }); setTecnicoText(opt.label); }}
                fetchOptions={fetchTecnicos}
              />
            </div>
          </CardContent>
        </Card>

        <ResumoFinanceiro itens={itens} />
      </div>

      {/* Info Adicional */}
      <Card>
        <CardContent className="p-4">
          <Tabs defaultValue="observacoes">
            <TabsList className="mb-3">
              <TabsTrigger value="observacoes" className="text-xs gap-1">
                <MessageSquare className="h-3.5 w-3.5" /> Problema Relatado
              </TabsTrigger>
              <TabsTrigger value="checklist" className="text-xs gap-1">
                <ClipboardList className="h-3.5 w-3.5" /> Checklist
              </TabsTrigger>
            </TabsList>
            <TabsContent value="observacoes">
              <Textarea placeholder="Descreva o problema relatado pelo cliente..." value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="min-h-[100px] text-sm" />
            </TabsContent>
            <TabsContent value="checklist">
              <Textarea placeholder="Nº Checklist ou observações do checklist..." value={checklist} onChange={(e) => setChecklist(e.target.value)} className="min-h-[100px] text-sm" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex items-center justify-between bg-card border rounded-lg p-4 sticky bottom-0 shadow-lg">
        <div className="text-sm text-muted-foreground">
          Total: <span className="text-lg font-bold text-primary ml-1">{formatCurrency(totalFinal)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack} disabled={saving}>
            <XCircle className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button variant="outline" size="sm" disabled={saving}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
          <Button variant="outline" size="sm" disabled={saving}>
            <Send className="h-4 w-4 mr-1" /> WhatsApp
          </Button>
          <Button size="sm" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar
          </Button>
          <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => handleSave(true)} disabled={saving}>
            <CheckCircle className="h-4 w-4 mr-1" /> Finalizar OS
          </Button>
        </div>
      </div>

      {/* Cross-link Selection Dialog */}
      <Dialog open={selectionDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setSelectionDialogOpen(false);
          setSelectionDialogItems([]);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectionDialogType === 'veiculo' ? (
                <><Car className="h-5 w-5 text-primary" /> Selecione o Veículo</>
              ) : (
                <><User className="h-5 w-5 text-primary" /> Selecione o Cliente</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {selectionDialogItems.map((item, idx) => (
              <button
                key={idx}
                className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => handleCrossLinkSelect(item)}
              >
                {selectionDialogType === 'veiculo' ? (
                  <div>
                    <span className="font-mono font-semibold text-sm text-foreground">{item.VEIC_PLACA}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {[item.VEIC_MARCA, item.VEIC_MODELO, item.VEIC_ANO, item.VEIC_COR].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="font-semibold text-sm text-foreground">{item.PESS_NOME}</span>
                    {item.PESS_CPFCNPJ && (
                      <span className="text-xs text-muted-foreground ml-2">{item.PESS_CPFCNPJ}</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => {
              setSelectionDialogOpen(false);
              setSelectionDialogItems([]);
            }}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
