import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Wrench, Save, CheckCircle, XCircle, Printer, Send,
  Loader2, FileText, Users, Radio, ClipboardList, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ClienteSection } from '@/components/ordem-servico/ClienteSection';
import { VeiculoSection } from '@/components/ordem-servico/VeiculoSection';
import { ItensTable } from '@/components/ordem-servico/ItensTable';
import { ResumoFinanceiro } from '@/components/ordem-servico/ResumoFinanceiro';
import { AutocompleteInput } from '@/components/ordem-servico/AutocompleteInput';
import {
  getTiposOrdemServicos, getVendedores, getTecnicos, getMidias,
  setOrdemServico as saveOS,
  type Cliente, type Veiculo, type ItemOS, type TipoOS,
  type Vendedor, type Tecnico, type Midia, type OrdemServicoFull
} from '@/lib/api-os';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function OrdemServico() {
  const { auth } = useAuth();

  // OS header
  const [tiposOS, setTiposOS] = useState<TipoOS[]>([]);
  const [tipoOS, setTipoOS] = useState('');
  const [numeroOS, setNumeroOS] = useState('NOVA');
  const [statusOS, setStatusOS] = useState('Aberto');
  const [hodometro, setHodometro] = useState('');

  // Entities
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [itens, setItens] = useState<ItemOS[]>([]);

  // Equipe
  const [vendedorText, setVendedorText] = useState('');
  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [tecnicoText, setTecnicoText] = useState('');
  const [tecnico, setTecnico] = useState<Tecnico | null>(null);

  // Origem
  const [midiaText, setMidiaText] = useState('');
  const [midia, setMidia] = useState<Midia | null>(null);

  // Info adicional
  const [observacoes, setObservacoes] = useState('');
  const [checklist, setChecklist] = useState('');

  // State
  const [saving, setSaving] = useState(false);
  const [loadingTipos, setLoadingTipos] = useState(false);

  useEffect(() => {
    setLoadingTipos(true);
    getTiposOrdemServicos()
      .then(setTiposOS)
      .catch(() => {})
      .finally(() => setLoadingTipos(false));
  }, []);

  // Autocomplete fetchers
  const fetchVendedores = useCallback(async (query: string) => {
    try {
      const r = await getVendedores({ nome: query });
      return r.map((v) => ({ id: v.VDDR_ID, label: v.VDDR_NOME }));
    } catch { return []; }
  }, []);

  const fetchTecnicos = useCallback(async (query: string) => {
    try {
      const r = await getTecnicos({ nome: query });
      return r.map((t) => ({ id: t.TCNC_ID, label: t.TCNC_NOME }));
    } catch { return []; }
  }, []);

  const fetchMidias = useCallback(async (query: string) => {
    try {
      const r = await getMidias({ nome: query });
      return r.map((m) => ({ id: m.MDIA_ID, label: m.MDIA_NOME }));
    } catch { return []; }
  }, []);

  // Financeiro
  const subtotal = itens.reduce((s, i) => s + (i.ITOS_QTDE * i.ITOS_VLR_UNITARIO), 0);
  const descontoTotal = itens.reduce((s, i) => s + i.ITOS_DESCONTO, 0);
  const totalFinal = Math.max(0, subtotal - descontoTotal);

  // Actions
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
        MDIA_ID: midia?.MDIA_ID,
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

  const handleCancel = () => {
    setCliente(null);
    setVeiculo(null);
    setItens([]);
    setVendedor(null);
    setVendedorText('');
    setTecnico(null);
    setTecnicoText('');
    setMidia(null);
    setMidiaText('');
    setObservacoes('');
    setChecklist('');
    setHodometro('');
    setTipoOS('');
    setNumeroOS('NOVA');
    setStatusOS('Aberto');
    toast.info('OS cancelada');
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
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wrench className="h-6 w-6" /> Ordem de Serviço
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Cadastro e gerenciamento de OS para manutenção de veículos</p>
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

      {/* Cabeçalho da OS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Dados da OS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
              <Label className="text-xs">Hodômetro (Km)</Label>
              <Input
                value={hodometro}
                onChange={(e) => setHodometro(e.target.value)}
                className="h-9 text-sm"
                placeholder="Km atual do veículo"
              />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Input value={statusOS} readOnly className="h-9 text-sm bg-muted/50" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cliente + Veículo side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ClienteSection cliente={cliente} onSelect={setCliente} />
        <VeiculoSection veiculo={veiculo} clienteId={cliente?.PESS_ID || null} onSelect={setVeiculo} />
      </div>

      {/* Itens */}
      <ItensTable itens={itens} onChange={setItens} />

      {/* Equipe + Origem + Resumo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Equipe */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Equipe
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

        {/* Origem */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              Origem do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Label className="text-xs">Mídia</Label>
            <AutocompleteInput
              placeholder="Buscar mídia..."
              value={midiaText}
              onChange={setMidiaText}
              onSelect={(opt) => { setMidia({ MDIA_ID: opt.id, MDIA_NOME: opt.label }); setMidiaText(opt.label); }}
              fetchOptions={fetchMidias}
            />
          </CardContent>
        </Card>

        {/* Resumo Financeiro */}
        <ResumoFinanceiro itens={itens} />
      </div>

      {/* Info Adicional (sub-tabs) */}
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
              <Textarea
                placeholder="Descreva o problema relatado pelo cliente..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="min-h-[100px] text-sm"
              />
            </TabsContent>
            <TabsContent value="checklist">
              <Textarea
                placeholder="Nº Checklist ou observações do checklist..."
                value={checklist}
                onChange={(e) => setChecklist(e.target.value)}
                className="min-h-[100px] text-sm"
              />
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
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
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
    </div>
  );
}
