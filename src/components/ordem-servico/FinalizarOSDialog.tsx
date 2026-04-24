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
  const [fpagId, setFpagId] = useState<string>("");
  const [cofrId, setCofrId] = useState<string>("");
  const [cofrServicoId, setCofrServicoId] = useState<string>("");
  const [parcelas, setParcelas] = useState<ParcelaUI[]>([]);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setFpagId("");
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

  // Quando seleciona forma de pagamento -> buscar itens (parcelas)
  useEffect(() => {
    if (!fpagId) {
      setParcelas([]);
      return;
    }
    const forma = formas.find((f) => f.FPAG_ID === fpagId);
    (async () => {
      setLoading(true);
      try {
        const itens = await getFormasPagamentosItens(fpagId);
        const today = new Date();

        let base: ParcelaUI[] = [];
        if (itens && itens.length > 0) {
          base = itens
            .map((it) => ({
              parcela: Number(it.FPGI_PARCELA) || 1,
              dias: Number(it.FPGI_DIAS) || 0,
              perc: Number(it.FPGI_PERC) || 0,
              tipo_pagamento: String(it.FPGI_TIPO_PAGAMENTO || forma?.FPAG_TIPO || ""),
              cofr_id: String(it.COFR_ID || cofrId || ""),
              vencimento: "",
              valor: 0,
            }))
            .sort((a, b) => a.parcela - b.parcela);
        } else {
          // Fallback: gera parcelas pelo FPAG_PARCELAS (ex: "3X BOLETO" => 3 parcelas iguais com 30/60/90 dias)
          const totalParc = Number(forma?.FPAG_PARCELAS) || 1;
          const percEach = +(100 / totalParc).toFixed(4);
          const intervalo = totalParc > 1 ? 30 : 0;
          base = Array.from({ length: totalParc }, (_, i) => ({
            parcela: i + 1,
            dias: intervalo * (i + 1),
            perc: percEach,
            tipo_pagamento: String(forma?.FPAG_TIPO || ""),
            cofr_id: String(cofrId || ""),
            vencimento: "",
            valor: 0,
          }));
        }

        // Calcula vencimento e valor
        const totalPerc = base.reduce((s, p) => s + p.perc, 0) || 100;
        let acumulado = 0;
        base = base.map((p, idx) => {
          const vencDate = addDays(today, p.dias);
          const vencISO = toISODate(vencDate);
          let valor = +((valorTotal * p.perc) / totalPerc).toFixed(2);
          // Ajuste do residual na última parcela
          if (idx === base.length - 1) {
            valor = +(valorTotal - acumulado).toFixed(2);
          } else {
            acumulado += valor;
          }
          return { ...p, vencimento: vencISO, valor };
        });

        setParcelas(base);
      } catch (e: any) {
        toast.error("Erro ao carregar parcelas: " + e.message);
        setParcelas([]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fpagId]);

  const totalSomado = useMemo(
    () => parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0),
    [parcelas]
  );
  const totalPercentual = useMemo(
    () => parcelas.reduce((s, p) => s + (Number(p.perc) || 0), 0),
    [parcelas]
  );

  const updateParcela = (idx: number, patch: Partial<ParcelaUI>) => {
    setParcelas((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const handleConfirmar = async () => {
    if (!fpagId) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    if (parcelas.length === 0) {
      toast.error("Nenhuma parcela gerada.");
      return;
    }
    const diff = Math.abs(totalSomado - valorTotal);
    if (diff > 0.05) {
      toast.error(
        `Soma das parcelas (${fmtBRL(totalSomado)}) difere do total da OS (${fmtBRL(valorTotal)}).`
      );
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ORSV_ID: orsvId,
        USRS_ID: usrsId,
        FPAG_ID: fpagId,
        COFR_ID: cofrId,
        COFR_SERVICO_ID: cofrServicoId,
        parcelas: parcelas.map<ParcelaFinalizacao>((p) => ({
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
              <Select value={fpagId} onValueChange={setFpagId} disabled={loading}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={loading ? "CARREGANDO..." : "SELECIONE A FORMA DE PAGAMENTO"} />
                </SelectTrigger>
                <SelectContent>
                  {formas.length === 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      Nenhuma forma cadastrada
                    </div>
                  )}
                  {formas.map((f) => (
                    <SelectItem key={f.FPAG_ID} value={f.FPAG_ID} className="text-xs">
                      {f.FVEN_NOME || f.FPAG_NOME}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Grade de parcelas */}
          <div className="rounded-md border border-border overflow-hidden">
            <div className="grid grid-cols-12 gap-1 bg-muted/60 px-2 py-1 text-[10px] uppercase font-semibold text-muted-foreground">
              <div className="col-span-1">Parc.</div>
              <div className="col-span-1">Dias</div>
              <div className="col-span-2">Vencimento</div>
              <div className="col-span-1 text-right">Perc.</div>
              <div className="col-span-2 text-right">Valor</div>
              <div className="col-span-2">Tipo Pagto</div>
              <div className="col-span-3">Cofre Portador</div>
            </div>
            <div className="max-h-[280px] overflow-auto">
              {parcelas.length === 0 && (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                  {fpagId ? "Nenhuma parcela." : "Selecione a forma de pagamento."}
                </div>
              )}
              {parcelas.map((p, idx) => (
                <div
                  key={idx}
                  className={`grid grid-cols-12 gap-1 px-2 py-1 items-center text-xs ${
                    idx % 2 === 0 ? "" : "bg-muted/30"
                  }`}
                >
                  <div className="col-span-1 font-mono">{p.parcela}</div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      value={p.dias}
                      onChange={(e) => {
                        const dias = Number(e.target.value) || 0;
                        const venc = toISODate(addDays(new Date(), dias));
                        updateParcela(idx, { dias, vencimento: venc });
                      }}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="date"
                      value={p.vencimento}
                      onChange={(e) => updateParcela(idx, { vencimento: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={p.perc}
                      onChange={(e) => updateParcela(idx, { perc: Number(e.target.value) || 0 })}
                      className="h-7 text-xs text-right"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={p.valor}
                      onChange={(e) => updateParcela(idx, { valor: Number(e.target.value) || 0 })}
                      className="h-7 text-xs text-right"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      value={p.tipo_pagamento}
                      onChange={(e) =>
                        updateParcela(idx, { tipo_pagamento: e.target.value.toUpperCase() })
                      }
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="col-span-3">
                    <Select
                      value={p.cofr_id}
                      onValueChange={(v) => updateParcela(idx, { cofr_id: v })}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
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
                </div>
              ))}
            </div>
            {parcelas.length > 0 && (
              <div className="grid grid-cols-12 gap-1 px-2 py-1 bg-muted/60 text-[11px] font-semibold border-t border-border">
                <div className="col-span-4 text-right">Totais:</div>
                <div className="col-span-1 text-right">{totalPercentual.toFixed(2)}</div>
                <div className="col-span-2 text-right">{fmtBRL(totalSomado)}</div>
                <div className="col-span-5 text-right text-muted-foreground">
                  Total OS: {fmtBRL(valorTotal)}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmar}
            disabled={saving || loading || !fpagId || parcelas.length === 0}
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
