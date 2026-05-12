import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  ShoppingCart, Save, XCircle, Loader2, FileText, Users, MessageSquare, ArrowLeft,
  Printer, Send,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ClienteSection } from '@/components/ordem-servico/ClienteSection';
import { ItensTable } from '@/components/ordem-servico/ItensTable';
import { ResumoFinanceiro } from '@/components/ordem-servico/ResumoFinanceiro';
import { AutocompleteInput } from '@/components/ordem-servico/AutocompleteInput';
import FormaVencimentoCard, { type ParcelaUI } from '@/components/pedidos/FormaVencimentoCard';
import {
  getTiposOrdemServicos, getVendedores, getMidias, getOperacoesComerciais, getParametros,
  setPedido as savePedido,
  getPedidoById, getItensPedidos, getNegociacoesPedidos, getClientes,
  type Cliente, type ItemOS, type TipoOS,
  type Vendedor, type Midia, type OrdemServicoFull,
  type OperacaoComercial,
} from '@/lib/api-os';
import type { Pedido as PedidoListItem } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { getApiBaseUrl } from '@/lib/base-url';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface PedidoFormProps {
  onBack: () => void;
  editingPedido?: PedidoListItem | null;
  viewMode?: boolean;
}

export default function PedidoForm({ onBack, editingPedido, viewMode = false }: PedidoFormProps) {
  const { auth } = useAuth();

  const [operacoes, setOperacoes] = useState<OperacaoComercial[]>([]);
  const [opcmId, setOpcmId] = useState('');
  const [loadingOperacoes, setLoadingOperacoes] = useState(false);
  const [orsvId, setOrsvId] = useState('');
  const [numeroPedido, setNumeroPedido] = useState('NOVO');
  const [statusPedido, setStatusPedido] = useState('Aberto');
  const [dataPedido, setDataPedido] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const [cliente, setClienteState] = useState<Cliente | null>(null);
  const [itens, setItens] = useState<ItemOS[]>([]);

  const [descontoOS, setDescontoOS] = useState<number>(0);
  const [descontoServico, setDescontoServico] = useState<number>(0);

  const [vendedorText, setVendedorText] = useState('');
  const [vendedor, setVendedor] = useState<Vendedor | null>(null);

  const [midias, setMidias] = useState<Midia[]>([]);
  const [midiaId, setMidiaId] = useState('');
  const [loadingMidias, setLoadingMidias] = useState(false);

  const [observacoes, setObservacoes] = useState('');

  const [formaPagamento, setFormaPagamento] = useState('');
  const [cofrId, setCofrId] = useState('');
  const [parcelas, setParcelas] = useState<ParcelaUI[]>([]);

  const [saving, setSaving] = useState(false);

  // Imprimir / WhatsApp
  const [whatsDialogOpen, setWhatsDialogOpen] = useState(false);
  const [whatsTelefone, setWhatsTelefone] = useState('');
  const [whatsMensagem, setWhatsMensagem] = useState('');
  const [whatsEnviando, setWhatsEnviando] = useState(false);
  const pedidoPersistido = !!orsvId;

  useEffect(() => {
    setLoadingMidias(true);
    getMidias({})
      .then(setMidias)
      .catch(() => {})
      .finally(() => setLoadingMidias(false));

    const pessId = auth?.user?.pess_ID;
    if (pessId && !editingPedido) {
      getVendedores({ id: pessId })
        .then((r: any[]) => {
          if (r.length > 0) {
            const v = r[0];
            const id = v.VDDR_ID || v.vDDR_ID || '';
            const nome = v.VDDR_NOME || v.vDDR_NOME || v.PESS_NOME || v.pESS_NOME || '';
            if (id) {
              setVendedor({ VDDR_ID: String(id), VDDR_NOME: String(nome) });
              setVendedorText(String(nome));
            }
          }
        })
        .catch(() => {});
    }
  }, [auth?.user?.pess_ID, editingPedido]);

  // Carrega dados completos do pedido quando em modo visualização/edição
  useEffect(() => {
    const pddsId = editingPedido?.PDDS_ID;
    if (!pddsId) return;
    (async () => {
      try {
        const [detalhe, itensRaw, negocRaw] = await Promise.all([
          getPedidoById(pddsId).catch(() => null),
          getItensPedidos(pddsId).catch(() => [] as any[]),
          getNegociacoesPedidos(pddsId).catch(() => [] as any[]),
        ]);

        const d: any = detalhe || editingPedido;
        setOrsvId(String(d.PDDS_ID || pddsId));
        if (d.PDDS_NUMERO) setNumeroPedido(String(d.PDDS_NUMERO));
        if (d.PDDS_STATUS) setStatusPedido(String(d.PDDS_STATUS));
        if (d.PDDS_DATA) {
          const s = String(d.PDDS_DATA);
          // dd/MM/yyyy -> yyyy-MM-dd
          if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
            const [dd, mm, yyyy] = s.slice(0, 10).split('/');
            setDataPedido(`${yyyy}-${mm}-${dd}`);
          } else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
            setDataPedido(s.slice(0, 10));
          }
        }
        if (d.PDDS_OBSERVACOES) setObservacoes(String(d.PDDS_OBSERVACOES).toUpperCase());
        if (d.OPCM_ID) setOpcmId(String(d.OPCM_ID));
        if (d.MDIA_ID) setMidiaId(String(d.MDIA_ID));
        if (d.VDDR_ID) {
          setVendedor({ VDDR_ID: String(d.VDDR_ID), VDDR_NOME: String(d.VDDR_NOME || d.PESS_NOME_VENDEDOR || '') });
          setVendedorText(String(d.VDDR_NOME || d.PESS_NOME_VENDEDOR || ''));
        }

        // Cliente
        const pessId = d.PESS_ID;
        if (pessId) {
          try {
            const list = await getClientes({ id: String(pessId) });
            if (list && list.length > 0) setClienteState(list[0] as Cliente);
          } catch {}
        }

        // Itens (campos reais do getItensPedidos: ITPD_*)
        const itensMapped: ItemOS[] = (itensRaw || []).map((i: any) => ({
          ITOS_ID: '',
          ITRQ_ID: i.ITPD_ID || '',
          ORSV_ID: i.PDDS_ID || pddsId,
          ITOS_TIPO: 'P' as 'P' | 'S',
          ITOS_DESCRICAO: String(i.ITPD_PROD_DESCRICAO || i.PROD_NOME || i.ITPD_DESCRICAO_ESTENDIDA || ''),
          ITOS_QTDE: Number(i.ITPD_QTDE || 0),
          ITOS_VLR_UNITARIO: Number(i.ITPD_PRECO_UNITARIO || 0),
          ITOS_DESCONTO: Number(i.ITPD_DESCONTO || 0),
          ITOS_VLR_TOTAL: Number(i.ITPD_VLR_FINAL || 0),
          ITOS_UNIDADE_MEDIDA: i.ITPD_UNID_SIGLA || 'UN',
          ITRQ_PRECO_TABELA: Number(i.ITPD_PRECO_TABELA || i.ITPD_PRECO_UNITARIO || 0),
          ITRQ_VLR_DESCONTO_SOBRE_TOTAL: Number(i.ITPD_VLR_DESCONTO_SOBRE_TOTAL || 0),
          PROD_ID: i.PROD_ID || '',
          PROD_CODIGO: i.PROD_CODIGO || '',
        }));
        setItens(itensMapped);

        if (d.PDDS_VLR_DESCONTO) setDescontoOS(Number(d.PDDS_VLR_DESCONTO));
        if (d.PDDS_VLR_DESCONTO_SERVICO) setDescontoServico(Number(d.PDDS_VLR_DESCONTO_SERVICO));

        // Forma de pagamento + Parcelas (campos reais: NGPD_*, FVEN_ID, COFR_ID na negociação)
        const primeiraNeg: any = (negocRaw && negocRaw[0]) || null;
        const fvenId = d.FVEN_ID || primeiraNeg?.FVEN_ID || '';
        const fpagId = d.FPAG_ID || primeiraNeg?.FPAG_ID || '';
        if (fvenId || fpagId) {
          setFormaPagamento(`${String(fvenId)}|${String(fpagId)}`);
        }
        const cofr = d.COFR_ID || primeiraNeg?.COFR_ID || '';
        if (cofr) setCofrId(String(cofr));

        const parcelasMapped: ParcelaUI[] = (negocRaw || []).map((p: any, idx: number) => {
          const dataRaw = String(p.NGPD_DATA_VENCIMENTO || '');
          let venc = '';
          if (/^\d{2}\/\d{2}\/\d{4}/.test(dataRaw)) {
            const [dd, mm, yyyy] = dataRaw.slice(0, 10).split('/');
            venc = `${yyyy}-${mm}-${dd}`;
          } else if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(dataRaw)) {
            venc = dataRaw.slice(0, 10).replace(/\//g, '-');
          }
          return {
            parcela: idx + 1,
            dias: Number(p.NGPD_DIAS_VENCIMENTO || 0),
            vencimento: venc,
            perc: Number(String(p.NGPD_PERC_VENCIMENTO || '0').replace(',', '.')),
            valor: Number(String(p.NGPD_VLR_PARCELA || '0').replace(',', '.')),
            tipo_pagamento: String(p.NGPD_TIPO_PAGAMENTO || ''),
            cofr_id: String(p.COFR_ID || ''),
            itfv_id: String(p.ITFV_ID || ''),
          };
        });
        if (parcelasMapped.length > 0) setParcelas(parcelasMapped);
      } catch (e: any) {
        toast.error('Erro ao carregar pedido: ' + (e?.message || ''));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPedido?.PDDS_ID]);

  // Carrega operações comerciais conforme cliente/vendedor/loja
  useEffect(() => {
    const unem_id = auth?.unidade?.unem_Id;
    const vddr_id = vendedor?.VDDR_ID;
    const pess_id = cliente?.PESS_ID;
    if (!unem_id) return;
    setLoadingOperacoes(true);
    Promise.all([
      getOperacoesComerciais({ unem_id, vddr_id, pess_id }),
      getParametros({ unem_id, nome: 'OPCMPadraoSaida' }).catch(() => [] as any[]),
    ])
      .then(([ops, params]) => {
        const list = ops || [];
        setOperacoes(list);
        const padrao = Array.isArray(params) && params.length > 0
          ? String(((params[0] as any).PRMT_STRING || (params[0] as any).PRMT_VALOR || '')).trim()
          : '';
        setOpcmId((cur) => {
          if (cur && list.some((o: any) => o.OPCM_ID === cur)) return cur;
          if (padrao && list.some((o: any) => o.OPCM_ID === padrao)) return padrao;
          return list.length > 0 ? list[0].OPCM_ID : '';
        });
      })
      .catch(() => setOperacoes([]))
      .finally(() => setLoadingOperacoes(false));
  }, [auth?.unidade?.unem_Id, vendedor?.VDDR_ID, cliente?.PESS_ID]);

  const fetchVendedores = useCallback(async (query: string) => {
    try {
      const raw = await getVendedores({ nome: query });
      const list = Array.isArray(raw) ? raw : [];
      return list
        .map((v: any) => ({
          id: String(v.VDDR_ID || v.vDDR_ID || ''),
          label: String(v.VDDR_NOME || v.vDDR_NOME || v.PESS_NOME || v.pESS_NOME || ''),
        }))
        .filter((opt) => opt.id && opt.label);
    } catch { return []; }
  }, []);

  const subtotal = itens.reduce((s, i) => s + (i.ITOS_QTDE * i.ITOS_VLR_UNITARIO), 0);
  const descontoItens = itens.reduce((s, i) => s + i.ITOS_DESCONTO, 0);
  const totalFinal = Math.max(0, subtotal - descontoItens - descontoOS - descontoServico);

  const handleSave = async () => {
    if (!cliente) { toast.error('Selecione um cliente'); return; }
    if (itens.length === 0) { toast.error('Adicione ao menos um item ao pedido'); return; }

    setSaving(true);
    try {
      const baseRateio = itens.reduce(
        (s, i) => s + Math.max(0, (i.ITOS_QTDE * i.ITOS_VLR_UNITARIO) - i.ITOS_DESCONTO),
        0
      );

      const itensPayload = itens.map((i) => {
        const liquidoItem = Math.max(0, (i.ITOS_QTDE * i.ITOS_VLR_UNITARIO) - i.ITOS_DESCONTO);
        const rateioDescontoTotal = baseRateio > 0
          ? Number(((descontoOS * liquidoItem) / baseRateio).toFixed(2))
          : 0;
        return {
          ITPD_ID: i.ITRQ_ID || '',
          ITPD_ITOS_ID: i.ITOS_ID || '',
          PDDS_ID: i.ORSV_ID || orsvId || '',
          PROD_ID: i.PROD_ID || '',
          ITPD_TIPO: i.ITOS_TIPO,
          ITPD_DESCRICAO: i.ITOS_DESCRICAO,
          ITPD_QTDE: i.ITOS_QTDE,
          ITPD_UNIDADE_MEDIDA: i.ITOS_UNIDADE_MEDIDA || 'UN',
          ITPD_VLR_UNITARIO: i.ITOS_VLR_UNITARIO,
          ITPD_DESCONTO: i.ITOS_DESCONTO,
          ITPD_VLR_TOTAL: i.ITOS_VLR_TOTAL,
          ITPD_PRECO_TABELA: i.ITRQ_PRECO_TABELA ?? i.ITOS_VLR_UNITARIO,
          ITPD_VLR_DESCONTO_SOBRE_TOTAL: rateioDescontoTotal,
        };
      });

      const [fvenIdSel, fpagIdSel] = (formaPagamento || '').split('|');
      const vencimentosPayload = parcelas.map((p) => ({
        ITPV_PARCELA: p.parcela,
        ITPV_ITFV_ID: p.itfv_id || '',
        ITPV_DIAS: p.dias,
        ITPV_DATA: (p.vencimento || '').replace(/-/g, '/'),
        ITPV_PERC: p.perc,
        ITPV_VLR: p.valor,
        ITPV_TIPO_PAGAMENTO: p.tipo_pagamento,
        COFR_ID: p.cofr_id,
      }));

      const payload: Record<string, any> = {
        PDDS_ID: orsvId || '',
        PDDS_NUMERO: orsvId ? numeroPedido : '',
        PDDS_DATA: dataPedido,
        OPCM_ID: opcmId || '',
        PESS_ID: cliente.PESS_ID,
        VDDR_ID: vendedor?.VDDR_ID || '',
        MDIA_ID: midiaId || '',
        USRS_ID: auth?.user?.usrs_ID || '',
        PDDS_OBSERVACOES: observacoes,
        PDDS_VLR_SUBTOTAL: subtotal,
        PDDS_VLR_DESCONTO: descontoOS,
        PDDS_VLR_DESCONTO_SERVICO: descontoServico,
        PDDS_VLR_TOTAL: totalFinal,
        PDDS_STATUS: 'Aberto',
        UNEM_ID: auth?.unidade?.unem_Id,
        FVEN_ID: fvenIdSel || '',
        FPAG_ID: fpagIdSel || '',
        COFR_ID: cofrId || '',
        itens: itensPayload,
        vencimentos: vencimentosPayload,
      };
      console.log('=== PAYLOAD PEDIDO ===', JSON.stringify(payload, null, 2));
      const result: any = await savePedido(payload as any);
      if (result?.PDDS_ID || result?.ORSV_ID) setOrsvId(result.PDDS_ID || result.ORSV_ID);
      if (result?.PDDS_NUMERO || result?.ORSV_NUMERO) setNumeroPedido(result.PDDS_NUMERO || result.ORSV_NUMERO);
      setStatusPedido('Aberto');
      toast.success('Pedido salvo com sucesso!');
      setTimeout(() => onBack(), 300);
    } catch (e: any) {
      toast.error('Erro ao salvar pedido: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const statusColors: Record<string, string> = {
    Aberto: 'bg-primary/15 text-primary border-primary/30',
    Faturado: 'bg-accent/15 text-accent border-accent/30',
    Cancelado: 'bg-destructive/15 text-destructive border-destructive/30',
  };

  return (
    <div className={`space-y-4 pb-8 ${viewMode ? '[&_input:not([type=button])]:pointer-events-none [&_textarea]:pointer-events-none [&_button[role=combobox]]:pointer-events-none' : ''}`}>
      {viewMode && (
        <div className="bg-muted/60 border border-border rounded-md px-3 py-2 text-xs text-muted-foreground">
          Este pedido está sendo exibido em modo somente leitura.
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShoppingCart className="h-6 w-6" /> {viewMode ? 'Visualizar Pedido' : (editingPedido ? 'Editar Pedido' : 'Novo Pedido')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{viewMode ? 'Modo somente leitura' : 'Cadastro de pedido'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Nº Pedido</div>
            <div className="text-lg font-bold font-mono text-foreground">{numeroPedido}</div>
          </div>
          <Badge className={`${statusColors[statusPedido] || 'bg-muted text-muted-foreground'} border text-xs px-3 py-1`}>
            {statusPedido}
          </Badge>
        </div>
      </div>

      {/* Cliente */}
      <ClienteSection cliente={cliente} onSelect={setClienteState} />

      {/* Dados do Pedido */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Dados do Pedido
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Data do Pedido</Label>
              <Input
                type="date"
                value={dataPedido}
                onChange={(e) => setDataPedido(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Vendedor</Label>
              <AutocompleteInput
                placeholder="BUSCAR VENDEDOR..."
                value={vendedorText}
                onChange={setVendedorText}
                onSelect={(opt) => { setVendedor({ VDDR_ID: opt.id, VDDR_NOME: opt.label }); setVendedorText(opt.label); }}
                fetchOptions={fetchVendedores}
              />
            </div>
            <div>
              <Label className="text-xs">Tipo (Operação Comercial)</Label>
              <Select value={opcmId} onValueChange={setOpcmId} disabled={loadingOperacoes || operacoes.length === 0}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={loadingOperacoes ? 'Carregando...' : (operacoes.length === 0 ? 'Sem operações' : 'Selecione a operação')} />
                </SelectTrigger>
                <SelectContent>
                  {operacoes.map((o) => (
                    <SelectItem key={o.OPCM_ID} value={o.OPCM_ID}>{o.OPCM_NOME_PADRAO}</SelectItem>
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

      {/* Resumo + Observações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> Observações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="OBSERVAÇÕES DO PEDIDO..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value.toUpperCase())}
              className="min-h-[100px] text-sm"
            />
          </CardContent>
        </Card>
        <ResumoFinanceiro
          itens={itens}
          descontoOS={descontoOS}
          descontoServico={descontoServico}
          onDescontoOSChange={setDescontoOS}
          onDescontoServicoChange={setDescontoServico}
        />
      </div>

      {/* Forma de Vencimento */}
      <FormaVencimentoCard
        valorTotal={totalFinal}
        unemId={auth?.unidade?.unem_Id}
        formaSelecionada={formaPagamento}
        onFormaChange={setFormaPagamento}
        cofrId={cofrId}
        onCofrChange={setCofrId}
        parcelas={parcelas}
        onParcelasChange={setParcelas}
      />

      {/* Ações */}
      <div className="flex items-center justify-between bg-card border rounded-lg p-4 sticky bottom-0 shadow-lg">
        <div className="text-sm text-muted-foreground">
          Total: <span className="text-lg font-bold text-primary ml-1">{formatCurrency(totalFinal)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack} disabled={saving}>
            <XCircle className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          {!viewMode && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
