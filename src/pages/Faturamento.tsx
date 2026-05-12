import { Fragment, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Receipt, CheckCircle2, ChevronRight, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getPedidos, setFaturarPedido, type Pedido } from "@/lib/api";
import { getNegociacoesPedidos } from "@/lib/api-os";
import { getApiBaseUrl } from "@/lib/base-url";
import { toast } from "sonner";

interface Vencimento {
  parcela: number;
  vencimento: string;
  dias: number;
  perc: number;
  valor: number;
  tipo_pagamento: string;
}

export default function Faturamento() {
  const { auth } = useAuth();
  const [data, setData] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [faturando, setFaturando] = useState(false);
  
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [vencimentos, setVencimentos] = useState<Record<string, Vencimento[]>>({});
  const [loadingVenc, setLoadingVenc] = useState<Set<string>>(new Set());

  const today = new Date();
  const sevenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  const [dtInicial, setDtInicial] = useState(toISO(sevenDaysAgo));
  const [dtFinal, setDtFinal] = useState(toISO(today));

  const formatCurrency = (value?: number) =>
    (Number(value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (s?: string) => {
    if (!s) return "";
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString("pt-BR");
  };

  const handleSearch = async () => {
    if (!auth?.unidade?.unem_Id) {
      toast.error("Selecione uma unidade empresarial.");
      return;
    }
    setLoading(true);
    setSelected(new Set());
    try {
      const result = await getPedidos(auth.unidade.unem_Id, {
        status: "Abertos",
        dtInicial,
        dtFinal,
      });
      const list = Array.isArray(result) ? result : [];
      setData(list);
      setSearched(true);
      if (list.length === 0) toast.info("Nenhum pedido em aberto encontrado.");
    } catch (e: any) {
      toast.error("Erro ao buscar pedidos: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auth?.unidade?.unem_Id) handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.unidade?.unem_Id]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === data.length) setSelected(new Set());
    else setSelected(new Set(data.map((p) => p.PDDS_ID)));
  };

  const toggleExpand = async (id: string) => {
    const isOpen = expanded.has(id);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (isOpen) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!isOpen && !vencimentos[id]) {
      setLoadingVenc((prev) => new Set(prev).add(id));
      try {
        const raw = await getNegociacoesPedidos(id);
        const list: Vencimento[] = (Array.isArray(raw) ? raw : []).map((p: any, idx: number) => {
          const dataRaw = String(p.NGPD_DATA_VENCIMENTO || p.DATA_VENCIMENTO || '');
          let venc = '';
          if (/^\d{2}\/\d{2}\/\d{4}/.test(dataRaw)) {
            venc = dataRaw.slice(0, 10);
          } else if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(dataRaw)) {
            const s = dataRaw.slice(0, 10).replace(/\//g, '-');
            const [yyyy, mm, dd] = s.split('-');
            venc = `${dd}/${mm}/${yyyy}`;
          }
          return {
            parcela: idx + 1,
            vencimento: venc,
            dias: Number(p.NGPD_DIAS_VENCIMENTO || 0),
            perc: Number(String(p.NGPD_PERC_VENCIMENTO || '0').replace(',', '.')),
            valor: Number(String(p.NGPD_VLR_PARCELA || '0').replace(',', '.')),
            tipo_pagamento: String(p.NGPD_TIPO_PAGAMENTO || ''),
          };
        });
        setVencimentos((prev) => ({ ...prev, [id]: list }));
      } catch (e: any) {
        toast.error('Erro ao carregar vencimentos: ' + (e?.message || ''));
      } finally {
        setLoadingVenc((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
      }
    }
  };

  const totalSelecionado = data
    .filter((p) => selected.has(p.PDDS_ID))
    .reduce((s, p) => s + (Number(p.PDDS_VLR_TOTAL) || 0), 0);

  const handleFaturar = async () => {
    if (selected.size === 0) {
      toast.error("Selecione ao menos um pedido para faturar.");
      return;
    }
    if (!confirm(`Confirma o faturamento de ${selected.size} pedido(s)?`)) return;

    setFaturando(true);
    let okCount = 0;
    let failCount = 0;
    const failedIds: string[] = [];

    for (const id of Array.from(selected)) {
      try {
        const res = await setFaturarPedido(id);
        if (res.ok) okCount++;
        else { failCount++; failedIds.push(id); }
      } catch {
        failCount++;
        failedIds.push(id);
      }
    }

    setFaturando(false);
    if (okCount > 0) toast.success(`${okCount} pedido(s) faturado(s) com sucesso.`);
    if (failCount > 0) toast.error(`${failCount} pedido(s) com falha: ${failedIds.join(", ")}`);
    setSelected(new Set());
    handleSearch();
  };

  const baseUrl = getApiBaseUrl();
  const selectedPedidos = data.filter((p) => selected.has(p.PDDS_ID));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Faturamento
          </h1>
          <p className="text-sm text-muted-foreground">
            Pedidos em aberto disponíveis para faturamento
          </p>
        </div>
        <Button onClick={handleFaturar} disabled={faturando || selected.size === 0}>
          {faturando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
          Faturar selecionados ({selected.size})
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs">Data Inicial</Label>
              <Input type="date" value={dtInicial} onChange={(e) => setDtInicial(e.target.value)} className="h-8" />
            </div>
            <div>
              <Label className="text-xs">Data Final</Label>
              <Input type="date" value={dtFinal} onChange={(e) => setDtFinal(e.target.value)} className="h-8" />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Input value="Abertos" disabled className="h-8" />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead className="w-10">
                  <Checkbox
                    checked={data.length > 0 && selected.size === data.length}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                <TableHead>Nº</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!searched && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Use os filtros acima para buscar pedidos.
                  </TableCell>
                </TableRow>
              )}
              {searched && data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Nenhum pedido em aberto.
                  </TableCell>
                </TableRow>
              )}
              {data.map((p) => {
                const isOpen = expanded.has(p.PDDS_ID);
                const vencs = vencimentos[p.PDDS_ID] || [];
                const isLoading = loadingVenc.has(p.PDDS_ID);
                const vendedorNome =
                  (p as any).VDDR_NOME ||
                  (p as any).PESS_NOME_VENDEDOR ||
                  (p as any).vDDR_NOME ||
                  (p as any).pESS_NOME_VENDEDOR ||
                  p.USRS_NOME_LOGIN ||
                  '-';
                return (
                  <Fragment key={p.PDDS_ID}>
                    <TableRow key={p.PDDS_ID} data-state={selected.has(p.PDDS_ID) ? "selected" : undefined}>
                      <TableCell className="p-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleExpand(p.PDDS_ID)}
                          aria-label="Expandir"
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(p.PDDS_ID)}
                          onCheckedChange={() => toggle(p.PDDS_ID)}
                          aria-label={`Selecionar pedido ${p.PDDS_NUMERO}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono">{p.PDDS_NUMERO}</TableCell>
                      <TableCell>{formatDate(p.PDDS_DATA)}</TableCell>
                      <TableCell>{p.PESS_NOME || p.PESS_RAZAO_SOCIAL || "-"}</TableCell>
                      <TableCell>{vendedorNome}</TableCell>
                      <TableCell>
                        <Badge className="bg-primary text-primary-foreground">{p.PDDS_STATUS || "Aberto"}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(p.PDDS_VLR_TOTAL)}</TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={p.PDDS_ID + '-venc'} className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={8} className="p-3">
                          <div className="text-xs font-semibold mb-2">Vencimentos / Forma de Pagamento</div>
                          {isLoading ? (
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 mr-2 animate-spin" /> Carregando...
                            </div>
                          ) : vencs.length === 0 ? (
                            <div className="text-xs text-muted-foreground">Nenhum vencimento cadastrado.</div>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b text-left">
                                  <th className="py-1 px-2">Parc.</th>
                                  <th className="py-1 px-2">Vencimento</th>
                                  <th className="py-1 px-2">Dias</th>
                                  <th className="py-1 px-2 text-right">%</th>
                                  <th className="py-1 px-2">Tipo Pagamento</th>
                                  <th className="py-1 px-2 text-right">Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {vencs.map((v) => (
                                  <tr key={v.parcela} className="border-b last:border-0">
                                    <td className="py-1 px-2">{v.parcela}</td>
                                    <td className="py-1 px-2">{v.vencimento}</td>
                                    <td className="py-1 px-2">{v.dias}</td>
                                    <td className="py-1 px-2 text-right">{v.perc}%</td>
                                    <td className="py-1 px-2">{v.tipo_pagamento}</td>
                                    <td className="py-1 px-2 text-right font-medium">{formatCurrency(v.valor)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {data.length > 0 && (
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={7} className="text-right font-semibold">
                    Total selecionado:
                  </TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totalSelecionado)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedPedidos.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Payload de envio (setFaturarPedidos)</h2>
              <span className="text-xs text-muted-foreground">
                {selectedPedidos.length} requisição(ões) GET — uma por pedido
              </span>
            </div>
            <pre className="bg-muted/40 p-2 rounded overflow-auto max-h-60 text-xs whitespace-pre-wrap break-all">
{selectedPedidos
  .map((p) => `GET ${baseUrl}/setFaturarPedidos?id=${encodeURIComponent(p.PDDS_ID)}    # Nº ${p.PDDS_NUMERO}`)
  .join('\n')}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
