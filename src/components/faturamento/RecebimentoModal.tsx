import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, CreditCard, CheckCircle2, Banknote, Send } from "lucide-react";
import { toast } from "sonner";
import { setFaturarPedido, type Pedido } from "@/lib/api";
import { getNegociacoesPedidos, getFormasPagamentosItens, type ItemFormaVencimento, type FormaPagamentoItem } from "@/lib/api-os";
import { iniciarTransacaoTef, getTefProvider, setTefProvider, type TefProvider, type TefResultado } from "@/lib/tef";

interface Props {
  open: boolean;
  pedido: Pedido | null;
  fila: { atual: number; total: number };
  onClose: () => void;
  onFaturado: (pddsId: string) => void;
  onPular: (pddsId: string) => void;
}

interface FormaOpt extends ItemFormaVencimento {
  ITFV_ID: string;        // pode ser sintético para itens novos (ex: "new-<TPPR_ID>")
  ITFV_NOME: string;
  COFR_ID?: string;
  TPPR_ID?: string;
  IS_NEW?: boolean;
}

interface Pagamento {
  uid: string;
  itfvId?: string;       // pode ser vazio quando adicionado manualmente
  itfvNome: string;
  cofrId?: string;       // COFR_ID do vencimento de origem
  tpprId?: string;       // quando adicionado via getFormasPagamentosItens
  tef: boolean;
  tipoPagamento: string;
  valor: number;
  recebido?: number;
  parcelas?: number;
  tefStatus?: 'pendente' | 'aprovado' | 'cancelado';
  tefResult?: TefResultado;
}

const fmtBRL = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const isDinheiro = (tipo: string) => /DINHEIRO|ESPECIE/i.test(tipo);
const isCartao = (tipo: string) => /CART|CREDITO|DEBITO|CRÉDITO|DÉBITO/i.test(tipo);

const TEF_PROVIDERS: { value: TefProvider; label: string }[] = [
  { value: 'simulado', label: 'Simulado (testes)' },
  { value: 'paygo', label: 'PayGo' },
  { value: 'tef-id', label: 'TEF ID' },
  { value: 'cappta', label: 'Cappta' },
  { value: 'clisitef', label: 'CliSiTef' },
  { value: 'sw-express', label: 'Software Express' },
];

export default function RecebimentoModal({ open, pedido, fila, onClose, onFaturado, onPular }: Props) {
  const [loadingFormas, setLoadingFormas] = useState(false);
  const [formas, setFormas] = useState<FormaOpt[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [tefProvider, setTefProviderState] = useState<TefProvider>(getTefProvider());

  const total = Number(pedido?.PDDS_VLR_TOTAL || 0);
  const cliente = pedido?.PESS_NOME || pedido?.PESS_RAZAO_SOCIAL || "-";

  const totalPago = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const totalRecebido = pagamentos.reduce(
    (s, p) => s + (isDinheiro(p.tipoPagamento) ? Number(p.recebido || 0) : Number(p.valor || 0)),
    0
  );
  const troco = Math.max(0, totalRecebido - total);
  const saldo = +(total - totalPago).toFixed(2);
  const podeConfirmar =
    Math.abs(saldo) < 0.01 &&
    pagamentos.length > 0 &&
    pagamentos.every((p) => {
      if (p.tef) return p.tefStatus === 'aprovado';
      if (isDinheiro(p.tipoPagamento)) return (p.recebido || 0) >= p.valor - 0.01;
      return p.valor > 0;
    });

  // Carrega pagamentos diretamente das negociações do pedido (somente conferir)
  useEffect(() => {
    if (!open || !pedido) return;
    setPagamentos([]);
    setFormas([]);
    (async () => {
      setLoadingFormas(true);
      try {
        const negs = await getNegociacoesPedidos(pedido.PDDS_ID);
        const list = Array.isArray(negs) ? negs : [];
        const pags: Pagamento[] = list.map((n: any, idx: number) => {
          const itfvId = String(n.ITFV_ID || n.itfv_id || `neg-${idx}`);
          const nome = String(
            n.ITFV_NOME || n.itfv_nome || n.NGPD_TIPO_PAGAMENTO || n.TPPR_NOME || itfvId
          );
          const tipo = String(n.NGPD_TIPO_PAGAMENTO || n.ITFV_NOME || nome).toUpperCase();
          const tef = String(n.ITFV_TEF || n.itfv_tef || '').toLowerCase() === 'sim';
          const valor = +Number(String(n.NGPD_VLR_PARCELA || '0').replace(',', '.')).toFixed(2);
          const parcelas = Number(n.NGPD_QTD_PCLS || 1);
          return {
            uid: Math.random().toString(36).slice(2),
            itfvId,
            itfvNome: nome,
            tef,
            tipoPagamento: tipo,
            valor,
            recebido: isDinheiro(tipo) ? valor : undefined,
            parcelas: tef || isCartao(tipo) ? parcelas : undefined,
            tefStatus: tef ? 'pendente' : undefined,
          };
        });
        setPagamentos(pags);
        // Mantém uma lista de formas (apenas para o select usar como fallback)
        const dedup = Array.from(
          new Map(pags.map((p) => [p.itfvId, { ITFV_ID: p.itfvId, ITFV_NOME: p.itfvNome, ITFV_TEF: p.tef ? 'Sim' : 'Nao', TPPR_TIPO_PAGAMENTO: p.tipoPagamento } as FormaOpt])).values()
        );
        setFormas(dedup);
      } catch (e: any) {
        toast.error('Erro ao carregar pagamentos do pedido: ' + (e?.message || ''));
      } finally {
        setLoadingFormas(false);
      }
    })();
  }, [open, pedido?.PDDS_ID]);


  function buildPagamento(forma: FormaOpt, valor: number): Pagamento {
    const tipo = String(forma.TPPR_TIPO_PAGAMENTO || forma.ITFV_NOME || '').toUpperCase();
    const tef = String(forma.ITFV_TEF || '').toLowerCase() === 'sim';
    return {
      uid: Math.random().toString(36).slice(2),
      itfvId: forma.ITFV_ID,
      itfvNome: forma.ITFV_NOME,
      tef,
      tipoPagamento: tipo,
      valor: +valor.toFixed(2),
      recebido: isDinheiro(tipo) ? +valor.toFixed(2) : undefined,
      parcelas: tef || isCartao(tipo) ? Number(forma.NGPD_QTD_PCLS || 1) : undefined,
      tefStatus: tef ? 'pendente' : undefined,
    };
  }

  const adicionarPagamento = () => {
    if (formas.length === 0) {
      toast.error('Nenhuma forma de pagamento disponível.');
      return;
    }
    setPagamentos((prev) => [...prev, buildPagamento(formas[0], Math.max(0, saldo))]);
  };

  const removerPagamento = (uid: string) => {
    setPagamentos((prev) => prev.filter((p) => p.uid !== uid));
  };

  const atualizar = (uid: string, patch: Partial<Pagamento>) => {
    setPagamentos((prev) => prev.map((p) => (p.uid === uid ? { ...p, ...patch } : p)));
  };

  const trocarForma = (uid: string, itfvId: string) => {
    const f = formas.find((x) => x.ITFV_ID === itfvId);
    if (!f) return;
    const atual = pagamentos.find((p) => p.uid === uid);
    const valorAtual = atual?.valor ?? 0;
    setPagamentos((prev) =>
      prev.map((p) => (p.uid === uid ? { ...buildPagamento(f, valorAtual), uid } : p))
    );
  };

  const executarTef = async (uid: string) => {
    const pg = pagamentos.find((p) => p.uid === uid);
    if (!pg) return;
    const tipoCartao: 'credito' | 'debito' = /DEBITO|DÉBITO/i.test(pg.tipoPagamento) ? 'debito' : 'credito';
    atualizar(uid, { tefStatus: 'pendente' });
    toast.info(`TEF: iniciando transação (${tefProvider})...`);
    try {
      const res = await iniciarTransacaoTef({
        provider: tefProvider,
        tipo: tipoCartao,
        valor: pg.valor,
        parcelas: pg.parcelas || 1,
      });
      if (res.ok) {
        atualizar(uid, { tefStatus: 'aprovado', tefResult: res });
        toast.success(`TEF aprovado • NSU ${res.nsu} • AUT ${res.autorizacao}`);
      } else {
        atualizar(uid, { tefStatus: 'cancelado', tefResult: res });
        toast.error('TEF: ' + (res.mensagem || 'transação não aprovada'));
      }
    } catch (e: any) {
      atualizar(uid, { tefStatus: 'cancelado' });
      toast.error('Erro TEF: ' + (e?.message || ''));
    }
  };

  const confirmarFaturamento = async () => {
    if (!pedido) return;
    if (!podeConfirmar) {
      toast.error('Saldo deve ser zero e todos os pagamentos válidos.');
      return;
    }
    // valida TEF
    const algumTefPendente = pagamentos.some((p) => p.tef && p.tefStatus !== 'aprovado');
    if (algumTefPendente) {
      toast.error('Existe pagamento TEF não aprovado. Cancele ou execute o TEF.');
      return;
    }

    setConfirmando(true);
    try {
      console.log('[Recebimento] Faturando pedido', {
        pddsId: pedido.PDDS_ID,
        numero: pedido.PDDS_NUMERO,
        total,
        pagamentos,
      });
      const res = await setFaturarPedido(pedido.PDDS_ID);
      console.log('[Recebimento] Resposta faturamento', res);
      if (!res.ok) {
        toast.error('Falha ao faturar pedido ' + pedido.PDDS_NUMERO);
        setConfirmando(false);
        return;
      }
      toast.success(`Pedido ${pedido.PDDS_NUMERO} faturado.`);
      onFaturado(pedido.PDDS_ID);
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || ''));
    } finally {
      setConfirmando(false);
    }
  };

  if (!pedido) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
          <Card>
            <CardContent className="p-3">
              <div className="text-[10px] uppercase text-muted-foreground">Saldo</div>
              <div
                className={`text-2xl font-bold ${
                  Math.abs(saldo) < 0.01 ? 'text-emerald-600' : 'text-destructive'
                }`}
              >
                {fmtBRL(saldo)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TEF Provider */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Provedor TEF:</span>
          <Select
            value={tefProvider}
            onValueChange={(v) => {
              setTefProvider(v as TefProvider);
              setTefProviderState(v as TefProvider);
            }}
          >
            <SelectTrigger className="h-7 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEF_PROVIDERS.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Pagamentos */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">Pagamentos</div>
              <Button size="sm" variant="outline" onClick={adicionarPagamento} disabled={loadingFormas}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar
              </Button>
            </div>

            {loadingFormas && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 mr-2 animate-spin" /> Carregando formas...
              </div>
            )}

            {!loadingFormas && pagamentos.length === 0 && (
              <div className="text-xs text-muted-foreground">Nenhum pagamento adicionado.</div>
            )}

            <div className="space-y-2">
              {pagamentos.map((p) => (
                <div
                  key={p.uid}
                  className="grid grid-cols-12 gap-2 items-end border rounded-md p-2 bg-muted/20"
                >
                  <div className="col-span-12 md:col-span-4">
                    <Label className="text-[10px]">Forma</Label>
                    <Select value={p.itfvId} onValueChange={(v) => trocarForma(p.uid, v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {formas.map((f) => (
                          <SelectItem key={f.ITFV_ID} value={f.ITFV_ID} className="text-xs">
                            {f.ITFV_NOME}
                            {String(f.ITFV_TEF || '').toLowerCase() === 'sim' ? ' • TEF' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-6 md:col-span-2">
                    <Label className="text-[10px]">Valor</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-right"
                      value={p.valor}
                      onChange={(e) => atualizar(p.uid, { valor: Number(e.target.value) || 0 })}
                    />
                  </div>

                  {isDinheiro(p.tipoPagamento) && (
                    <div className="col-span-6 md:col-span-2">
                      <Label className="text-[10px]">Recebido</Label>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-right"
                        value={p.recebido ?? 0}
                        onChange={(e) => atualizar(p.uid, { recebido: Number(e.target.value) || 0 })}
                      />
                    </div>
                  )}

                  {(p.tef || isCartao(p.tipoPagamento)) && (
                    <div className="col-span-6 md:col-span-2">
                      <Label className="text-[10px]">Parcelas</Label>
                      <Input
                        type="number"
                        min={1}
                        max={24}
                        className="h-8 text-right"
                        value={p.parcelas ?? 1}
                        onChange={(e) =>
                          atualizar(p.uid, { parcelas: Math.max(1, Number(e.target.value) || 1) })
                        }
                      />
                    </div>
                  )}

                  <div className="col-span-6 md:col-span-1 text-[10px]">
                    {p.tef && (
                      <Badge
                        variant={
                          p.tefStatus === 'aprovado'
                            ? 'default'
                            : p.tefStatus === 'cancelado'
                            ? 'destructive'
                            : 'outline'
                        }
                        className="text-[10px]"
                      >
                        TEF {p.tefStatus}
                      </Badge>
                    )}
                  </div>

                  <div className="col-span-6 md:col-span-1 flex gap-1 justify-end">
                    {p.tef && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 px-2"
                        onClick={() => executarTef(p.uid)}
                      >
                        <CreditCard className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => removerPagamento(p.uid)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {p.tef && p.tefResult?.ok && (
                    <div className="col-span-12 text-[10px] text-muted-foreground bg-background rounded p-2 font-mono whitespace-pre-wrap">
                      NSU {p.tefResult.nsu} • AUT {p.tefResult.autorizacao} • {p.tefResult.bandeira} •{' '}
                      {p.tefResult.adquirente} • {p.tefResult.parcelas}x
                    </div>
                  )}

                  {isDinheiro(p.tipoPagamento) && (p.recebido || 0) > p.valor && (
                    <div className="col-span-12 text-[11px] text-emerald-600 font-semibold">
                      Troco: {fmtBRL((p.recebido || 0) - p.valor)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Totais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <Card>
            <CardContent className="p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Total Pedido</div>
              <div className="font-bold">{fmtBRL(total)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Recebido</div>
              <div className="font-bold">{fmtBRL(totalRecebido)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Troco</div>
              <div className="font-bold text-emerald-600">{fmtBRL(troco)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Saldo</div>
              <div
                className={`font-bold ${
                  Math.abs(saldo) < 0.01 ? 'text-emerald-600' : 'text-destructive'
                }`}
              >
                {fmtBRL(saldo)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ações */}
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
              const cliente = pedido.PESS_NOME || pedido.PESS_RAZAO_SOCIAL || '';
              const msg = `Olá ${cliente}, segue confirmação do pedido ${pedido.PDDS_NUMERO} no valor de ${fmtBRL(total)}.`;
              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
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
