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
  getItensOrdemServicos, getClientes, getVeiculos, getOrdemServicoById,
  type Cliente, type Veiculo, type ItemOS, type TipoOS,
  type Vendedor, type Tecnico, type Midia, type OrdemServicoFull,
  type PessoaVeiculo
} from '@/lib/api-os';
import type { OrdemServico as OrdemServicoListItem } from '@/lib/api';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const pickValue = (obj: Record<string, any> | null | undefined, ...keys: string[]) => {
  if (!obj) return undefined;
  for (const key of keys) {
    if (obj[key] != null && obj[key] !== '') return obj[key];
  }
  const lowered = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
  for (const key of keys) {
    const value = lowered[key.toLowerCase()];
    if (value != null && value !== '') return value;
  }
  return undefined;
};

const parseNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toInputDate = (value: unknown) => {
  if (!value) return '';
  const text = String(value);
  const match = text.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const d = new Date(text);
  return Number.isNaN(d.getTime())
    ? ''
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface OrdemServicoFormProps {
  onBack: () => void;
  editingOS?: OrdemServicoListItem | null;
}

export default function OrdemServicoForm({ onBack, editingOS }: OrdemServicoFormProps) {
  const { auth } = useAuth();

  const [tiposOS, setTiposOS] = useState<TipoOS[]>([]);
  const [tipoOS, setTipoOS] = useState('');
  const [orsvId, setOrsvId] = useState('');
  const [numeroOS, setNumeroOS] = useState('NOVA');
  const [statusOS, setStatusOS] = useState('Aberto');
  const [hodometro, setHodometro] = useState('');
  const [dataOS, setDataOS] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const [cliente, setClienteState] = useState<Cliente | null>(null);
  const [veiculo, setVeiculoState] = useState<Veiculo | null>(null);
  const [itens, setItens] = useState<ItemOS[]>([]);

  const [descontoOS, setDescontoOS] = useState<number>(0);
  const [descontoServico, setDescontoServico] = useState<number>(0);

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

  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
  const [selectionDialogType, setSelectionDialogType] = useState<'veiculo' | 'cliente'>('veiculo');
  const [selectionDialogItems, setSelectionDialogItems] = useState<PessoaVeiculo[]>([]);
  const [loadingCrossLink, setLoadingCrossLink] = useState(false);

  const skipVeiculoCrossLinkRef = useRef(false);
  const skipClienteCrossLinkRef = useRef(false);

  useEffect(() => {
    setLoadingTipos(true);
    getTiposOrdemServicos()
      .then((tipos) => {
        setTiposOS(tipos);
        const padrao = tipos.find((t) => (t.TPOS_PADRAO || '').toUpperCase() === 'SIM');
        if (padrao) setTipoOS((current) => current || padrao.TPOS_ID);
      })
      .catch(() => {})
      .finally(() => setLoadingTipos(false));

    setLoadingMidias(true);
    getMidias({})
      .then(setMidias)
      .catch(() => {})
      .finally(() => setLoadingMidias(false));

    const pessId = auth?.user?.pess_ID;
    if (pessId && !editingOS) {
      getVendedores({ id: pessId })
        .then((r: any[]) => {
          if (r.length > 0) {
            const v = r[0];
            const id = pickValue(v, 'VDDR_ID', 'vDDR_ID') || '';
            const nome = pickValue(v, 'VDDR_NOME', 'vDDR_NOME', 'PESS_NOME', 'pESS_NOME') || '';
            if (id) {
              setVendedor({ VDDR_ID: String(id), VDDR_NOME: String(nome) });
              setVendedorText(String(nome));
            }
          }
        })
        .catch(() => {});
    }
  }, [auth?.user?.pess_ID, editingOS]);

  useEffect(() => {
    if (!editingOS?.oRSV_ID) return;

    (async () => {
      try {
        const detalheRaw = await getOrdemServicoById(editingOS.oRSV_ID, auth?.unidade?.unem_Id);
        const detalhe = Array.isArray(detalheRaw) ? detalheRaw[0] : detalheRaw;

        setOrsvId(editingOS.oRSV_ID || '');
        setNumeroOS(String(pickValue(detalhe, 'ORSV_NUMERO', 'oRSV_NUMERO') ?? editingOS.oRSV_NUMERO ?? 'OS'));
        setStatusOS(String(pickValue(detalhe, 'ORSV_STATUS', 'oRSV_STATUS') ?? editingOS.oRSV_STATUS ?? 'Aberto'));
        setHodometro(String(pickValue(detalhe, 'ORSV_HODOMETRO', 'oRSV_HODOMETRO') ?? editingOS.oRSV_HODOMETRO ?? ''));
        setObservacoes(String(pickValue(detalhe, 'ORSV_OBSERVACOES', 'oRSV_OBSERVACOES') ?? editingOS.oRSV_OBSERVACOES ?? ''));
        setChecklist(String(pickValue(detalhe, 'ORSV_NR_CHECKLIST', 'oRSV_NR_CHECKLIST') ?? ''));
        setDataOS(toInputDate(pickValue(detalhe, 'ORSV_DATA', 'oRSV_DATA') ?? editingOS.oRSV_DATA) || dataOS);
        setDescontoOS(parseNumber(pickValue(detalhe, 'ORSV_VLR_DESCONTO', 'oRSV_VLR_DESCONTO')));
        setDescontoServico(parseNumber(pickValue(detalhe, 'ORSV_VLR_DESCONTO_SERVICO', 'oRSV_VLR_DESCONTO_SERVICO')));

        const tipoId = pickValue(detalhe, 'TPOS_ID', 'tPOS_ID');
        if (tipoId) setTipoOS(String(tipoId));

        const origemId = pickValue(detalhe, 'MDIA_ID', 'mDIA_ID');
        if (origemId) setMidiaId(String(origemId));

        const clienteId = pickValue(detalhe, 'PESS_ID', 'pESS_ID');
        const clienteCpfCnpj = pickValue(detalhe, 'PESS_CPFCNPJ', 'pESS_CPFCNPJ', 'ORSV_CPFCNPJ', 'oRSV_CPFCNPJ') || editingOS.oRSV_CPFCNPJ;
        const clienteNomeFallback = pickValue(detalhe, 'PESS_NOME', 'pESS_NOME', 'ORSV_NOME', 'oRSV_NOME') || editingOS.oRSV_NOME;
        let clienteCarregado = false;

        if (clienteId) {
          try {
            const cls = await getClientes({ id: String(clienteId) });
            if (cls && cls.length > 0) {
              skipClienteCrossLinkRef.current = true;
              setClienteState(cls[0]);
              clienteCarregado = true;
            }
          } catch (err) {
            console.warn('[OS Edit] Falha buscando cliente por ID', clienteId, err);
          }
        }

        if (!clienteCarregado && clienteCpfCnpj) {
          try {
            const cls = await getClientes({ cpfcnpj: String(clienteCpfCnpj) });
            if (cls && cls.length > 0) {
              skipClienteCrossLinkRef.current = true;
              setClienteState(cls[0]);
              clienteCarregado = true;
            }
          } catch (err) {
            console.warn('[OS Edit] Falha buscando cliente por CPF/CNPJ', clienteCpfCnpj, err);
          }
        }

        if (!clienteCarregado && (clienteId || clienteCpfCnpj || clienteNomeFallback)) {
          // Fallback mínimo para exibir os dados que já temos da OS
          skipClienteCrossLinkRef.current = true;
          setClienteState({
            PESS_ID: String(clienteId || ''),
            PESS_NOME: String(clienteNomeFallback || ''),
            PESS_CPFCNPJ: String(clienteCpfCnpj || ''),
          });
        }

        const veiculoId = pickValue(detalhe, 'VEIC_ID', 'vEIC_ID');
        if (veiculoId) {
          try {
            const vcs = await getVeiculos({ id: String(veiculoId) });
            if (vcs.length > 0) {
              skipVeiculoCrossLinkRef.current = true;
              setVeiculoState(vcs[0]);
            }
          } catch {}
        } else if (editingOS.vEIC_PLACA) {
          try {
            const vcs = await getVeiculos({ placa: editingOS.vEIC_PLACA });
            if (vcs.length > 0) {
              skipVeiculoCrossLinkRef.current = true;
              setVeiculoState(vcs[0]);
            }
          } catch {}
        }

        const vendedorId = pickValue(detalhe, 'VDDR_ID', 'vDDR_ID');
        const vendedorNome = pickValue(detalhe, 'VDDR_NOME', 'vDDR_NOME', 'VEND_NOME', 'vEND_NOME', 'PESS_NOME_VENDEDOR');
        if (vendedorId) {
          try {
            // Busca direta por VDDR_ID em getVendedores?id=
            const vendedores = await getVendedores({ id: String(vendedorId) });
            const v = Array.isArray(vendedores) && vendedores.length > 0 ? vendedores[0] : null;
            if (v) {
              const id = String(pickValue(v, 'VDDR_ID', 'vDDR_ID') || vendedorId);
              const nome = String(pickValue(v, 'VDDR_NOME', 'vDDR_NOME', 'PESS_NOME', 'pESS_NOME') || vendedorNome || '');
              setVendedor({ VDDR_ID: id, VDDR_NOME: nome });
              setVendedorText(nome);
            } else if (vendedorNome) {
              setVendedor({ VDDR_ID: String(vendedorId), VDDR_NOME: String(vendedorNome) });
              setVendedorText(String(vendedorNome));
            }
          } catch {
            setVendedor({ VDDR_ID: String(vendedorId), VDDR_NOME: String(vendedorNome || '') });
            setVendedorText(String(vendedorNome || ''));
          }
        } else if (vendedorNome) {
          setVendedor({ VDDR_ID: '', VDDR_NOME: String(vendedorNome) });
          setVendedorText(String(vendedorNome));
        }

        const tecnicoId = pickValue(detalhe, 'TCNC_ID', 'tCNC_ID');
        const tecnicoNome = pickValue(detalhe, 'TCNC_NOME', 'tCNC_NOME', 'PESS_NOME_TECNICO', 'TECNICO_NOME', 'tECNICO_NOME');
        if (tecnicoId) {
          try {
            // Backend grava PESS_ID em tCNC_ID; resolvemos o nome buscando a lista de técnicos
            const tecnicos = await getTecnicos({ nome: '' });
            const t = (tecnicos || []).find((x: any) => {
              const pessId = pickValue(x, 'PESS_ID', 'pESS_ID');
              const tcncId = pickValue(x, 'TCNC_ID', 'tCNC_ID');
              return String(pessId) === String(tecnicoId) || String(tcncId) === String(tecnicoId);
            });
            if (t) {
              const id = String(pickValue(t, 'TCNC_ID', 'tCNC_ID', 'PESS_ID', 'pESS_ID') || tecnicoId);
              const nome = String(pickValue(t, 'PESS_NOME', 'pESS_NOME', 'TCNC_NOME', 'tCNC_NOME') || tecnicoNome || '');
              setTecnico({ TCNC_ID: id, TCNC_NOME: nome });
              setTecnicoText(nome);
            } else if (tecnicoNome) {
              setTecnico({ TCNC_ID: String(tecnicoId), TCNC_NOME: String(tecnicoNome) });
              setTecnicoText(String(tecnicoNome));
            }
          } catch {
            setTecnico({ TCNC_ID: String(tecnicoId), TCNC_NOME: String(tecnicoNome || '') });
            setTecnicoText(String(tecnicoNome || ''));
          }
        } else if (tecnicoNome) {
          setTecnico({ TCNC_ID: '', TCNC_NOME: String(tecnicoNome) });
          setTecnicoText(String(tecnicoNome));
        }

        const its = await getItensOrdemServicos(editingOS.oRSV_ID);
        const norm: ItemOS[] = (its || []).map((raw: any) => {
          const qtde = parseNumber(pickValue(raw, 'ITOS_QTDE', 'iTOS_QTDE', 'ITRQ_QTDE', 'iTRQ_QTDE'));
          // Backend retorna ITRQ_PRECO_UNITARIO=0 mas valor real está em ITRQ_PRECO_TABELA ou pode ser deduzido de ITRQ_VLR_FINAL/ITRQ_QTDE
          const precoUnit = parseNumber(pickValue(raw, 'ITOS_VLR_UNITARIO', 'iTOS_VLR_UNITARIO', 'ITRQ_PRECO_UNITARIO', 'iTRQ_PRECO_UNITARIO'));
          const precoTabela = parseNumber(pickValue(raw, 'ITRQ_PRECO_TABELA', 'iTRQ_PRECO_TABELA'));
          const vlrFinal = parseNumber(pickValue(raw, 'ITOS_VLR_TOTAL', 'iTOS_VLR_TOTAL', 'ITRQ_VLR_FINAL', 'iTRQ_VLR_FINAL'));
          const desc = parseNumber(pickValue(raw, 'ITOS_DESCONTO', 'iTOS_DESCONTO', 'ITRQ_DESCONTO', 'iTRQ_DESCONTO', 'ITRQ_VLR_DESCONTO_SOBRE_TOTAL', 'iTRQ_VLR_DESCONTO_SOBRE_TOTAL'));
          const vUnit = precoUnit > 0
            ? precoUnit
            : (precoTabela > 0 ? precoTabela : (qtde > 0 ? (vlrFinal + desc) / qtde : 0));
          const total = vlrFinal > 0 ? vlrFinal : Math.max(0, (qtde * vUnit) - desc);
          return {
            ITOS_ID: String(pickValue(raw, 'ITOS_ID', 'iTOS_ID') || ''),
            ITRQ_ID: String(pickValue(raw, 'ITRQ_ID', 'iTRQ_ID') || ''),
            ORSV_ID: String(pickValue(raw, 'ORSV_ID', 'oRSV_ID') || editingOS.oRSV_ID),
            ITOS_TIPO: String(pickValue(raw, 'ITOS_TIPO', 'iTOS_TIPO') || 'P').toUpperCase().startsWith('S') ? 'S' : 'P',
            ITOS_DESCRICAO: String(pickValue(raw, 'ITOS_DESCRICAO', 'iTOS_DESCRICAO', 'PROD_NOME', 'pROD_NOME') || ''),
            ITOS_QTDE: qtde || 0,
            ITOS_VLR_UNITARIO: vUnit || 0,
            ITOS_DESCONTO: desc || 0,
            ITOS_VLR_TOTAL: total,
            ITOS_SALDO_ESTOQUE: parseNumber(pickValue(raw, 'SEST_QTD_SALDO', 'sEST_QTD_SALDO', 'SEST_SALDO', 'sest_Saldo')) || undefined,
            ITOS_UNIDADE_MEDIDA: String(pickValue(raw, 'ITOS_UNIDADE_MEDIDA', 'iTOS_UNIDADE_MEDIDA', 'ITRQ_UNID_SIGLA', 'iTRQ_UNID_SIGLA', 'PROD_UNIDADE', 'pROD_UNIDADE') || 'UN'),
            ITRQ_PRECO_TABELA: precoTabela || vUnit || 0,
            ITRQ_VLR_DESCONTO_SOBRE_TOTAL: desc || 0,
            PROD_ID: String(pickValue(raw, 'PROD_ID', 'pROD_ID') || ''),
            PROD_CODIGO: String(pickValue(raw, 'PROD_CODIGO', 'pROD_CODIGO') || ''),
          };
        });
        setItens(norm);

        toast.success(`OS #${editingOS.oRSV_NUMERO} carregada para edição`);
      } catch (e: any) {
        toast.error('Erro ao carregar OS: ' + e.message);
      }
    })();
  }, [editingOS, dataOS]);

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
  const descontoItens = itens.reduce((s, i) => s + i.ITOS_DESCONTO, 0);
  const totalFinal = Math.max(0, subtotal - descontoItens - descontoOS - descontoServico);

  const handleSave = async (finalizar = false) => {
    if (!cliente) { toast.error('Selecione um cliente'); return; }
    if (!veiculo) { toast.error('Selecione um veículo'); return; }

    setSaving(true);
    try {
      // Base p/ rateio proporcional do desconto sobre o total
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
          ITRQ_ID: i.ITRQ_ID || '',
          ITOS_ID: i.ITOS_ID || '',
          ORSV_ID: i.ORSV_ID || orsvId || '',
          PROD_ID: i.PROD_ID || '',
          ITOS_TIPO: i.ITOS_TIPO,
          ITOS_DESCRICAO: i.ITOS_DESCRICAO,
          ITOS_QTDE: i.ITOS_QTDE,
          ITOS_UNIDADE_MEDIDA: i.ITOS_UNIDADE_MEDIDA || 'UN',
          ITOS_VLR_UNITARIO: i.ITOS_VLR_UNITARIO,
          ITOS_DESCONTO: i.ITOS_DESCONTO,
          ITOS_VLR_TOTAL: i.ITOS_VLR_TOTAL,
          ITRQ_PRECO_TABELA: i.ITRQ_PRECO_TABELA ?? i.ITOS_VLR_UNITARIO,
          ITRQ_VLR_DESCONTO_SOBRE_TOTAL: rateioDescontoTotal,
        };
      });

      const payload: Record<string, any> = {
        ORSV_ID: orsvId || '',
        ORSV_NUMERO: orsvId ? numeroOS : '',
        ORSV_DATA: dataOS, // yyyy-MM-dd
        TPOS_ID: tipoOS || '',
        PESS_ID: cliente.PESS_ID,
        VEIC_ID: veiculo.VEIC_ID,
        VDDR_ID: vendedor?.VDDR_ID || '',
        TCNC_ID: tecnico?.TCNC_ID || '',
        MDIA_ID: midiaId || '',
        USRS_ID: auth?.user?.usrs_ID || '',
        ORSV_OBSERVACOES: observacoes,
        ORSV_NR_CHECKLIST: checklist,
        ORSV_HODOMETRO: hodometro,
        ORSV_VLR_SUBTOTAL: subtotal,
        ORSV_VLR_DESCONTO: descontoOS,
        ORSV_VLR_DESCONTO_SERVICO: descontoServico,
        ORSV_VLR_TOTAL: totalFinal,
        ORSV_STATUS: finalizar ? 'Finalizado' : 'Aberto',
        UNEM_ID: auth?.unidade?.unem_Id,
        itens: itensPayload,
      };
      console.log('=== PAYLOAD OS ===', JSON.stringify(payload, null, 2));
      const result = await saveOS(payload as Partial<OrdemServicoFull>);
      if (result.ORSV_ID) setOrsvId(result.ORSV_ID);
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
              <Wrench className="h-6 w-6" /> {editingOS ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{editingOS ? 'Alteração de OS existente' : 'Cadastro de OS para manutenção de veículos'}</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Data da OS</Label>
              <Input
                type="date"
                value={dataOS}
                onChange={(e) => setDataOS(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
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

        <ResumoFinanceiro
          itens={itens}
          descontoOS={descontoOS}
          descontoServico={descontoServico}
          onDescontoOSChange={setDescontoOS}
          onDescontoServicoChange={setDescontoServico}
        />
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
