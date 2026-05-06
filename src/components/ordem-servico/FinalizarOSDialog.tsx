import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, DollarSign } from "lucide-react";
import { toast } from "sonner";
import {
  getFormasPagamentos,
  getFormasPagamentosItens,
  getGerarVencimentos,
  getParametros,
  setFinalizarOS,
  type FormaPagamento,
  type FormaPagamentoItem,
  type ParcelaFinalizacao,
} from "@/lib/api-os";
import { getCofres, type Cofre } from "@/lib/api";

interface ParcelaUI {
  parcela: number;
  dias: number;
  vencimento: string; // YYYY-MM-DD (input date)
  perc: number;
  valor: number;
  tipo_pagamento: string;
  cofr_id: string;
  itfv_id?: string; // ID retornado por getGerarVencimentos para buscar tipos pagto
  tipoOptions?: FormaPagamentoItem[]; // opções carregadas via API
  loadingTipos?: boolean;
  // Campos de cartão por parcela
  tipo_cartao?: "" | "CREDITO" | "DEBITO";
  qtd_parcelas_cartao?: string;
  nr_auto?: string;
  bandeira?: string;
}

// Detecta se um tipo de pagamento textual é cartão e seu tipo
const detectarCartao = (texto: string): { isCartao: boolean; tipo: "" | "CREDITO" | "DEBITO" } => {
  const t = (texto || "").toUpperCase();
  const isCartao = /CART[ÃA]O|CARTAO/.test(t);
  if (!isCartao) return { isCartao: false, tipo: "" };
  const isDebito = /D[ÉE]BITO|DEBITO/.test(t);
  const isCredito = /CR[ÉE]DITO|CREDITO/.test(t);
  return { isCartao: true, tipo: isDebito && !isCredito ? "DEBITO" : "CREDITO" };
};

interface Props {
  open: boolean;
  onClose: () => void;
  orsvId: string;
  orsvNumero?: string;
  valorTotal: number;
  unemId?: string;
  emprId?: string;
  usrsId: string;
  onFinalized: () => void;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const isoToBrSlash = (iso: string) => {
  // YYYY-MM-DD -> YYYY/MM/DD
  return iso.replace(/-/g, "/");
};

const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

export default function FinalizarOSDialog({
  open,
  onClose,
  orsvId,
  orsvNumero,
  valorTotal,
  unemId,
  emprId,
  usrsId,
  onFinalized,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  const [cofres, setCofres] = useState<Cofre[]>([]);
  const [cofresServico, setCofresServico] = useState<Cofre[]>([]);
  const [unemIdServico, setUnemIdServico] = useState<string>("");
  const [formaSelecionada, setFormaSelecionada] = useState<string>("");
  const [cofrId, setCofrId] = useState<string>("");
  const [cofrServicoId, setCofrServicoId] = useState<string>("");
  const [parcelas, setParcelas] = useState<ParcelaUI[]>([]);
  const [previewPayload, setPreviewPayload] = useState<any | null>(null);
  // Campos específicos de cartão
  const [qtdParcelasCartao, setQtdParcelasCartao] = useState<string>("");
  const [nrAutoCartao, setNrAutoCartao] = useState<string>("");
  const [bandeiraCartao, setBandeiraCartao] = useState<string>("");

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
    () => formasOptions.find((item) => item.value === formaSelecionada),
    [formasOptions, formaSelecionada]
  );

  const formaAtualLabel = formaAtual?.label || "";
  const fpagIdSelecionado = String(formaAtual?.forma.FPAG_ID || "");

  // Detecta tipo cartão pela forma de pagamento (FPAG_TIPO ou nome)
  const tipoCartaoInfo = useMemo(() => {
    const tipoStr = `${formaAtual?.forma.FPAG_TIPO || ""} ${formaAtualLabel}`.toUpperCase();
    const isCartao = /CART[ÃA]O|CARTAO/.test(tipoStr);
    if (!isCartao) return { isCartao: false, tipoCartao: "" as "" | "CREDITO" | "DEBITO" };
    const isDebito = /D[ÉE]BITO|DEBITO/.test(tipoStr);
    const isCredito = /CR[ÉE]DITO|CREDITO/.test(tipoStr);
    const tipoCartao: "CREDITO" | "DEBITO" = isDebito && !isCredito ? "DEBITO" : "CREDITO";
    return { isCartao: true, tipoCartao };
  }, [formaAtual, formaAtualLabel]);
  const isCartaoCredito = tipoCartaoInfo.isCartao && tipoCartaoInfo.tipoCartao === "CREDITO";

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setFormaSelecionada("");
    setCofrId("");
    setCofrServicoId("");
    setUnemIdServico("");
    setCofresServico([]);
    setParcelas([]);
    setQtdParcelasCartao("");
    setNrAutoCartao("");
    setBandeiraCartao("");
    (async () => {
      setLoading(true);
      try {
        const [fp, cf, params] = await Promise.all([
          getFormasPagamentos(unemId).catch(() => [] as FormaPagamento[]),
          getCofres().catch(() => [] as Cofre[]),
          unemId
            ? getParametros({ unem_id: unemId, nome: "LojaFaturamentoServico" }).catch(() => [])
            : Promise.resolve([] as any[]),
        ]);
        setFormas(fp);
        setCofres(cf);
        if (cf.length > 0) {
          const carteira = cf.find((c) => /carteira/i.test(c.COFR_NOME || ""));
          const def = (carteira || cf[0]).COFR_ID;
          setCofrId(def);
        }

        // Parametro retorna o UNEM_ID da unidade de serviço
        const paramVal = Array.isArray(params) && params.length > 0
          ? String(
              (params[0] as any).PRMT_VALOR ||
              (params[0] as any).PARM_VALOR ||
              (params[0] as any).PARAM_VALOR ||
              (params[0] as any).PRMT_VALR ||
              (params[0] as any).VALOR ||
              (params[0] as any).UNEM_ID ||
              ""
            ).trim()
          : "";
        console.log("[FinalizarOS] LojaFaturamentoServico param:", params, "→ UNEM_ID_SERVICO:", paramVal);
        if (paramVal) {
          setUnemIdServico(paramVal);
          // Carrega cofres específicos da unidade de serviço
          try {
            const cfServ = await getCofres();
            setCofresServico(cfServ);
            if (cfServ.length > 0) {
              const carteira = cfServ.find((c) => /carteira/i.test(c.COFR_NOME || ""));
              setCofrServicoId((carteira || cfServ[0]).COFR_ID);
            }
          } catch {
            setCofresServico(cf);
            if (cf.length > 0) setCofrServicoId(cf[0].COFR_ID);
          }
        }
      } catch (e: any) {
        toast.error("Erro ao carregar formas de pagamento: " + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, unemId]);

  // Reset campos cartão ao trocar forma de pagamento
  useEffect(() => {
    setQtdParcelasCartao("");
    setNrAutoCartao("");
    setBandeiraCartao("");
  }, [formaSelecionada]);

  // Quando seleciona forma de pagamento -> chama getGerarVencimentos para popular a grid
  useEffect(() => {
    if (!formaAtual?.forma) {
      setParcelas([]);
      return;
    }
    const forma = formaAtual.forma;
    const fvenId = String(forma.FVEN_ID || forma.FPAG_ID || "");
    if (!fvenId || !cofrId) {
      setParcelas([]);
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
          valor: valorTotal,
          dataref,
        });

        if (!vencs || vencs.length === 0) {
          toast.error("Nenhum vencimento gerado pela API.");
          setParcelas([]);
          return;
        }

        const base: ParcelaUI[] = vencs
          .map((v: any, i) => {
            // Suporta ambos formatos: campos legados (VENCIMENTO/VALOR/...) e campos reais (ITFV_*)
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
  }, [formaAtual, cofrId, valorTotal]);

  const totalSomado = useMemo(
    () => parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0),
    [parcelas]
  );
  const totalPercentual = useMemo(
    () => parcelas.reduce((s, p) => s + (Number(p.perc) || 0), 0),
    [parcelas]
  );

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const round4 = (n: number) => Math.round(n * 10000) / 10000;

  const updateParcela = (idx: number, patch: Partial<ParcelaUI>) => {
    setParcelas((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const carregarTiposPagto = async (idx: number) => {
    const p = parcelas[idx];
    if (!p) return;
    if (p.tipoOptions && p.tipoOptions.length > 0) return; // já carregado
    if (!p.itfv_id || !p.cofr_id) return;
    updateParcela(idx, { loadingTipos: true });
    try {
      const itens = await getFormasPagamentosItens({
        itfv_id: p.itfv_id,
        cofr_id: p.cofr_id,
      });
      updateParcela(idx, { tipoOptions: itens, loadingTipos: false });
    } catch (e: any) {
      toast.error("Erro ao carregar tipos de pagamento: " + e.message);
      updateParcela(idx, { loadingTipos: false });
    }
  };

  // Redistribui valores/percentuais entre as demais parcelas para fechar 100% / total da OS
  const redistribuir = (idx: number, novoValor: number) => {
    setParcelas((prev) => {
      if (prev.length === 0) return prev;
      const total = valorTotal;
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
        return {
          ...p,
          valor: v,
          perc: total > 0 ? round4((v / total) * 100) : 0,
        };
      });
    });
  };

  const handlePercChange = (idx: number, novoPerc: number) => {
    const valor = round2((novoPerc / 100) * valorTotal);
    redistribuir(idx, valor);
  };

  const handleValorChange = (idx: number, novoValor: number) => {
    redistribuir(idx, round2(novoValor));
  };

  // Ajuste fino: se a diferença for até R$ 0,10, soma/subtrai na última parcela automaticamente
  const ajustarDiferenca = () => {
    setParcelas((prev) => {
      if (prev.length === 0) return prev;
      const soma = prev.reduce((s, p) => s + (Number(p.valor) || 0), 0);
      const diff = round2(valorTotal - soma);
      if (Math.abs(diff) === 0 || Math.abs(diff) > 0.1) return prev;
      const lastIdx = prev.length - 1;
      return prev.map((p, i) => {
        if (i !== lastIdx) return p;
        const novoValor = round2((Number(p.valor) || 0) + diff);
        return {
          ...p,
          valor: novoValor,
          perc: valorTotal > 0 ? round4((novoValor / valorTotal) * 100) : 0,
        };
      });
    });
  };

  const handleConfirmar = async () => {
    if (!formaAtual) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    if (parcelas.length === 0) {
      toast.error("Nenhuma parcela gerada.");
      return;
    }
    // Validar parcelas que são cartão
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
    // Ajuste automático para diferenças até R$ 0,10 antes de validar
    const somaAtual = parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    const diffAuto = round2(valorTotal - somaAtual);
    let parcelasAjustadas = parcelas;
    if (Math.abs(diffAuto) > 0 && Math.abs(diffAuto) <= 0.1) {
      const lastIdx = parcelas.length - 1;
      parcelasAjustadas = parcelas.map((p, i) => {
        if (i !== lastIdx) return p;
        const novoValor = round2((Number(p.valor) || 0) + diffAuto);
        return {
          ...p,
          valor: novoValor,
          perc: valorTotal > 0 ? round4((novoValor / valorTotal) * 100) : 0,
        };
      });
      setParcelas(parcelasAjustadas);
    }

    const somaFinal = parcelasAjustadas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    const diff = Math.abs(somaFinal - valorTotal);
    if (diff > 0.1) {
      toast.error(
        `Soma das parcelas (${fmtBRL(somaFinal)}) difere do total da OS (${fmtBRL(valorTotal)}).`
      );
      return;
    }
    const today = new Date();
    const dataFinalizacao = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;
    const fvenIdSelecionado = String(formaAtual?.forma.FVEN_ID || "");

    const payload = {
      ORSV_ID: orsvId,
      ORSV_NUMERO: orsvNumero,
      USRS_ID: usrsId,
      UNEM_ID: unemId,
      EMPR_ID: emprId,
      FPAG_ID: fpagIdSelecionado || String(formaAtual?.forma.FPAG_ID || formaAtual?.forma.FVEN_ID || ""),
      FVEN_ID: fvenIdSelecionado || String(formaAtual?.forma.FVEN_ID || formaAtual?.forma.FPAG_ID || ""),
      COFR_ID: cofrId,
      ...(unemIdServico ? { COFR_ID_SERVICO: cofrServicoId, UNEM_ID_SERVICO: unemIdServico } : {}),
      VALOR_TOTAL: round2(valorTotal),
      DATA_FINALIZACAO: dataFinalizacao,
      parcelas: parcelasAjustadas.map<ParcelaFinalizacao>((p) => {
        const info = detectarCartao(p.tipo_pagamento || formaAtualLabel);
        return {
          parcela: p.parcela,
          itfv_id: p.itfv_id,
          dias: p.dias,
          vencimento: isoToBrSlash(p.vencimento),
          perc: round4(p.perc),
          valor: round2(p.valor),
          tipo_pagamento: p.tipo_pagamento,
          cofr_id: p.cofr_id,
          TIPO_CARTAO: info.isCartao ? (p.tipo_cartao || info.tipo) : "",
          QTD_PARCELAS: info.isCartao
            ? (info.tipo === "DEBITO" ? 1 : Number(p.qtd_parcelas_cartao) || 0)
            : 0,
          NR_AUTO: info.isCartao ? (p.nr_auto || "") : "",
          BANDEIRA_CARTAO: info.isCartao ? (p.bandeira || "") : "",
        } as ParcelaFinalizacao;
      }),
    };
    setPreviewPayload(payload);
  };

  const executarFinalizacao = async () => {
    if (!previewPayload) return;
    setSaving(true);
    try {
      await setFinalizarOS(previewPayload);
      toast.success(`OS #${orsvNumero || ""} finalizada com sucesso.`);
      setPreviewPayload(null);
      onFinalized();
      onClose();
    } catch (e: any) {
      toast.error("Erro ao finalizar OS: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" /> Forma de Pagamento
          </DialogTitle>
          <DialogDescription>
            Finalizar OS <span className="font-mono font-semibold">#{orsvNumero}</span> — Total{" "}
            <span className="font-semibold">{fmtBRL(valorTotal)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-2">
            <div className={unemIdServico ? "col-span-3 flex flex-col gap-1" : "col-span-4 flex flex-col gap-1"}>
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
            {unemIdServico && (
              <div className="col-span-3 flex flex-col gap-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Cofre Serviço</Label>
                <Select value={cofrServicoId} onValueChange={setCofrServicoId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="SELECIONE" />
                  </SelectTrigger>
                  <SelectContent>
                    {(cofresServico.length > 0 ? cofresServico : cofres).map((c) => (
                      <SelectItem key={c.COFR_ID} value={c.COFR_ID} className="text-xs">
                        {c.COFR_NOME}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className={unemIdServico ? "col-span-6 flex flex-col gap-1" : "col-span-8 flex flex-col gap-1"}>
              <Label className="text-[10px] uppercase text-muted-foreground">Forma de Pagamento</Label>
              <Select value={formaSelecionada} onValueChange={setFormaSelecionada} disabled={loading}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={loading ? "CARREGANDO..." : "SELECIONE A FORMA DE PAGAMENTO"}>
                    {formaAtualLabel ? <span className="block truncate pr-4">{formaAtualLabel}</span> : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {formas.length === 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      Nenhuma forma cadastrada
                    </div>
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
            <div className="max-h-[280px] overflow-auto divide-y divide-border/40">
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
                        const venc = toISODate(addDays(new Date(), dias));
                        updateParcela(idx, { dias, vencimento: venc });
                      }}
                      disabled={isCartaoLinha && tipoCartaoLinha === "DEBITO"}
                      readOnly={isCartaoLinha && tipoCartaoLinha === "DEBITO"}
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
                          ? p.valor.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
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
                          const value = label;
                          if (!value) return null;
                          return (
                            <SelectItem key={`${it.TPPR_ID || it.FPGI_ID || i}-${i}`} value={value} className="text-[11px]">
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Tipo Cartão */}
                  <div className="col-span-2">
                    <Input
                      value={isCartaoLinha ? tipoCartaoLinha : ""}
                      readOnly
                      disabled={!isCartaoLinha}
                      className="h-6 text-[10px] uppercase font-semibold bg-muted/40 px-1"
                    />
                  </div>
                  {/* Qtd Parcelas Cartão */}
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min={1}
                      value={
                        isCartaoLinha && tipoCartaoLinha === "DEBITO"
                          ? "1"
                          : p.qtd_parcelas_cartao || ""
                      }
                      onChange={(e) => updateParcela(idx, { qtd_parcelas_cartao: e.target.value })}
                      disabled={!isCartaoLinha || tipoCartaoLinha === "DEBITO"}
                      readOnly={tipoCartaoLinha === "DEBITO"}
                      placeholder={isCartaoLinha ? "1" : ""}
                      className="h-6 text-[10px] px-1"
                    />
                  </div>
                  {/* Nr Auto */}
                  <div className="col-span-2">
                    <Input
                      value={p.nr_auto || ""}
                      onChange={(e) => updateParcela(idx, { nr_auto: e.target.value.toUpperCase() })}
                      disabled={!isCartaoLinha}
                      className="h-6 text-[10px] uppercase px-1"
                    />
                  </div>
                  {/* Bandeira */}
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
                          <SelectItem key={b} value={b} className="text-[10px]">{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Select
                      value={p.cofr_id}
                      onValueChange={(v) => updateParcela(idx, { cofr_id: v })}
                    >
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
              const diffValor = round2(valorTotal - totalSomado);
              const diffPerc = round2(100 - totalPercentual);
              const okValor = Math.abs(diffValor) <= 0.1;
              const okPerc = Math.abs(diffPerc) <= 0.01;
              return (
                <div className="flex items-center gap-3 px-2 py-1.5 bg-muted/40 text-[10px] font-semibold border-t border-border/60 uppercase tracking-wide">
                  <div className="text-muted-foreground">TOTAIS</div>
                  <div className={`${okPerc ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {totalPercentual.toFixed(2)}%
                  </div>
                  <div className={`${okValor ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {fmtBRL(totalSomado)}
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    {!okValor && Math.abs(diffValor) > 0 && (
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
                      TOTAL OS: <span className="text-foreground">{fmtBRL(valorTotal)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmar}
            disabled={saving || loading}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            )}
            Confirmar Finalização
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Preview da chamada ao backend */}
      <Dialog open={!!previewPayload} onOpenChange={(o) => { if (!o && !saving) setPreviewPayload(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Confirmação — Chamada ao Backend</DialogTitle>
            <DialogDescription>
              Revise os dados que serão enviados ao endpoint <span className="font-mono font-semibold">/setFinalizarOS</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-xs">
              <span className="font-semibold">Método:</span> <span className="font-mono">POST</span>
            </div>
            <div className="text-xs">
              <span className="font-semibold">Endpoint:</span> <span className="font-mono">/setFinalizarOS</span>
            </div>
            <div className="text-xs font-semibold">Payload (JSON):</div>
            <pre className="bg-muted p-3 rounded text-[11px] font-mono max-h-[400px] overflow-auto whitespace-pre-wrap break-all">
{previewPayload ? JSON.stringify(previewPayload, null, 2) : ""}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPreviewPayload(null)} disabled={saving}>
              Voltar
            </Button>
            <Button size="sm" onClick={executarFinalizacao} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Enviar e Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
