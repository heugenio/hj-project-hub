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
}

interface Props {
  open: boolean;
  onClose: () => void;
  orsvId: string;
  orsvNumero?: string;
  valorTotal: number;
  unemId?: string;
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
  usrsId,
  onFinalized,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  const [cofres, setCofres] = useState<Cofre[]>([]);
  const [formaSelecionada, setFormaSelecionada] = useState<string>("");
  const [cofrId, setCofrId] = useState<string>("");
  const [cofrServicoId, setCofrServicoId] = useState<string>("");
  const [parcelas, setParcelas] = useState<ParcelaUI[]>([]);

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

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setFormaSelecionada("");
    setCofrId("");
    setCofrServicoId("");
    setParcelas([]);
    (async () => {
      setLoading(true);
      try {
        const [fp, cf] = await Promise.all([
          getFormasPagamentos(unemId).catch(() => [] as FormaPagamento[]),
          getCofres().catch(() => [] as Cofre[]),
        ]);
        setFormas(fp);
        setCofres(cf);
        if (cf.length > 0) {
          const carteira = cf.find((c) => /carteira/i.test(c.COFR_NOME || ""));
          const def = (carteira || cf[0]).COFR_ID;
          setCofrId(def);
          setCofrServicoId(def);
        }
      } catch (e: any) {
        toast.error("Erro ao carregar formas de pagamento: " + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, unemId]);

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
    if (!fpagIdSelecionado) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    if (parcelas.length === 0) {
      toast.error("Nenhuma parcela gerada.");
      return;
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
    setSaving(true);
    try {
      const payload = {
        ORSV_ID: orsvId,
        USRS_ID: usrsId,
        FPAG_ID: fpagIdSelecionado,
        COFR_ID: cofrId,
        COFR_SERVICO_ID: cofrServicoId,
        parcelas: parcelasAjustadas.map<ParcelaFinalizacao>((p) => ({
          parcela: p.parcela,
          vencimento: isoToBrSlash(p.vencimento),
          perc: p.perc,
          valor: p.valor,
          tipo_pagamento: p.tipo_pagamento,
          cofr_id: p.cofr_id,
        })),
      };
      await setFinalizarOS(payload);
      toast.success(`OS #${orsvNumero || ""} finalizada com sucesso.`);
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
      <DialogContent className="max-w-4xl">
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
            <div className="col-span-3 flex flex-col gap-1">
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
            <div className="col-span-3 flex flex-col gap-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Cofre Serviço</Label>
              <Select value={cofrServicoId} onValueChange={setCofrServicoId}>
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
            <div className="col-span-6 flex flex-col gap-1">
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

          {/* Grade de parcelas */}
          <div className="rounded-lg border border-border/60 overflow-hidden bg-card shadow-sm">
            <div className="grid grid-cols-12 gap-1 bg-muted/40 px-2 py-1.5 text-[9px] uppercase tracking-wide font-semibold text-muted-foreground border-b border-border/60">
              <div className="col-span-1">Parc.</div>
              <div className="col-span-1">Dias</div>
              <div className="col-span-2">Vencimento</div>
              <div className="col-span-1 text-right">%</div>
              <div className="col-span-2 text-right">Valor</div>
              <div className="col-span-2">Tipo Pagto</div>
              <div className="col-span-3">Cofre Portador</div>
            </div>
            <div className="max-h-[280px] overflow-auto divide-y divide-border/40">
              {parcelas.length === 0 && (
                <div className="px-2 py-4 text-center text-[11px] text-muted-foreground">
                  {formaAtual ? "Nenhuma parcela." : "Selecione a forma de pagamento."}
                </div>
              )}
              {parcelas.map((p, idx) => (
                <div
                  key={idx}
                  className={`grid grid-cols-12 gap-1 px-2 py-0.5 items-center text-[11px] transition-colors hover:bg-accent/30 ${
                    idx % 2 === 0 ? "" : "bg-muted/20"
                  }`}
                >
                  <div className="col-span-1 font-mono text-[11px] text-foreground/80">{p.parcela}</div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      value={p.dias}
                      onChange={(e) => {
                        const dias = Number(e.target.value) || 0;
                        const venc = toISODate(addDays(new Date(), dias));
                        updateParcela(idx, { dias, vencimento: venc });
                      }}
                      className="h-6 text-[11px] px-1.5"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="date"
                      value={p.vencimento}
                      onChange={(e) => updateParcela(idx, { vencimento: e.target.value })}
                      className="h-6 text-[11px] px-1.5"
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={p.perc}
                      onChange={(e) => updateParcela(idx, { perc: Number(e.target.value) || 0 })}
                      onBlur={(e) => handlePercChange(idx, Number(e.target.value) || 0)}
                      className="h-6 text-[11px] text-right px-1.5"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={p.valor}
                      onChange={(e) => updateParcela(idx, { valor: Number(e.target.value) || 0 })}
                      onBlur={(e) => handleValorChange(idx, Number(e.target.value) || 0)}
                      className="h-6 text-[11px] text-right px-1.5 font-medium"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      value={p.tipo_pagamento}
                      onChange={(e) =>
                        updateParcela(idx, { tipo_pagamento: e.target.value.toUpperCase() })
                      }
                      className="h-6 text-[11px] px-1.5"
                    />
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
              ))}
            </div>
            {parcelas.length > 0 && (() => {
              const diffValor = round2(valorTotal - totalSomado);
              const diffPerc = round2(100 - totalPercentual);
              const okValor = Math.abs(diffValor) <= 0.1;
              const okPerc = Math.abs(diffPerc) <= 0.01;
              return (
                <div className="grid grid-cols-12 gap-1 px-2 py-1.5 bg-muted/40 text-[10px] font-semibold border-t border-border/60 items-center">
                  <div className="col-span-4 text-right uppercase tracking-wide text-muted-foreground">Totais</div>
                  <div className={`col-span-1 text-right ${okPerc ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {totalPercentual.toFixed(2)}%
                  </div>
                  <div className={`col-span-2 text-right ${okValor ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {fmtBRL(totalSomado)}
                  </div>
                  <div className="col-span-5 text-right text-muted-foreground flex items-center justify-end gap-2">
                    {!okValor && Math.abs(diffValor) > 0 && (
                      <button
                        type="button"
                        onClick={ajustarDiferenca}
                        className="px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 text-[9px] uppercase tracking-wide"
                        title="Ajustar diferença na última parcela"
                      >
                        Ajustar {fmtBRL(diffValor)}
                      </button>
                    )}
                    Total OS: <span className="text-foreground">{fmtBRL(valorTotal)}</span>
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
            disabled={saving || loading || !fpagIdSelecionado || parcelas.length === 0}
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
    </Dialog>
  );
}
