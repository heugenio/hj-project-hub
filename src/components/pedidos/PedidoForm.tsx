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
import { useEmpresaHeader } from '@/hooks/useEmpresaHeader';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface PedidoFormProps {
  onBack: () => void;
  editingPedido?: PedidoListItem | null;
  viewMode?: boolean;
}

export default function PedidoForm({ onBack, editingPedido, viewMode = false }: PedidoFormProps) {
  const { auth } = useAuth();
  const { logo: logoEmpresa, unidade: unidadeHeader } = useEmpresaHeader();

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

  // ====== PDF do Pedido ======
  const buildPdf = useCallback((): jsPDF => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const marginX = 10;
    const contentW = pageW - marginX * 2;

    const unidade: any = auth?.unidade || {};
    const empresaNome = unidade.unem_Fantasia || unidade.unem_Nome || unidade.unem_RazaoSocial || '';
    const empresaEnd = unidade.unem_Endereco || '';
    const empresaBairro = unidade.unem_Bairro || '';
    const empresaCidade = unidade.unem_Cidade || unidade.unem_Municipio || '';
    const empresaUF = unidade.unem_UF || unidade.unem_Uf || '';
    const empresaCEP = unidade.unem_CEP || unidade.unem_Cep || '';
    const empresaEmail = unidade.unem_Email || '';
    const empresaFone = unidade.unem_Fone || unidade.unem_Telefone || '';
    const empresaCNPJ = unidade.unem_CNPJ || unidade.unem_Cnpj || '';
    const empresaIE = unidade.unem_IE || unidade.unem_Ie || '';

    const drawSectionTitle = (yy: number, title: string): number => {
      doc.setFillColor(190, 190, 190);
      doc.rect(marginX, yy, contentW, 5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.text(title, pageW / 2, yy + 3.6, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      return yy + 5;
    };

    const drawCellsRow = (
      yy: number,
      cells: { label: string; value: string; w: number }[],
      h = 9,
    ): number => {
      let x = marginX;
      doc.setDrawColor(160, 160, 160);
      cells.forEach((c) => {
        doc.rect(x, yy, c.w, h);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
        doc.text(c.label, x + 1.5, yy + 2.8);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        const txt = doc.splitTextToSize(c.value || '', c.w - 3);
        doc.text(txt, x + 1.5, yy + 6);
        x += c.w;
      });
      return yy + h;
    };

    // ===== Cabeçalho =====
    const headH = 26;
    doc.setDrawColor(160, 160, 160);
    const logoW = 50;
    doc.rect(marginX, 8, logoW, headH);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('[ LOGO EMPRESA ]', marginX + logoW / 2, 8 + headH / 2 + 1, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    const numW = 42;
    const dadosX = marginX + logoW;
    const dadosW = contentW - logoW - numW;
    doc.rect(dadosX, 8, dadosW, headH);

    const cidadeLinha = [
      empresaBairro,
      empresaCidade && (empresaUF ? `${empresaCidade} - ${empresaUF}` : empresaCidade),
      empresaCEP && `CEP: ${empresaCEP}`,
    ].filter(Boolean).join(' - ');

    let hy = 12;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold'); doc.text('Nome:', dadosX + 2, hy);
    doc.setFont('helvetica', 'normal'); doc.text(empresaNome, dadosX + 13, hy); hy += 3.5;
    doc.setFont('helvetica', 'bold'); doc.text('Endereço:', dadosX + 2, hy);
    doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(empresaEnd, dadosW - 22), dadosX + 18, hy); hy += 3.5;
    doc.setFont('helvetica', 'bold'); doc.text('Bairro:', dadosX + 2, hy);
    doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(cidadeLinha, dadosW - 16), dadosX + 14, hy); hy += 3.5;
    doc.setFont('helvetica', 'bold'); doc.text('Email:', dadosX + 2, hy);
    doc.setFont('helvetica', 'normal'); doc.text(empresaEmail || '', dadosX + 13, hy); hy += 3.5;
    doc.setFont('helvetica', 'bold'); doc.text('Telefone:', dadosX + 2, hy);
    doc.setFont('helvetica', 'normal'); doc.text(empresaFone || '', dadosX + 18, hy); hy += 3.5;
    doc.setFont('helvetica', 'bold'); doc.text('CNPJ:', dadosX + 2, hy);
    doc.setFont('helvetica', 'normal'); doc.text(empresaCNPJ || '', dadosX + 13, hy);
    doc.setFont('helvetica', 'bold'); doc.text('IE:', dadosX + 60, hy);
    doc.setFont('helvetica', 'normal'); doc.text(empresaIE || '', dadosX + 65, hy);

    const numX = dadosX + dadosW;
    doc.rect(numX, 8, numW, headH);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('PEDIDO', numX + numW / 2, 14, { align: 'center' });
    doc.setFontSize(18);
    doc.text(String(numeroPedido || orsvId || ''), numX + numW / 2, 25, { align: 'center' });

    let y = 8 + headH;

    // ===== DADOS DO CLIENTE =====
    y = drawSectionTitle(y, 'DADOS DO CLIENTE');
    const enderecoCliente = [cliente?.ENDE_TIPO_LOGRADOURO, cliente?.ENDE_LOGRADOURO, cliente?.ENDE_NUMERO]
      .filter(Boolean).join(' ').trim() || cliente?.PESS_ENDERECO || '';
    const bairroCliente = (cliente as any)?.BAIR_NOME || '';
    const cepCliente = cliente?.ENDE_CEP || '';
    const municipioCliente = (cliente as any)?.MUNI_NOME || cliente?.PESS_CIDADE || '';
    const ufCliente = (cliente as any)?.ESTA_UF || cliente?.PESS_UF || '';
    const foneCliente = cliente?.PESS_FONE_CELULAR || cliente?.PESS_FONE || '';

    y = drawCellsRow(y, [
      { label: 'NOME', value: cliente?.PESS_NOME || '', w: contentW * 0.7 },
      { label: 'CNPJ / CPF', value: cliente?.PESS_CPFCNPJ || '', w: contentW * 0.3 },
    ]);
    y = drawCellsRow(y, [
      { label: 'ENDEREÇO', value: enderecoCliente, w: contentW * 0.5 },
      { label: 'BAIRRO', value: bairroCliente, w: contentW * 0.3 },
      { label: 'CEP', value: cepCliente, w: contentW * 0.2 },
    ]);
    y = drawCellsRow(y, [
      { label: 'MUNICÍPIO', value: municipioCliente, w: contentW * 0.5 },
      { label: 'FONE / CELULAR', value: foneCliente, w: contentW * 0.3 },
      { label: 'UF', value: ufCliente, w: contentW * 0.2 },
    ]);

    // ===== DADOS DO PEDIDO =====
    y = drawSectionTitle(y, 'DADOS DO PEDIDO');
    const dataStr = (dataPedido || '').split('-').reverse().join('/');
    y = drawCellsRow(y, [
      { label: 'DATA', value: dataStr, w: contentW * 0.25 },
      { label: 'VENDEDOR', value: vendedor?.VDDR_NOME || '', w: contentW * 0.5 },
      { label: 'STATUS', value: statusPedido || '', w: contentW * 0.25 },
    ]);

    // ===== ITENS =====
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 8, cellPadding: 1.5, lineColor: [160, 160, 160], lineWidth: 0.1 },
      headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: 'bold', halign: 'left' },
      head: [['QUANT.', 'DESCRIÇÃO', 'UN.', 'VLR. UNIT.', 'DESC.', 'VLR. TOTAL']],
      body: itens.length
        ? itens.map((i) => [
            String(i.ITOS_QTDE),
            i.ITOS_DESCRICAO,
            i.ITOS_UNIDADE_MEDIDA || 'UN',
            formatCurrency(i.ITOS_VLR_UNITARIO),
            formatCurrency(i.ITOS_DESCONTO),
            formatCurrency(i.ITOS_VLR_TOTAL),
          ])
        : [['', 'Nenhum item', '', '', '', '']],
      columnStyles: {
        0: { halign: 'center', cellWidth: 16 },
        2: { halign: 'center', cellWidth: 14 },
        3: { halign: 'right', cellWidth: 24 },
        4: { halign: 'right', cellWidth: 22 },
        5: { halign: 'right', cellWidth: 26 },
      },
    });
    y = (doc as any).lastAutoTable?.finalY ?? y + 10;

    // ===== FORMA DE VENCIMENTO / PARCELAS =====
    if (parcelas.length > 0) {
      autoTable(doc, {
        startY: y + 2,
        theme: 'grid',
        margin: { left: marginX, right: marginX },
        styles: { fontSize: 8, cellPadding: 1.5, lineColor: [160, 160, 160], lineWidth: 0.1 },
        headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: 'bold', halign: 'left' },
        head: [['PARC.', 'VENCIMENTO', 'DIAS', '%', 'TIPO PAGAMENTO', 'VALOR']],
        body: parcelas.map((p) => [
          String(p.parcela),
          (p.vencimento || '').split('-').reverse().join('/'),
          String(p.dias),
          `${p.perc}%`,
          p.tipo_pagamento || '',
          formatCurrency(p.valor),
        ]),
        columnStyles: {
          0: { halign: 'center', cellWidth: 14 },
          1: { halign: 'center', cellWidth: 26 },
          2: { halign: 'center', cellWidth: 14 },
          3: { halign: 'right', cellWidth: 16 },
          5: { halign: 'right', cellWidth: 28 },
        },
      });
      y = (doc as any).lastAutoTable?.finalY ?? y + 10;
    }

    // ===== OBSERVAÇÕES + TOTAL GERAL =====
    {
      const leftW = contentW * 0.65;
      const rightW = contentW * 0.35;
      const obsTxt = doc.splitTextToSize(observacoes || ' ', leftW - 4);
      const h = Math.max(28, obsTxt.length * 4 + 8);

      doc.setFillColor(220, 220, 220);
      doc.rect(marginX, y + 2, leftW, 5, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text('OBSERVAÇÕES', marginX + 2, y + 5.6);
      doc.rect(marginX + leftW, y + 2, rightW, 5, 'FD');
      doc.text('TOTAL GERAL', marginX + leftW + rightW / 2, y + 5.6, { align: 'center' });

      doc.setDrawColor(160, 160, 160);
      doc.rect(marginX, y + 7, leftW, h - 5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.text(obsTxt, marginX + 2, y + 11);

      doc.rect(marginX + leftW, y + 7, rightW, h - 5);
      const tgX = marginX + leftW + 2;
      const tgValX = marginX + leftW + rightW - 2;
      let tgY = y + 12;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.text('Subtotal:', tgX, tgY);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(subtotal), tgValX, tgY, { align: 'right' });
      tgY += 5;
      doc.setFont('helvetica', 'normal');
      doc.text('Desconto total:', tgX, tgY);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(descontoItens + descontoOS + descontoServico), tgValX, tgY, { align: 'right' });
      tgY += 5;
      doc.setFont('helvetica', 'normal');
      doc.text('Total:', tgX, tgY);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(formatCurrency(totalFinal), tgValX, tgY, { align: 'right' });

      y += h + 2;
    }

    // ===== Rodapé: Assinaturas =====
    y += 10;
    const sigW = contentW / 2;
    [
      { titulo: 'VENDEDOR', valor: vendedor?.VDDR_NOME || '' },
      { titulo: 'CLIENTE', valor: cliente?.PESS_NOME || '' },
    ].forEach((s, idx) => {
      const x = marginX + sigW * idx;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(s.valor, x + sigW / 2, y, { align: 'center' });
      doc.setDrawColor(80, 80, 80);
      doc.line(x + 8, y + 2, x + sigW - 8, y + 2);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text(s.titulo, x + sigW / 2, y + 6, { align: 'center' });
    });

    return doc;
  }, [auth, numeroPedido, orsvId, dataPedido, cliente, vendedor, statusPedido, itens, parcelas, descontoItens, descontoOS, descontoServico, subtotal, totalFinal, observacoes]);

  const handlePrint = useCallback(() => {
    if (!pedidoPersistido) return;
    try {
      const doc = buildPdf();
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } catch (e: any) {
      toast.error('Erro ao gerar PDF: ' + (e?.message || ''));
    }
  }, [pedidoPersistido, buildPdf]);

  const handleWhatsApp = useCallback(() => {
    if (!pedidoPersistido) return;
    const fone = (cliente?.PESS_FONE_CELULAR || cliente?.PESS_FONE || '').replace(/\D/g, '');
    const primeiroNome = (cliente?.PESS_NOME || '').split(' ')[0] || '';
    const mensagemPadrao = [
      `Olá${primeiroNome ? ', ' + primeiroNome : ''}!`,
      '',
      `Segue em anexo o Pedido Nº ${numeroPedido || orsvId}.`,
      '',
      `Total: ${formatCurrency(totalFinal)}`,
      '',
      'Qualquer dúvida estamos à disposição.',
    ].join('\n');
    setWhatsMensagem(mensagemPadrao);
    setWhatsTelefone(fone);
    setWhatsDialogOpen(true);
  }, [pedidoPersistido, cliente, numeroPedido, orsvId, totalFinal]);

  const fetchParametro = useCallback(async (unemId: string, nome: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('api-proxy', {
        body: { baseUrl: getApiBaseUrl(), endpoint: `/getParametros?UNEM_ID=${unemId}&nome=${encodeURIComponent(nome)}`, method: 'GET' },
      });
      if (error) return '';
      let result: any = data;
      if (typeof data === 'string') { try { result = JSON.parse(data); } catch { return ''; } }
      if (Array.isArray(result) && result.length > 0) return (result[0].PRMT_VALOR || '').trim();
      if (result && result.PRMT_VALOR) return (result.PRMT_VALOR || '').trim();
      return '';
    } catch { return ''; }
  }, []);

  const handleEnviarWhatsApp = useCallback(async () => {
    if (!pedidoPersistido) return;
    const fone = (whatsTelefone || '').replace(/\D/g, '');
    if (!fone || fone.length < 10) {
      toast.error('Informe um telefone válido (mínimo 10 dígitos com DDD)');
      return;
    }
    const unemId = auth?.unidade?.unem_Id;
    if (!unemId) { toast.error('Unidade não selecionada'); return; }

    setWhatsEnviando(true);
    try {
      const [servidorRaw, token, device, phoneId] = await Promise.all([
        fetchParametro(unemId, 'SERVIDORWHATS'),
        fetchParametro(unemId, 'TOKENWHATS'),
        fetchParametro(unemId, 'DEVICEWHATS'),
        fetchParametro(unemId, 'PHONENUMBERID'),
      ]);
      const VALID = ['Nexus', 'WhatsAppOficial', 'BrasilAPI', 'n8n'];
      const provider = VALID.find(p => p.toLowerCase() === servidorRaw.trim().toLowerCase()) || '';

      if (!provider) { toast.error('Provedor WhatsApp não configurado (parâmetro SERVIDORWHATS).'); return; }
      if (provider !== 'n8n' && !token) { toast.error('Token WhatsApp não configurado (parâmetro TOKENWHATS).'); return; }
      if (provider === 'BrasilAPI' && !device) { toast.error('DeviceToken não configurado (parâmetro DEVICEWHATS).'); return; }

      const doc = buildPdf();
      const dataUri = doc.output('datauristring');
      const base64 = dataUri.split(',')[1] || '';
      const fileName = `PEDIDO-${numeroPedido || orsvId}.pdf`;

      const payload: any = {
        provider,
        token,
        number: fone,
        text: whatsMensagem,
        type: 'media',
        mediaType: 'document',
        file: `data:application/pdf;base64,${base64}`,
        fileName,
      };
      if (device) payload.device = device;
      if (provider === 'WhatsAppOficial') payload.phoneNumberId = phoneId;

      console.log('=== ENVIO WHATSAPP PEDIDO ===', { provider, unemId, fone, fileName, base64Len: base64.length });

      const { data: respData, error } = await supabase.functions.invoke('send-message', { body: payload });
      if (error) { toast.error('Erro ao enviar WhatsApp: ' + (error.message || '')); return; }
      if (respData && respData.success === false) {
        toast.error('Falha no envio: ' + JSON.stringify(respData?.data || {}).slice(0, 200));
        return;
      }

      toast.success('Pedido enviado por WhatsApp!');
      setWhatsDialogOpen(false);
    } catch (e: any) {
      toast.error('Erro ao enviar: ' + (e?.message || ''));
    } finally {
      setWhatsEnviando(false);
    }
  }, [pedidoPersistido, whatsTelefone, auth, fetchParametro, buildPdf, numeroPedido, orsvId, whatsMensagem]);

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
          <Button
            variant="outline"
            size="sm"
            disabled={saving || !pedidoPersistido}
            onClick={handlePrint}
            title={!pedidoPersistido ? 'Salve o pedido para imprimir' : 'Imprimir Pedido'}
          >
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={saving || !pedidoPersistido}
            onClick={handleWhatsApp}
            title={!pedidoPersistido ? 'Salve o pedido para enviar' : 'Enviar via WhatsApp'}
          >
            <Send className="h-4 w-4 mr-1" /> WhatsApp
          </Button>
          {!viewMode && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          )}
        </div>
      </div>

      {/* WhatsApp Send Dialog */}
      <Dialog open={whatsDialogOpen} onOpenChange={(open) => !whatsEnviando && setWhatsDialogOpen(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" /> Enviar Pedido por WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Cliente: <span className="font-mono font-semibold text-foreground">{cliente?.PESS_NOME}</span>
            </div>
            <div>
              <Label className="text-xs">Telefone do destinatário (com DDD)</Label>
              <Input
                value={whatsTelefone}
                onChange={(e) => setWhatsTelefone(e.target.value.replace(/\D/g, '').slice(0, 13))}
                placeholder="11999998888"
                className="text-xs mt-1 font-mono"
                disabled={whatsEnviando}
                inputMode="numeric"
              />
              <div className="text-[10px] text-muted-foreground mt-1">
                Apenas números. O código do país (55) será adicionado automaticamente.
              </div>
            </div>
            <div>
              <Label className="text-xs">Mensagem (será enviada junto com o PDF)</Label>
              <Textarea
                value={whatsMensagem}
                onChange={(e) => setWhatsMensagem(e.target.value.toUpperCase())}
                rows={7}
                className="text-xs mt-1"
                disabled={whatsEnviando}
              />
            </div>
            <div className="text-[10px] text-muted-foreground">
              📎 O PDF do pedido será anexado automaticamente como <span className="font-mono">PEDIDO-{numeroPedido || orsvId}.pdf</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setWhatsDialogOpen(false)} disabled={whatsEnviando}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleEnviarWhatsApp} disabled={whatsEnviando || !whatsMensagem.trim()}>
              {whatsEnviando ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Enviando...</>
              ) : (
                <><Send className="h-4 w-4 mr-1" /> Enviar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
