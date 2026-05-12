import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, Banknote, Send, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { setFaturarPedido, getCofres, type Cofre, type Pedido } from "@/lib/api";
import {
  getNegociacoesPedidos,
  getFormasPagamentos,
  getFormasPagamentosItens,
  getGerarVencimentos,
  getParametros,
  getItensFormaVencimento,
  type FormaPagamento,
  type FormaPagamentoItem,
} from "@/lib/api-os";
import { iniciarTransacaoTef, getTefProvider, setTefProvider, type TefProvider } from "@/lib/tef";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  pedido: Pedido | null;
  fila: { atual: number; total: number };
  onClose: () => void;
  onFaturado: (pddsId: string) => void;
  onPular: (pddsId: string) => void;
}

interface ParcelaUI {
  parcela: number;
  dias: number;
  vencimento: string; // YYYY-MM-DD
  perc: number;
  valor: number;
  tipo_pagamento: string;
  cofr_id: string;
  itfv_id?: string;
  tipoOptions?: FormaPagamentoItem[];
  loadingTipos?: boolean;
  tipo_cartao?: "" | "CREDITO" | "DEBITO";
  qtd_parcelas_cartao?: string;
  nr_auto?: string;
  bandeira?: string;
  tefStatus?: "pendente" | "aprovado" | "cancelado";
}

const fmtBRL = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

const detectarCartao = (texto: string): { isCartao: boolean; tipo: "" | "CREDITO" | "DEBITO" } => {
  const t = (texto || "").toUpperCase();
  const isCartao = /CART[ÃA]O|CARTAO/.test(t);
  if (!isCartao) return { isCartao: false, tipo: "" };
  const isDebito = /D[ÉE]BITO|DEBITO/.test(t);
  const isCredito = /CR[ÉE]DITO|CREDITO/.test(t);
  return { isCartao: true, tipo: isDebito && !isCredito ? "DEBITO" : "CREDITO" };
};

// TEF Provider list (TefTipoGP)
const TEF_GP_LIST: { idx: number; value: string; label: string }[] = [
  { idx: 0, value: "gpNenhum", label: "Sem gerenciador padrão" },
  { idx: 1, value: "gpTEF_Dial", label: "TEF Discado antigo" },
  { idx: 2, value: "gpTEF_Disc", label: "TEF Dedicado" },
  { idx: 3, value: "gpCliSiTef", label: "Software Express / CliSiTef" },
  { idx: 4, value: "gpPayGo", label: "Pay&Go" },
  { idx: 5, value: "gpAPI", label: "Integração TEF via API" },
  { idx: 6, value: "gpTEF_Dial_Hipercard", label: "TEF Dial Hipercard" },
  { idx: 7, value: "gpTEF_Disc_Hipercard", label: "TEF Dedicado Hipercard" },
  { idx: 8, value: "gpCardScope", label: "CardScope" },
  { idx: 9, value: "gpAuttar", label: "Auttar" },
  { idx: 10, value: "gpVeSPague", label: "VeSPague" },
  { idx: 11, value: "gpCappta", label: "Cappta" },
  { idx: 12, value: "gpNTK", label: "NTK Solutions" },
  { idx: 13, value: "gpGetNetLio", label: "GetNet Lio" },
  { idx: 14, value: "gpPagSeguro", label: "PagSeguro" },
  { idx: 15, value: "gpStone", label: "Stone" },
  { idx: 16, value: "gpSafraPay", label: "SafraPay" },
  { idx: 17, value: "gpBin", label: "Bin" },
  { idx: 18, value: "gpCieloLio", label: "Cielo Lio" },
  { idx: 19, value: "gpMercadoPago", label: "Mercado Pago" },
  { idx: 20, value: "gpFiserv", label: "Fiserv" },
  { idx: 21, value: "gpTefId", label: "TEF ID" },
];
const GP_TO_PROVIDER: Record<string, TefProvider> = {
  gpPayGo: "paygo",
  gpTefId: "tef-id",
  gpCappta: "cappta",
  gpCliSiTef: "clisitef",
  gpAPI: "sw-express",
};
const gpToProvider = (gp: string): TefProvider => GP_TO_PROVIDER[gp] || "simulado";

export default function RecebimentoModal({ open, pedido, fila, onClose, onFaturado, onPular }: Props) {
  const { auth } = useAuth();
  const unemId = String((auth?.unidade as any)?.unem_Id || (auth?.unidade as any)?.unem_id || "");

  const [loading, setLoading] = useState(false);
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  const [cofres, setCofres] = useState<Cofre[]>([]);
  const [cofrId, setCofrId] = useState<string>("");
  const [formaSelecionada, setFormaSelecionada] = useState<string>("");
  const [parcelas, setParcelas] = useState<ParcelaUI[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [valorRecebido, setValorRecebido] = useState<number>(0);

  // TEF Provider (TefTipoGP)
  const [tefProvider, setTefProviderState] = useState<TefProvider>(getTefProvider());
  const [tefGpIdx, setTefGpIdx] = useState<number>(0);

  const total = Number(pedido?.PDDS_VLR_TOTAL || 0);
  const cliente = pedido?.PESS_NOME || pedido?.PESS_RAZAO_SOCIAL || "-";

  const formasOptions = useMemo(
    () =>
      formas.map((forma, index) => ({
        value: `${String(forma.FVEN_ID || forma.FPAG_ID || "")}|${String(forma.FPAG_ID || "")}|${index}`,
        forma,
        label: String(forma.FVEN_NOME || forma.FPAG_NOME || ""),
      })),
    [formas]
  );
  const formaAtual = useMemo(
    () => formasOptions.find((i) => i.value === formaSelecionada),
    [formasOptions, formaSelecionada]
  );
  const formaAtualLabel = formaAtual?.label || "";

  const totalSomado = useMemo(
    () => parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0),
    [parcelas]
  );
  const totalPercentual = useMemo(
    () => parcelas.reduce((s, p) => s + (Number(p.perc) || 0), 0),
    [parcelas]
  );

  // ===== Recebido / Troco / Valor a Receber =====
  const isDinheiroTipo = (t: string) => /DINHEIRO|ESPECIE/i.test(t || "");
  const totalDinheiro = useMemo(
    () =>
      parcelas
        .filter((p) => isDinheiroTipo(p.tipo_pagamento))
        .reduce((s, p) => s + (Number(p.valor) || 0), 0),
    [parcelas]
  );
  const hasDinheiro = totalDinheiro > 0;
  const troco = hasDinheiro ? Math.max(0, round2(valorRecebido - totalDinheiro)) : 0;
  const valorAReceber = Math.max(0, round2(total - totalSomado));

  // Auto-preenche o recebido com o total em dinheiro quando muda
  useEffect(() => {
    setValorRecebido(round2(totalDinheiro));
  }, [totalDinheiro]);

  // Reset + load base data
  useEffect(() => {
    if (!open || !pedido) return;
    setFormaSelecionada("");
    setCofrId("");
    setParcelas([]);

    (async () => {
      setLoading(true);
      try {
        const [fp, cf, negs] = await Promise.all([
          getFormasPagamentos(unemId).catch(() => [] as FormaPagamento[]),
          getCofres().catch(() => [] as Cofre[]),
          getNegociacoesPedidos(pedido.PDDS_ID).catch(() => [] as any[]),
        ]);
        setFormas(fp);
        setCofres(cf);

        const list = Array.isArray(negs) ? negs : [];
        console.log("[Recebimento] getNegociacoesPedidos:", list);

        // Cofre default: do pedido (negociações), senão "carteira", senão primeiro
        const cofrFromNegs = list.find((n: any) => n?.NGPD_COFR_ID || n?.COFR_ID) as any;
        const cofrPedido = cofrFromNegs
          ? String(cofrFromNegs.NGPD_COFR_ID || cofrFromNegs.COFR_ID || "")
          : "";
        const cofrDefault =
          cofrPedido ||
          (cf.length > 0
            ? (cf.find((c) => /carteira/i.test(c.COFR_NOME || "")) || cf[0]).COFR_ID
            : "");
        if (cofrDefault) setCofrId(cofrDefault);

        // Auto-seleciona Forma de Pagamento das negociações
        const fvenFromNegs = String((list[0] as any)?.FVEN_ID || "");
        if (fvenFromNegs) {
          const idx = fp.findIndex((f) => String(f.FVEN_ID || f.FPAG_ID || "") === fvenFromNegs);
          if (idx >= 0) {
            const f = fp[idx];
            setFormaSelecionada(`${String(f.FVEN_ID || f.FPAG_ID || "")}|${String(f.FPAG_ID || "")}|${idx}`);
          }
        }

        // Carrega grid diretamente das negociações do pedido
        if (list.length > 0) {
          const parsed: ParcelaUI[] = list.map((n: any, i: number) => {
            const tipo = String(
              n.NGPD_TIPO_PAGAMENTO || n.TPPR_TIPO_PAGAMENTO || n.ITFV_NOME || ""
            ).toUpperCase();
            const info = detectarCartao(tipo);
            const vencRaw = String(
              n.NGPD_DT_VENC || n.NGPD_DATA_VENCIMENTO || n.NGPD_VENCIMENTO || n.VENCIMENTO || ""
            )
              .replace(/\//g, "-")
              .slice(0, 10);
            const dias = Number(n.NGPD_DIAS ?? n.NGPD_QTD_DIAS ?? n.DIAS ?? 0);
            const perc = Number(String(n.NGPD_PERC ?? n.PERC ?? 0).toString().replace(",", "."));
            const valor = +Number(
              String(n.NGPD_VLR_PARCELA ?? n.NGPD_VALOR ?? n.VALOR ?? 0)
                .toString()
                .replace(",", ".")
            ).toFixed(2);
            const parcela = Number(n.NGPD_PARCELA ?? n.PARCELA ?? i + 1);
            const tpCart = String(n.NGPD_TIPO_CARTAO || "").toUpperCase();
            return {
              parcela,
              dias,
              vencimento: vencRaw,
              perc,
              valor,
              tipo_pagamento: tipo,
              cofr_id: String(n.NGPD_COFR_ID || n.COFR_ID || cofrDefault || ""),
              itfv_id: String(n.ITFV_ID || ""),
              tipoOptions: [],
              loadingTipos: false,
              tipo_cartao:
                tpCart === "DEBITO" || tpCart === "CREDITO"
                  ? (tpCart as "DEBITO" | "CREDITO")
                  : info.tipo,
              qtd_parcelas_cartao: info.isCartao
                ? String(n.NGPD_QTD_PCLS ?? n.NGPD_QTD_PARCELAS ?? "")
                : "",
              nr_auto: String(n.NGPD_NR_AUTO || n.NGPD_NSU || ""),
              bandeira: String(n.NGPD_BANDEIRA || "").toUpperCase(),
            };
          }).sort((a, b) => a.parcela - b.parcela);
          setParcelas(parsed);
        }
      } catch (e: any) {
        toast.error("Erro ao carregar dados: " + (e?.message || ""));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, pedido?.PDDS_ID, unemId]);

  // TEF Provider via getParametros TefTipoGP
  useEffect(() => {
    if (!open || !unemId) return;
    (async () => {
      try {
        const res = await getParametros({ unem_id: unemId, nome: "TefTipoGP" });
        const arr = Array.isArray(res) ? res : [];
        const valRaw = (arr[0] as any)?.PARM_VALOR ?? (arr[0] as any)?.parm_valor ?? "0";
        let item = TEF_GP_LIST[0];
        const num = Number(String(valRaw).trim());
        if (!Number.isNaN(num) && TEF_GP_LIST[num]) {
          item = TEF_GP_LIST[num];
        } else {
          const s = String(valRaw).trim();
          item = TEF_GP_LIST.find((x) => x.value.toLowerCase() === s.toLowerCase()) || TEF_GP_LIST[0];
        }
        setTefGpIdx(item.idx);
        const prov = gpToProvider(item.value);
        setTefProvider(prov);
        setTefProviderState(prov);
      } catch (e: any) {
        console.warn("[Recebimento] getParametros TefTipoGP falhou:", e?.message || e);
      }
    })();
  }, [open, unemId]);

  // Quando seleciona forma + cofre -> getGerarVencimentos
  useEffect(() => {
    if (!formaAtual?.forma) {
      // Não limpar — preserva grid carregada das negociações do pedido
      return;
    }
    const forma = formaAtual.forma;
    const fvenId = String(forma.FVEN_ID || forma.FPAG_ID || "");
    if (!fvenId || !cofrId || !total) {
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const today = new Date();
        const dataref = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;
        const vencs = await getGerarVencimentos({
          fven_id: fvenId,
          cofr_id: cofrId,
          valor: total,
          dataref,
        });
        if (!vencs || vencs.length === 0) {
          toast.error("Nenhum vencimento gerado pela API.");
          setParcelas([]);
          return;
        }
        const base: ParcelaUI[] = vencs
          .map((v: any, i) => {
            const vencRaw = String(v.ITFV_DATA || v.VENCIMENTO || "").replace(/\//g, "-").slice(0, 10);
            const dias = Number(v.ITFV_DIAS ?? v.DIAS ?? 0);
            const perc = Number(v.ITFV_PERC ?? v.PERC ?? 0);
            const valor = Number(v.ITFV_VLR ?? v.VALOR ?? 0);
            const tipo = String(v.TPPR_TIPO_PAGAMENTO || v.TIPO_PAGAMENTO || forma?.FPAG_TIPO || "");
            const parcela = Number(v.PARCELA) || i + 1;
            return {
              parcela,
              dias,
              vencimento: vencRaw,
              perc,
              valor,
              tipo_pagamento: tipo,
              cofr_id: String(v.COFR_ID || cofrId || ""),
              itfv_id: String(v.ITFV_ID || ""),
              tipoOptions: [],
              loadingTipos: false,
            };
          })
          .sort((a, b) => a.parcela - b.parcela);
        setParcelas(base);
      } catch (e: any) {
        toast.error("Erro ao gerar vencimentos: " + e.message);
        setParcelas([]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formaAtual, cofrId, total]);

  const updateParcela = (idx: number, patch: Partial<ParcelaUI>) => {
    setParcelas((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const carregarTiposPagto = async (idx: number) => {
    const p = parcelas[idx];
    if (!p) return;
    if (p.tipoOptions && p.tipoOptions.length > 0) return;
    if (!p.itfv_id || !p.cofr_id) return;
    updateParcela(idx, { loadingTipos: true });
    try {
      const itens = await getFormasPagamentosItens({ itfv_id: p.itfv_id, cofr_id: p.cofr_id });
      updateParcela(idx, { tipoOptions: itens, loadingTipos: false });
    } catch (e: any) {
      toast.error("Erro ao carregar tipos: " + e.message);
      updateParcela(idx, { loadingTipos: false });
    }
  };

  const redistribuir = (idx: number, novoValor: number) => {
    setParcelas((prev) => {
      if (prev.length === 0) return prev;
      const valorClamp = Math.max(0, Math.min(novoValor, total));
      const restante = round2(total - valorClamp);
      const outros = prev.filter((_, i) => i !== idx);
      const qtdOutros = outros.length;
      const next = prev.map((p, i) => {
        if (i === idx) {
          return {
            ...p,
            valor: round2(valorClamp),
            perc: total > 0 ? round4((valorClamp / total) * 100) : 0,
          };
        }
        return p;
      });
      if (qtdOutros === 0) return next;
      const fatia = round2(restante / qtdOutros);
      let acumulado = 0;
      let contador = 0;
      return next.map((p, i) => {
        if (i === idx) return p;
        contador++;
        const isUltimo = contador === qtdOutros;
        const v = isUltimo ? round2(restante - acumulado) : fatia;
        acumulado = round2(acumulado + v);
        return { ...p, valor: v, perc: total > 0 ? round4((v / total) * 100) : 0 };
      });
    });
  };
  const handlePercChange = (idx: number, novoPerc: number) =>
    redistribuir(idx, round2((novoPerc / 100) * total));
  const handleValorChange = (idx: number, novoValor: number) =>
    redistribuir(idx, round2(novoValor));

  const ajustarDiferenca = () => {
    setParcelas((prev) => {
      if (prev.length === 0) return prev;
      const soma = prev.reduce((s, p) => s + (Number(p.valor) || 0), 0);
      const diff = round2(total - soma);
      if (Math.abs(diff) === 0 || Math.abs(diff) > 0.1) return prev;
      const lastIdx = prev.length - 1;
      return prev.map((p, i) => {
        if (i !== lastIdx) return p;
        const novoValor = round2((Number(p.valor) || 0) + diff);
        return { ...p, valor: novoValor, perc: total > 0 ? round4((novoValor / total) * 100) : 0 };
      });
    });
  };

  const executarTefParcela = async (idx: number) => {
    const p = parcelas[idx];
    if (!p) return;
    const tipoCartao: "credito" | "debito" = /DEBITO|DÉBITO/i.test(p.tipo_pagamento) ? "debito" : "credito";
    updateParcela(idx, { tefStatus: "pendente" });
    toast.info(`TEF: iniciando transação (${tefProvider})...`);
    try {
      const res = await iniciarTransacaoTef({
        provider: tefProvider,
        tipo: tipoCartao,
        valor: p.valor,
        parcelas: Number(p.qtd_parcelas_cartao) || 1,
      });
      if (res.ok) {
        updateParcela(idx, {
          tefStatus: "aprovado",
          nr_auto: res.autorizacao || p.nr_auto,
          bandeira: res.bandeira || p.bandeira,
        });
        toast.success(`TEF aprovado • NSU ${res.nsu} • AUT ${res.autorizacao}`);
      } else {
        updateParcela(idx, { tefStatus: "cancelado" });
        toast.error("TEF: " + (res.mensagem || "transação não aprovada"));
      }
    } catch (e: any) {
      updateParcela(idx, { tefStatus: "cancelado" });
      toast.error("Erro TEF: " + (e?.message || ""));
    }
  };

  const confirmarFaturamento = async () => {
    if (!pedido) return;
    if (!formaAtual) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    if (parcelas.length === 0) {
      toast.error("Nenhuma parcela gerada.");
      return;
    }
    for (const p of parcelas) {
      const info = detectarCartao(p.tipo_pagamento || formaAtualLabel);
      if (info.isCartao) {
        const qtd = Number(p.qtd_parcelas_cartao);
        if (!qtd || qtd < 1) {
          toast.error(`Informe a Qtd. Parcelas do cartão na parcela ${p.parcela}.`);
          return;
        }
      }
    }
    const somaAtual = parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    const diff = Math.abs(somaAtual - total);
    if (diff > 0.1) {
      toast.error(`Soma das parcelas (${fmtBRL(somaAtual)}) difere do total (${fmtBRL(total)}).`);
      return;
    }

    setConfirmando(true);
    try {
      console.log("[Recebimento] Faturando pedido", {
        pddsId: pedido.PDDS_ID,
        numero: pedido.PDDS_NUMERO,
        total,
        forma: formaAtualLabel,
        cofrId,
        parcelas,
      });
      const res = await setFaturarPedido(pedido.PDDS_ID);
      console.log("[Recebimento] Resposta faturamento", res);
      if (!res.ok) {
        toast.error("Falha ao faturar pedido " + pedido.PDDS_NUMERO);
        setConfirmando(false);
        return;
      }
      toast.success(`Pedido ${pedido.PDDS_NUMERO} faturado.`);
      onFaturado(pedido.PDDS_ID);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || ""));
    } finally {
      setConfirmando(false);
    }
  };

  if (!pedido) return null;

  const okValor = Math.abs(round2(total - totalSomado)) <= 0.1;
  const podeConfirmar = !!formaAtual && parcelas.length > 0 && okValor;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Banknote className="h-5 w-5" />
            Recebimento — Pedido {pedido.PDDS_NUMERO}
            <Badge variant="outline" className="ml-2">
              {fila.atual} / {fila.total}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="md:col-span-2">
            <CardContent className="p-3">
              <div className="text-[10px] uppercase text-muted-foreground">Cliente</div>
              <div className="font-semibold truncate">{cliente}</div>
              <div className="text-[10px] uppercase text-muted-foreground mt-2">Pedido</div>
              <div className="font-mono">{pedido.PDDS_NUMERO}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-[10px] uppercase text-muted-foreground">Total</div>
              <div className="text-2xl font-bold">{fmtBRL(total)}</div>
            </CardContent>
          </Card>
        </div>

        {/* TEF Provider */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-muted-foreground">Provedor TEF:</span>
          <Select
            value={String(tefGpIdx)}
            onValueChange={(v) => {
              const idx = Number(v);
              const item = TEF_GP_LIST.find((x) => x.idx === idx) || TEF_GP_LIST[0];
              setTefGpIdx(idx);
              const prov = gpToProvider(item.value);
              setTefProvider(prov);
              setTefProviderState(prov);
            }}
          >
            <SelectTrigger className="h-7 w-[260px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEF_GP_LIST.map((p) => (
                <SelectItem key={p.idx} value={String(p.idx)} className="text-xs">
                  {p.idx} • {p.value} — {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-[10px]">driver: {tefProvider}</Badge>
        </div>

        {/* Forma + Cofre */}
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-4 flex flex-col gap-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Cofre</Label>
            <Select value={cofrId} onValueChange={setCofrId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="SELECIONE" />
              </SelectTrigger>
              <SelectContent>
                {cofres.map((c) => (
                  <SelectItem key={c.COFR_ID} value={c.COFR_ID} className="text-xs">
                    {c.COFR_NOME}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-8 flex flex-col gap-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Forma de Pagamento</Label>
            <Select value={formaSelecionada} onValueChange={setFormaSelecionada} disabled={loading}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={loading ? "CARREGANDO..." : "SELECIONE A FORMA DE PAGAMENTO"}>
                  {formaAtualLabel ? <span className="block truncate pr-4">{formaAtualLabel}</span> : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {formasOptions.length === 0 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">Nenhuma forma cadastrada</div>
                )}
                {formasOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value} className="text-xs">
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Grid de Parcelas (mesmo padrão da Finalizar OS) */}
        <div className="rounded-lg border border-border/60 overflow-hidden bg-card shadow-sm">
          <div className="grid grid-cols-24 gap-1 bg-muted/40 px-2 py-1.5 text-[9px] uppercase tracking-wide font-semibold text-muted-foreground border-b border-border/60">
            <div className="col-span-1">Parc.</div>
            <div className="col-span-1">Dias</div>
            <div className="col-span-3">Vencimento</div>
            <div className="col-span-2 text-right">%</div>
            <div className="col-span-3 text-right">Valor</div>
            <div className="col-span-3">Tipo Pagto</div>
            <div className="col-span-2">Tipo Cartão</div>
            <div className="col-span-2">Qtd. Parc. <span className="text-destructive">*</span></div>
            <div className="col-span-2">Nr. Auto</div>
            <div className="col-span-2">Bandeira</div>
            <div className="col-span-3">Cofre Portador</div>
          </div>
          <div className="max-h-[300px] overflow-auto divide-y divide-border/40">
            {parcelas.length === 0 && (
              <div className="px-2 py-4 text-center text-[11px] text-muted-foreground">
                {formaAtual ? "Nenhuma parcela." : "Selecione a forma de pagamento."}
              </div>
            )}
            {parcelas.map((p, idx) => {
              const cartaoInfo = detectarCartao(p.tipo_pagamento || formaAtualLabel);
              const isCartaoLinha = cartaoInfo.isCartao;
              const tipoCartaoLinha = p.tipo_cartao || cartaoInfo.tipo;
              return (
                <div
                  key={idx}
                  className={`grid grid-cols-24 gap-1 px-2 py-0.5 items-center text-[11px] transition-colors hover:bg-accent/30 ${
                    idx % 2 === 0 ? "" : "bg-muted/20"
                  }`}
                >
                  <div className="col-span-1 font-mono text-[11px] text-foreground/80">{p.parcela}</div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      value={isCartaoLinha && tipoCartaoLinha === "DEBITO" ? 1 : p.dias}
                      onChange={(e) => {
                        const dias = Number(e.target.value) || 0;
                        updateParcela(idx, { dias, vencimento: toISODate(addDays(new Date(), dias)) });
                      }}
                      disabled={isCartaoLinha && tipoCartaoLinha === "DEBITO"}
                      className="h-6 text-[10px] px-1"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="date"
                      value={p.vencimento}
                      onChange={(e) => updateParcela(idx, { vencimento: e.target.value })}
                      className="h-6 text-[10px] px-1"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={p.perc}
                      onChange={(e) => updateParcela(idx, { perc: Number(e.target.value) || 0 })}
                      onBlur={(e) => handlePercChange(idx, Number(e.target.value) || 0)}
                      className="h-6 text-[10px] text-right px-1"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={
                        Number.isFinite(p.valor)
                          ? p.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : "0,00"
                      }
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\./g, "").replace(",", ".");
                        const num = Number(raw);
                        updateParcela(idx, { valor: Number.isFinite(num) ? num : 0 });
                      }}
                      onBlur={(e) => {
                        const raw = e.target.value.replace(/\./g, "").replace(",", ".");
                        handleValorChange(idx, Number(raw) || 0);
                      }}
                      className="h-6 text-[10px] text-right px-1 font-medium"
                    />
                  </div>
                  <div className="col-span-3">
                    <Select
                      value={p.tipo_pagamento}
                      onValueChange={(v) => {
                        const info = detectarCartao(v);
                        const isDeb = info.isCartao && info.tipo === "DEBITO";
                        const patch: Partial<ParcelaUI> = {
                          tipo_pagamento: v,
                          tipo_cartao: info.isCartao ? info.tipo : "",
                        };
                        if (isDeb) {
                          patch.dias = 1;
                          patch.vencimento = toISODate(addDays(new Date(), 1));
                        }
                        updateParcela(idx, patch);
                      }}
                      onOpenChange={(o) => { if (o) carregarTiposPagto(idx); }}
                    >
                      <SelectTrigger className="h-6 text-[11px] px-1.5">
                        <SelectValue placeholder={p.loadingTipos ? "..." : "SELECIONE"}>
                          <span className="block truncate">{p.tipo_pagamento}</span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {p.loadingTipos && (
                          <div className="px-2 py-1 text-[11px] text-muted-foreground">Carregando...</div>
                        )}
                        {!p.loadingTipos && (!p.tipoOptions || p.tipoOptions.length === 0) && (
                          <div className="px-2 py-1 text-[11px] text-muted-foreground">Sem opções</div>
                        )}
                        {p.tipoOptions?.map((it, i) => {
                          const label = String(it.TPPR_TIPO_PAGAMENTO || it.TPPR_NOME || it.FPGI_TIPO_PAGAMENTO || "");
                          if (!label) return null;
                          return (
                            <SelectItem key={`${it.TPPR_ID || it.FPGI_ID || i}-${i}`} value={label} className="text-[11px]">
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input
                      value={isCartaoLinha ? tipoCartaoLinha : ""}
                      readOnly
                      disabled={!isCartaoLinha}
                      className="h-6 text-[10px] uppercase font-semibold bg-muted/40 px-1"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min={1}
                      value={isCartaoLinha && tipoCartaoLinha === "DEBITO" ? "1" : p.qtd_parcelas_cartao || ""}
                      onChange={(e) => updateParcela(idx, { qtd_parcelas_cartao: e.target.value })}
                      disabled={!isCartaoLinha || tipoCartaoLinha === "DEBITO"}
                      placeholder={isCartaoLinha ? "1" : ""}
                      className="h-6 text-[10px] px-1"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-1">
                      <Input
                        value={p.nr_auto || ""}
                        onChange={(e) => updateParcela(idx, { nr_auto: e.target.value.toUpperCase() })}
                        disabled={!isCartaoLinha}
                        className="h-6 text-[10px] uppercase px-1"
                      />
                      {isCartaoLinha && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-6 px-1 shrink-0"
                          onClick={() => executarTefParcela(idx)}
                          title="Executar TEF"
                        >
                          <CreditCard className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {p.tefStatus && (
                      <Badge
                        variant={
                          p.tefStatus === "aprovado"
                            ? "default"
                            : p.tefStatus === "cancelado"
                            ? "destructive"
                            : "outline"
                        }
                        className="text-[9px] mt-0.5"
                      >
                        TEF {p.tefStatus}
                      </Badge>
                    )}
                  </div>
                  <div className="col-span-2">
                    <Select
                      value={p.bandeira || ""}
                      onValueChange={(v) => updateParcela(idx, { bandeira: v })}
                      disabled={!isCartaoLinha}
                    >
                      <SelectTrigger className="h-6 text-[10px] px-1.5">
                        <SelectValue placeholder={isCartaoLinha ? "SEL." : ""} />
                      </SelectTrigger>
                      <SelectContent>
                        {["VISA", "MASTERCARD", "ELO", "AMEX", "HIPERCARD", "DINERS", "OUTRA"].map((b) => (
                          <SelectItem key={b} value={b} className="text-[10px]">
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Select value={p.cofr_id} onValueChange={(v) => updateParcela(idx, { cofr_id: v })}>
                      <SelectTrigger className="h-6 text-[11px] px-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {cofres.map((c) => (
                          <SelectItem key={c.COFR_ID} value={c.COFR_ID} className="text-[11px]">
                            {c.COFR_NOME}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
          {parcelas.length > 0 && (() => {
            const diffValor = round2(total - totalSomado);
            const diffPerc = round2(100 - totalPercentual);
            const okV = Math.abs(diffValor) <= 0.1;
            const okP = Math.abs(diffPerc) <= 0.01;
            return (
              <div className="flex items-center gap-3 px-2 py-1.5 bg-muted/40 text-[10px] font-semibold border-t border-border/60 uppercase tracking-wide">
                <div className="text-muted-foreground">TOTAIS</div>
                <div className={okP ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                  {totalPercentual.toFixed(2)}%
                </div>
                <div className={okV ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                  {fmtBRL(totalSomado)}
                </div>
                <div className="ml-auto flex items-center gap-3">
                  {!okV && Math.abs(diffValor) > 0 && (
                    <button
                      type="button"
                      onClick={ajustarDiferenca}
                      className="px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 text-[9px] uppercase tracking-wide"
                      title="Ajustar diferença na última parcela"
                    >
                      AJUSTAR {fmtBRL(diffValor)}
                    </button>
                  )}
                  <div className="text-muted-foreground">
                    TOTAL PEDIDO: <span className="text-foreground">{fmtBRL(total)}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Resumo de Recebimento */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
          <Card>
            <CardContent className="p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Total Pedido</div>
              <div className="font-bold tabular-nums">{fmtBRL(total)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Total Parcelas</div>
              <div className="font-bold tabular-nums">{fmtBRL(totalSomado)}</div>
            </CardContent>
          </Card>
          <Card className={hasDinheiro ? "" : "opacity-60"}>
            <CardContent className="p-2">
              <Label className="text-[10px] uppercase text-muted-foreground">
                Recebido (Dinheiro)
              </Label>
              <Input
                type="text"
                inputMode="decimal"
                disabled={!hasDinheiro}
                value={valorRecebido.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\./g, "").replace(",", ".");
                  const num = Number(raw);
                  setValorRecebido(Number.isFinite(num) ? num : 0);
                }}
                onBlur={(e) => {
                  const raw = e.target.value.replace(/\./g, "").replace(",", ".");
                  setValorRecebido(round2(Number(raw) || 0));
                }}
                className="h-7 text-right font-bold tabular-nums px-1"
              />
              <div className="text-[9px] text-muted-foreground mt-0.5">
                Dinheiro: {fmtBRL(totalDinheiro)}
              </div>
            </CardContent>
          </Card>
          <Card className={troco > 0 ? "border-emerald-500/50" : ""}>
            <CardContent className="p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Troco</div>
              <div
                className={`font-bold tabular-nums ${
                  troco > 0 ? "text-emerald-600 dark:text-emerald-400" : ""
                }`}
              >
                {fmtBRL(troco)}
              </div>
            </CardContent>
          </Card>
          <Card className={valorAReceber > 0 ? "border-destructive/50" : "border-emerald-500/50"}>
            <CardContent className="p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Valor a Receber</div>
              <div
                className={`font-bold tabular-nums ${
                  valorAReceber > 0
                    ? "text-destructive"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {fmtBRL(valorAReceber)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <Button variant="outline" onClick={() => onPular(pedido.PDDS_ID)} disabled={confirmando}>
            Pular
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={confirmando}>
            Fechar tudo
          </Button>
          <Button
            variant="secondary"
            disabled={!podeConfirmar || confirmando}
            onClick={() => {
              const cli = pedido.PESS_NOME || pedido.PESS_RAZAO_SOCIAL || "";
              const msg = `Olá ${cli}, segue confirmação do pedido ${pedido.PDDS_NUMERO} no valor de ${fmtBRL(total)}.`;
              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
            }}
          >
            <Send className="h-4 w-4 mr-1" /> WhatsApp
          </Button>
          <Button onClick={confirmarFaturamento} disabled={!podeConfirmar || confirmando} size="lg">
            {confirmando ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Confirmar Faturamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
