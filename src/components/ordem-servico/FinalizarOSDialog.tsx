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
  getGerarVencimentos,
  setFinalizarOS,
  type FormaPagamento,
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
          .map((v) => {
            // Normaliza vencimento (pode vir YYYY/MM/DD ou YYYY-MM-DD)
            const venc = String(v.VENCIMENTO || "").replace(/\//g, "-").slice(0, 10);
            return {
              parcela: Number(v.PARCELA) || 1,
              dias: Number(v.DIAS) || 0,
              vencimento: venc,
              perc: Number(v.PERC) || 0,
              valor: Number(v.VALOR) || 0,
              tipo_pagamento: String(v.TIPO_PAGAMENTO || forma?.FPAG_TIPO || ""),
              cofr_id: String(v.COFR_ID || cofrId || ""),
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

  const updateParcela = (idx: number, patch: Partial<ParcelaUI>) => {
    setParcelas((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
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
        FPAG_ID: fpagIdSelecionado,
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
                  {formaAtual ? "Nenhuma parcela." : "Selecione a forma de pagamento."}
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
