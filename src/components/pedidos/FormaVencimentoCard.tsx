import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import {
  getFormasPagamentos,
  getFormasPagamentosItens,
  getGerarVencimentos,
  type FormaPagamento,
  type FormaPagamentoItem,
} from '@/lib/api-os';
import { getCofres, type Cofre } from '@/lib/api';

export interface ParcelaUI {
  parcela: number;
  dias: number;
  vencimento: string;
  perc: number;
  valor: number;
  tipo_pagamento: string;
  cofr_id: string;
  itfv_id?: string;
  tipoOptions?: FormaPagamentoItem[];
  loadingTipos?: boolean;
}

interface Props {
  valorTotal: number;
  unemId?: string;
  formaSelecionada: string;
  onFormaChange: (v: string) => void;
  cofrId: string;
  onCofrChange: (v: string) => void;
  parcelas: ParcelaUI[];
  onParcelasChange: (p: ParcelaUI[]) => void;
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

export default function FormaVencimentoCard({
  valorTotal,
  unemId,
  formaSelecionada,
  onFormaChange,
  cofrId,
  onCofrChange,
  parcelas,
  onParcelasChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  const [cofres, setCofres] = useState<Cofre[]>([]);
  // Controla se o efeito de geração já rodou ao menos uma vez para a forma atual.
  // Quando os dados vêm carregados da API (edição/visualização), preservamos as parcelas
  // existentes na primeira execução em vez de regerar.
  const lastGenForma = useRef<string | null>(null);

  const formasOptions = useMemo(
    () =>
      formas.map((forma, index) => ({
        value: `${String(forma.FVEN_ID || forma.FPAG_ID || '')}|${String(forma.FPAG_ID || '')}|${index}`,
        forma,
        label: String(forma.FVEN_NOME || forma.FPAG_NOME || ''),
      })),
    [formas]
  );

  const formaAtual = useMemo(
    () => formasOptions.find((i) => i.value === formaSelecionada),
    [formasOptions, formaSelecionada]
  );
  const formaAtualLabel = formaAtual?.label || '';

  // Carrega formas e cofres
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [fp, cf] = await Promise.all([
          getFormasPagamentos(unemId).catch(() => [] as FormaPagamento[]),
          getCofres().catch(() => [] as Cofre[]),
        ]);
        setFormas(fp);
        setCofres(cf);
        if (cf.length > 0 && !cofrId) {
          const carteira = cf.find((c) => /carteira/i.test(c.COFR_NOME || ''));
          onCofrChange((carteira || cf[0]).COFR_ID);
        }
      } catch (e: any) {
        toast.error('Erro ao carregar formas de pagamento: ' + e.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unemId]);

  // Gerar vencimentos quando muda forma/cofre/valor
  useEffect(() => {
    if (!formaAtual?.forma) {
      onParcelasChange([]);
      return;
    }
    const forma = formaAtual.forma;
    const fvenId = String(forma.FVEN_ID || forma.FPAG_ID || '');
    if (!fvenId || !cofrId || !valorTotal) {
      onParcelasChange([]);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const today = new Date();
        const dataref = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
        const vencs = await getGerarVencimentos({ fven_id: fvenId, cofr_id: cofrId, valor: valorTotal, dataref });
        if (!vencs || vencs.length === 0) {
          onParcelasChange([]);
          return;
        }
        const base: ParcelaUI[] = vencs
          .map((v: any, i) => {
            const vencRaw = String(v.ITFV_DATA || v.VENCIMENTO || '').replace(/\//g, '-').slice(0, 10);
            return {
              parcela: Number(v.PARCELA) || i + 1,
              dias: Number(v.ITFV_DIAS ?? v.DIAS ?? 0),
              vencimento: vencRaw,
              perc: Number(v.ITFV_PERC ?? v.PERC ?? 0),
              valor: Number(v.ITFV_VLR ?? v.VALOR ?? 0),
              tipo_pagamento: String(v.TPPR_TIPO_PAGAMENTO || v.TIPO_PAGAMENTO || forma?.FPAG_TIPO || ''),
              cofr_id: String(v.COFR_ID || cofrId || ''),
              itfv_id: String(v.ITFV_ID || ''),
              tipoOptions: [],
              loadingTipos: false,
            };
          })
          .sort((a, b) => a.parcela - b.parcela);
        onParcelasChange(base);
      } catch (e: any) {
        toast.error('Erro ao gerar vencimentos: ' + e.message);
        onParcelasChange([]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formaAtual, cofrId, valorTotal]);

  const totalSomado = parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const totalPercentual = parcelas.reduce((s, p) => s + (Number(p.perc) || 0), 0);

  const updateParcela = (idx: number, patch: Partial<ParcelaUI>) => {
    onParcelasChange(parcelas.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const carregarTiposPagto = async (idx: number) => {
    const p = parcelas[idx];
    if (!p || (p.tipoOptions && p.tipoOptions.length > 0)) return;
    if (!p.itfv_id || !p.cofr_id) return;
    updateParcela(idx, { loadingTipos: true });
    try {
      const itens = await getFormasPagamentosItens({ itfv_id: p.itfv_id, cofr_id: p.cofr_id });
      updateParcela(idx, { tipoOptions: itens, loadingTipos: false });
    } catch (e: any) {
      toast.error('Erro ao carregar tipos de pagamento: ' + e.message);
      updateParcela(idx, { loadingTipos: false });
    }
  };

  const redistribuir = (idx: number, novoValor: number) => {
    if (parcelas.length === 0) return;
    const total = valorTotal;
    const valorClamp = Math.max(0, Math.min(novoValor, total));
    const restante = round2(total - valorClamp);
    const qtdOutros = parcelas.length - 1;
    const next = parcelas.map((p, i) =>
      i === idx
        ? { ...p, valor: round2(valorClamp), perc: total > 0 ? round4((valorClamp / total) * 100) : 0 }
        : p
    );
    if (qtdOutros === 0) { onParcelasChange(next); return; }
    const fatia = round2(restante / qtdOutros);
    let acumulado = 0, contador = 0;
    onParcelasChange(next.map((p, i) => {
      if (i === idx) return p;
      contador++;
      const isUlt = contador === qtdOutros;
      const v = isUlt ? round2(restante - acumulado) : fatia;
      acumulado = round2(acumulado + v);
      return { ...p, valor: v, perc: total > 0 ? round4((v / total) * 100) : 0 };
    }));
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" /> Forma de Vencimento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-5 flex flex-col gap-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Cofre</Label>
            <Select value={cofrId} onValueChange={onCofrChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="SELECIONE" />
              </SelectTrigger>
              <SelectContent>
                {cofres.map((c) => (
                  <SelectItem key={c.COFR_ID} value={c.COFR_ID} className="text-xs">{c.COFR_NOME}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-7 flex flex-col gap-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Forma de Pagamento</Label>
            <Select value={formaSelecionada} onValueChange={onFormaChange} disabled={loading}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={loading ? 'CARREGANDO...' : 'SELECIONE'}>
                  {formaAtualLabel ? <span className="block truncate pr-4">{formaAtualLabel}</span> : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {formas.length === 0 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">Nenhuma forma cadastrada</div>
                )}
                {formasOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value} className="text-xs">{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 overflow-hidden bg-card shadow-sm">
          <div className="grid grid-cols-12 gap-1 bg-muted/40 px-2 py-1.5 text-[9px] uppercase tracking-wide font-semibold text-muted-foreground border-b border-border/60">
            <div className="col-span-1">Parc.</div>
            <div className="col-span-1">Dias</div>
            <div className="col-span-3">Vencimento</div>
            <div className="col-span-1 text-right">%</div>
            <div className="col-span-2 text-right">Valor</div>
            <div className="col-span-2">Tipo Pagto</div>
            <div className="col-span-2">Cofre</div>
          </div>
          <div className="max-h-[260px] overflow-auto divide-y divide-border/40">
            {parcelas.length === 0 && (
              <div className="px-2 py-4 text-center text-[11px] text-muted-foreground">
                {formaAtual ? 'Nenhuma parcela.' : 'Selecione a forma de pagamento.'}
              </div>
            )}
            {parcelas.map((p, idx) => (
              <div key={idx} className={`grid grid-cols-12 gap-1 px-2 py-0.5 items-center text-[11px] ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}>
                <div className="col-span-1 font-mono text-foreground/80">{p.parcela}</div>
                <div className="col-span-1">
                  <Input
                    type="number"
                    value={p.dias}
                    onChange={(e) => {
                      const dias = Number(e.target.value) || 0;
                      updateParcela(idx, { dias, vencimento: toISODate(addDays(new Date(), dias)) });
                    }}
                    className="h-6 text-[10px] px-1"
                  />
                </div>
                <div className="col-span-3">
                  <Input type="date" value={p.vencimento} onChange={(e) => updateParcela(idx, { vencimento: e.target.value })} className="h-6 text-[10px] px-1" />
                </div>
                <div className="col-span-1">
                  <Input
                    type="number" step="0.01" value={p.perc}
                    onChange={(e) => updateParcela(idx, { perc: Number(e.target.value) || 0 })}
                    onBlur={(e) => redistribuir(idx, round2(((Number(e.target.value) || 0) / 100) * valorTotal))}
                    className="h-6 text-[10px] text-right px-1"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="text" inputMode="decimal"
                    value={Number.isFinite(p.valor) ? p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\./g, '').replace(',', '.');
                      const num = Number(raw);
                      updateParcela(idx, { valor: Number.isFinite(num) ? num : 0 });
                    }}
                    onBlur={(e) => {
                      const raw = e.target.value.replace(/\./g, '').replace(',', '.');
                      redistribuir(idx, Number(raw) || 0);
                    }}
                    className="h-6 text-[10px] text-right px-1 font-medium"
                  />
                </div>
                <div className="col-span-2">
                  <Select
                    value={p.tipo_pagamento}
                    onValueChange={(v) => updateParcela(idx, { tipo_pagamento: v })}
                    onOpenChange={(o) => { if (o) carregarTiposPagto(idx); }}
                  >
                    <SelectTrigger className="h-6 text-[11px] px-1.5">
                      <SelectValue placeholder={p.loadingTipos ? '...' : 'SEL.'}>
                        <span className="block truncate">{p.tipo_pagamento}</span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {p.loadingTipos && <div className="px-2 py-1 text-[11px] text-muted-foreground">Carregando...</div>}
                      {!p.loadingTipos && (!p.tipoOptions || p.tipoOptions.length === 0) && (
                        <div className="px-2 py-1 text-[11px] text-muted-foreground">Sem opções</div>
                      )}
                      {p.tipoOptions?.map((it, i) => {
                        const label = String(it.TPPR_TIPO_PAGAMENTO || it.TPPR_NOME || it.FPGI_TIPO_PAGAMENTO || '');
                        if (!label) return null;
                        return (
                          <SelectItem key={`${it.TPPR_ID || it.FPGI_ID || i}-${i}`} value={label} className="text-[11px]">{label}</SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Select value={p.cofr_id} onValueChange={(v) => updateParcela(idx, { cofr_id: v })}>
                    <SelectTrigger className="h-6 text-[11px] px-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {cofres.map((c) => (
                        <SelectItem key={c.COFR_ID} value={c.COFR_ID} className="text-[11px]">{c.COFR_NOME}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
          {parcelas.length > 0 && (() => {
            const diffValor = round2(valorTotal - totalSomado);
            const okValor = Math.abs(diffValor) <= 0.1;
            const okPerc = Math.abs(round2(100 - totalPercentual)) <= 0.01;
            return (
              <div className="flex items-center gap-3 px-2 py-1.5 bg-muted/40 text-[10px] font-semibold border-t border-border/60 uppercase tracking-wide">
                <div className="text-muted-foreground">TOTAIS</div>
                <div className={okPerc ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>{totalPercentual.toFixed(2)}%</div>
                <div className={okValor ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>{fmtBRL(totalSomado)}</div>
                <div className="ml-auto text-muted-foreground">TOTAL: <span className="text-foreground">{fmtBRL(valorTotal)}</span></div>
              </div>
            );
          })()}
        </div>
      </CardContent>
    </Card>
  );
}
