import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { getComparativo, getComparativoResumo, getUnidadesEmpresariais, getDemonstrativoVendas, type Comparativo, type ComparativoResumo, type UnidadeEmpresarial, type SalesDemo } from "@/lib/api";
import {
  DollarSign, TrendingUp, TrendingDown, Package, ShoppingCart,
  ArrowUpRight, ArrowDownRight, Loader2, BarChart3, Wallet, CreditCard, Store, Filter,
  Receipt, Percent, BadgeDollarSign, RefreshCw
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(160, 60%, 40%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(340, 65%, 50%)",
];

function parseCurrency(val: string | undefined): number {
  if (!val) return 0;
  return parseFloat(val.replace(/\./g, "").replace(",", ".")) || parseFloat(val) || 0;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseGrowth(val: string | undefined): number {
  if (!val) return 0;
  return parseFloat(val.replace(",", ".")) || 0;
}

function normalizeGroupName(value: string | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^\d+\s*-\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

type Perfil = "ADM" | "Vendas" | "FINANCEIRO" | string;

export default function Dashboard() {
  const { auth } = useAuth();
  const [comparativo, setComparativo] = useState<Comparativo[]>([]);
  const [comparativoGeral, setComparativoGeral] = useState<Comparativo[]>([]);
  const [resumo, setResumo] = useState<ComparativoResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [resumoLojas, setResumoLojas] = useState<ComparativoResumo[]>([]);
  const [unidadesMap, setUnidadesMap] = useState<Record<string, { sigla: string; uf: string }>>({});
  const [filtroGrpoTipo, setFiltroGrpoTipo] = useState<string>("__pending__");
  const [salesData, setSalesData] = useState<SalesDemo[]>([]);

  const perfil: Perfil = auth?.user?.GRUS_PERFIL || "ADM";
  const unemId = auth?.unidade?.unem_Id || "";
  const emprId = unemId.substring(0, 8);

  // Para ADM, passa apenas os 8 primeiros caracteres (nível empresa/corporação)
  const resumoId = perfil === "ADM" ? emprId : unemId;

  useEffect(() => {
    if (!unemId) return;
    setLoading(true);

    // Datas do mês atual
    const now = new Date();
    const dtInicial = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/01`;
    const dtFinal = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

    const fetches: Promise<unknown>[] = [
      getComparativo(unemId),
      getComparativoResumo(resumoId),
      getDemonstrativoVendas({ dtInicial, dtFinal, unem_id: unemId }),
    ];

    // Para ADM, buscar comparativo e unidades de todas as lojas
    if (perfil === "ADM" && emprId) {
      fetches.push(getUnidadesEmpresariais(emprId));
      fetches.push(getComparativo(resumoId)); // comparativo de todas as lojas com GRPO_TIPO
    }

    Promise.all(fetches)
      .then(([comp, res, sales, unidades, compGeral]) => {
        setComparativo((comp as Comparativo[]) || []);
        const lojas = (res as ComparativoResumo[]) || [];
        setResumoLojas(lojas);
        setSalesData((sales as SalesDemo[]) || []);
        setComparativoGeral((compGeral as Comparativo[]) || []);

        // Resumo da unidade logada
        const lojaLogada = lojas.find((l) => l.UNEM_ID === unemId);
        setResumo(lojaLogada || lojas[0] || null);

        // Mapear UNEM_ID → { sigla, uf }
        if (unidades && Array.isArray(unidades)) {
          const map: Record<string, { sigla: string; uf: string }> = {};
          (unidades as UnidadeEmpresarial[]).forEach((u) => {
            map[u.unem_Id] = {
              sigla: u.unem_Sigla || u.unem_Fantasia || u.unem_Id,
              uf: u.unem_Uf || "",
            };
          });
          setUnidadesMap(map);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [unemId, resumoId, perfil, emprId]);


  // Lista única de GRPO_TIPO para o filtro
  const grpoTipos = useMemo(() => {
    const tipos = new Set<string>();
    comparativo.forEach((item) => tipos.add(item.GRPO_TIPO || "Geral"));
    return Array.from(tipos).sort();
  }, [comparativo]);

  // Auto-detectar "Pneus" no primeiro carregamento
  useEffect(() => {
    if (filtroGrpoTipo !== "__pending__" || grpoTipos.length === 0) return;
    const pneusTipo = grpoTipos.find((t) => t.toLowerCase().includes("pneu"));
    setFiltroGrpoTipo(pneusTipo || "__all__");
  }, [grpoTipos, filtroGrpoTipo]);

  // Dados filtrados
  const comparativoFiltrado = useMemo(() => {
    if (filtroGrpoTipo === "__all__" || filtroGrpoTipo === "__pending__") return comparativo;
    return comparativo.filter((item) => (item.GRPO_TIPO || "Geral") === filtroGrpoTipo);
  }, [comparativo, filtroGrpoTipo]);

  // Comparativo geral (todas as lojas) filtrado por tipo
  const comparativoGeralFiltrado = useMemo(() => {
    if (filtroGrpoTipo === "__all__" || filtroGrpoTipo === "__pending__") return comparativoGeral;
    return comparativoGeral.filter((item) => (item.GRPO_TIPO || "Geral") === filtroGrpoTipo);
  }, [comparativoGeral, filtroGrpoTipo]);

  // Filtrar salesData pelo mesmo GRPO_TIPO do filtro
  const gruposFiltrados = useMemo(() => {
    if (filtroGrpoTipo === "__all__" || filtroGrpoTipo === "__pending__") return null;

    const nomes = new Set<string>();
    comparativoFiltrado.forEach((item) => {
      const nomeNormalizado = normalizeGroupName(item.GRPO_NOME);
      if (nomeNormalizado) nomes.add(nomeNormalizado);
    });

    const tipoNormalizado = normalizeGroupName(filtroGrpoTipo);
    if (tipoNormalizado) nomes.add(tipoNormalizado);

    return nomes;
  }, [comparativoFiltrado, filtroGrpoTipo]);

  const salesDataFiltrado = useMemo(() => {
    if (!gruposFiltrados) return salesData;
    return salesData.filter((item) => gruposFiltrados.has(normalizeGroupName(item.GRUPO)));
  }, [salesData, gruposFiltrados]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // KPIs do comparativo filtrado (somando todos os grupos do filtro ativo)
  const vlrAtual = comparativoFiltrado.reduce((s, item) => s + parseCurrency(item.ITFT_VLR_CONTABIL), 0);
  const vlrAnterior = comparativoFiltrado.reduce((s, item) => s + parseCurrency(item.ITFT_VLR_CONTABIL_ANT), 0);
  const qtdAtual = comparativoFiltrado.reduce((s, item) => s + parseCurrency(item.ITFT_QTDE), 0);
  const qtdAnterior = comparativoFiltrado.reduce((s, item) => s + parseCurrency(item.ITFT_QTDE_ANT), 0);
  const crescimento = vlrAnterior > 0 ? ((vlrAtual - vlrAnterior) / vlrAnterior) * 100 : 0;

  // KPIs derivados do demonstrativo de vendas (filtrado)
  const totalFaturamento = salesDataFiltrado.reduce((s, item) => s + parseCurrency(item.ITFT_VLR_CONTABIL), 0);
  const totalQtdVendida = salesDataFiltrado.reduce((s, item) => s + parseCurrency(item.ITFT_QTDE_FATURADA), 0);
  const ticketMedio = totalQtdVendida > 0 ? totalFaturamento / totalQtdVendida : 0;
  const totalLucro = salesDataFiltrado.reduce(
    (s, item) => s + (parseCurrency(item.ITFT_VLR_LUCRO) || (parseCurrency(item.ITFT_VLR_CONTABIL) - parseCurrency(item.ITFT_CUSTO_NA_OPERACAO))),
    0
  );
  const margemMedia = totalFaturamento > 0 ? (totalLucro / totalFaturamento) * 100 : 0;

  // Recompra: usa DCFS_QTD quando disponível; senão faz fallback para quantidade faturada
  const totalBaseRecompra = salesDataFiltrado.reduce(
    (s, item) => s + (parseCurrency(item.DCFS_QTD) || parseCurrency(item.ITFT_QTDE_FATURADA)),
    0
  );
  const totalDev = salesDataFiltrado.reduce((s, item) => s + parseCurrency(item.QTDE_DEV), 0);
  const taxaRecompra = totalBaseRecompra > 0 ? ((totalBaseRecompra - totalDev) / totalBaseRecompra) * 100 : 0;

  // Separar comparativo por GRPO_TIPO e ordenar por valor
  const tiposMap = new Map<string, Comparativo[]>();
  comparativoFiltrado.forEach((item) => {
    const tipo = item.GRPO_TIPO || "Geral";
    if (!tiposMap.has(tipo)) tiposMap.set(tipo, []);
    tiposMap.get(tipo)!.push(item);
  });

  // Ordenar cada grupo por valor atual decrescente
  const tiposEntries = Array.from(tiposMap.entries()).map(([tipo, items]) => ({
    tipo,
    items: [...items].sort((a, b) => parseCurrency(b.ITFT_VLR_CONTABIL) - parseCurrency(a.ITFT_VLR_CONTABIL)),
  }));

  const pieData = comparativoFiltrado
    .filter((item) => parseCurrency(item.ITFT_VLR_CONTABIL) > 0)
    .map((item) => ({
      name: item.GRPO_NOME || "N/A",
      value: parseCurrency(item.ITFT_VLR_CONTABIL),
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão geral — Perfil: <Badge variant="secondary" className="ml-1">{perfil}</Badge>
          </p>
        </div>
        {grpoTipos.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filtroGrpoTipo === "__pending__" ? "__all__" : filtroGrpoTipo} onValueChange={setFiltroGrpoTipo}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os Tipos</SelectItem>
                {grpoTipos.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Summary cards — 6 KPIs modernos */}
      {(() => {
        const tipoLabel = filtroGrpoTipo === "__all__" || filtroGrpoTipo === "__pending__"
          ? "Quantidades"
          : `${filtroGrpoTipo} Vendidos`;
        return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard icon={DollarSign} title="Faturamento" value={formatBRL(vlrAtual)} subtitle={`Ant: ${formatBRL(vlrAnterior)}`} change={crescimento} />
          <KpiCard icon={Package} title={tipoLabel} value={qtdAtual.toLocaleString("pt-BR")} subtitle={`Ant: ${qtdAnterior.toLocaleString("pt-BR")}`} change={qtdAnterior > 0 ? ((qtdAtual - qtdAnterior) / qtdAnterior) * 100 : undefined} />
          <KpiCard icon={Receipt} title="Ticket Médio" value={formatBRL(ticketMedio)} />
          <KpiCard icon={Percent} title="Margem Média" value={`${margemMedia.toFixed(1)}%`} />
          <KpiCard icon={BadgeDollarSign} title="Lucro Líquido" value={formatBRL(totalLucro)} />
          <KpiCard icon={RefreshCw} title="Recompra" value={`${taxaRecompra.toFixed(1)}%`} />
        </div>
        );
      })()}

      {/* Multi-lojas — ADM only */}
      {perfil === "ADM" && resumoLojas.length > 1 && (() => {
        // Agregar comparativoGeralFiltrado por UNEM_ID (respeita o filtro de tipo, todas as lojas)
        const lojasAgregadas = Object.values(
          comparativoGeralFiltrado.reduce<Record<string, { UNEM_ID: string; vlr: number; vlrAnt: number; qtd: number; qtdAnt: number }>>((acc, item) => {
            const id = item.UNEM_ID;
            if (!acc[id]) acc[id] = { UNEM_ID: id, vlr: 0, vlrAnt: 0, qtd: 0, qtdAnt: 0 };
            acc[id].vlr += parseCurrency(item.ITFT_VLR_CONTABIL);
            acc[id].vlrAnt += parseCurrency(item.ITFT_VLR_CONTABIL_ANT);
            acc[id].qtd += parseCurrency(item.ITFT_QTDE);
            acc[id].qtdAnt += parseCurrency(item.ITFT_QTDE_ANT);
            return acc;
          }, {})
        );

        // Ordenar: UF da loja logada primeiro, depois por UF e sigla
        const ufLogada = unidadesMap[unemId]?.uf || "";
        const lojasOrdenadas = [...lojasAgregadas].sort((a, b) => {
          const ufA = unidadesMap[a.UNEM_ID]?.uf || "";
          const ufB = unidadesMap[b.UNEM_ID]?.uf || "";
          if (ufA === ufLogada && ufB !== ufLogada) return -1;
          if (ufB === ufLogada && ufA !== ufLogada) return 1;
          if (ufA !== ufB) return ufA.localeCompare(ufB);
          const siglaA = unidadesMap[a.UNEM_ID]?.sigla || a.UNEM_ID;
          const siglaB = unidadesMap[b.UNEM_ID]?.sigla || b.UNEM_ID;
          return siglaA.localeCompare(siglaB);
        });

        return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Visão Multi-Lojas</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {lojasOrdenadas.map((loja, i) => {
              const growth = loja.vlrAnt > 0 ? ((loja.vlr - loja.vlrAnt) / loja.vlrAnt) * 100 : 0;
              const isLogada = loja.UNEM_ID === unemId;
              const info = unidadesMap[loja.UNEM_ID];
              const uf = info?.uf || "";
              const sigla = uf ? `${uf} - ${info?.sigla || loja.UNEM_ID}` : (info?.sigla || loja.UNEM_ID || `Loja ${i + 1}`);

              return (
                <Card
                  key={loja.UNEM_ID}
                  className={`border-border/50 relative overflow-hidden transition-shadow hover:shadow-lg ${isLogada ? "ring-2 ring-primary/60" : ""}`}
                >
                  {isLogada && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                      LOGADA
                    </div>
                  )}
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Store className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-semibold text-foreground text-sm truncate">{sigla}</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Fat. Atual</span>
                        <span className="text-sm font-bold text-foreground">{formatBRL(loja.vlr)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Fat. Anterior</span>
                        <span className="text-xs text-muted-foreground">{formatBRL(loja.vlrAnt)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Qtd. Atual</span>
                        <span className="text-xs text-foreground">{loja.qtd.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Qtd. Anterior</span>
                        <span className="text-xs text-muted-foreground">{loja.qtdAnt.toLocaleString("pt-BR")}</span>
                      </div>
                    </div>

                    {/* Growth bar */}
                    <div className="pt-1 border-t border-border/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Crescimento</span>
                        <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${growth >= 0 ? "text-accent" : "text-destructive"}`}>
                          {growth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {growth.toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${growth >= 0 ? "bg-primary" : "bg-destructive"}`}
                          style={{ width: `${Math.min(Math.abs(growth), 100)}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Card Totalizador */}
            <Card className="border-border/50 bg-muted/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-bold text-foreground text-sm">TOTAL</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Fat. Atual</span>
                    <span className="text-sm font-bold text-foreground">{formatBRL(lojasOrdenadas.reduce((s, l) => s + l.vlr, 0))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Fat. Anterior</span>
                    <span className="text-xs text-muted-foreground">{formatBRL(lojasOrdenadas.reduce((s, l) => s + l.vlrAnt, 0))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Qtd. Atual</span>
                    <span className="text-xs text-foreground">{lojasOrdenadas.reduce((s, l) => s + l.qtd, 0).toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Qtd. Anterior</span>
                    <span className="text-xs text-muted-foreground">{lojasOrdenadas.reduce((s, l) => s + l.qtdAnt, 0).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        );
      })()}

      {/* Profile-specific sections — Chart split by GRPO_TIPO */}
      {(perfil === "ADM" || perfil === "Vendas") && (
        <div className="space-y-4">
          {tiposEntries.length === 0 ? (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Comparativo por Grupo (Atual vs Anterior)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm text-center py-10">Sem dados disponíveis</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                {tiposEntries.map(({ tipo, items }) => {
                  const chartData = items.map((item) => ({
                    grupo: item.GRPO_NOME || "N/A",
                    atual: parseCurrency(item.ITFT_VLR_CONTABIL),
                    anterior: parseCurrency(item.ITFT_VLR_CONTABIL_ANT),
                    qtdAtual: parseCurrency(item.ITFT_QTDE),
                    qtdAnterior: parseCurrency(item.ITFT_QTDE_ANT),
                  }));

                  return (
                    <Card key={tipo} className="border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-primary" />
                          Comparativo — {tipo}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div style={{ width: "100%", height: Math.max(200, items.length * 40 + 80) }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} barGap={4}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="grupo" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" angle={-20} textAnchor="end" height={60} />
                              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                              <Tooltip
                                content={({ active, payload, label }) => {
                                  if (!active || !payload?.length) return null;
                                  const d = payload[0]?.payload;
                                  return (
                                    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
                                      <p className="font-semibold text-foreground mb-1">{label}</p>
                                      <p className="text-primary">Atual: {formatBRL(d?.atual || 0)} <span className="text-muted-foreground ml-1">(Qtd: {(d?.qtdAtual || 0).toLocaleString("pt-BR")})</span></p>
                                      <p className="text-muted-foreground">Anterior: {formatBRL(d?.anterior || 0)} <span className="ml-1">(Qtd: {(d?.qtdAnterior || 0).toLocaleString("pt-BR")})</span></p>
                                    </div>
                                  );
                                }}
                              />
                              <Bar dataKey="atual" name="Período Atual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="anterior" name="Período Anterior" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Participação por Grupo</CardTitle>
                </CardHeader>
                <CardContent>
                  {pieData.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-10">Sem dados</p>
                  ) : (
                    <>
                      <div style={{ width: "100%", height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                              {pieData.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatBRL(value)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {pieData.map((item, i) => (
                          <div key={item.name} className="flex items-center gap-2 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-muted-foreground truncate">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {(perfil === "ADM" || perfil === "FINANCEIRO") && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Detalhamento Financeiro por Grupo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {comparativoFiltrado.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-10">Sem dados disponíveis</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grupo</TableHead>
                      <TableHead className="text-right">Vlr. Atual</TableHead>
                      <TableHead className="text-right">Qtd. Atual</TableHead>
                      <TableHead className="text-right">Vlr. Anterior</TableHead>
                      <TableHead className="text-right">Qtd. Anterior</TableHead>
                      <TableHead className="text-right">Crescimento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparativoFiltrado.map((item, i) => {
                      const growth = parseGrowth(item.CRECIMENTO);
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{item.GRPO_NOME || "—"}</TableCell>
                          <TableCell className="text-right">{formatBRL(parseCurrency(item.ITFT_VLR_CONTABIL))}</TableCell>
                          <TableCell className="text-right">{parseCurrency(item.ITFT_QTDE).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right">{formatBRL(parseCurrency(item.ITFT_VLR_CONTABIL_ANT))}</TableCell>
                          <TableCell className="text-right">{parseCurrency(item.ITFT_QTDE_ANT).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right">
                            <span className={`inline-flex items-center gap-1 text-sm font-medium ${growth >= 0 ? "text-accent" : "text-destructive"}`}>
                              {growth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {growth.toFixed(2)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vendas profile: growth ranking */}
      {perfil === "Vendas" && comparativoFiltrado.length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Ranking de Crescimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...comparativoFiltrado]
                .sort((a, b) => parseGrowth(b.CRECIMENTO) - parseGrowth(a.CRECIMENTO))
                .slice(0, 8)
                .map((item, i) => {
                  const growth = parseGrowth(item.CRECIMENTO);
                  const maxAbsGrowth = Math.max(
                    ...comparativoFiltrado.map((c) => Math.abs(parseGrowth(c.CRECIMENTO))),
                    1
                  );
                  const barWidth = Math.min(Math.abs(growth) / maxAbsGrowth * 100, 100);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-32 truncate shrink-0">{item.GRPO_NOME}</span>
                      <div className="flex-1 h-6 bg-muted/30 rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all ${growth >= 0 ? "bg-primary/70" : "bg-destructive/70"}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold w-16 text-right ${growth >= 0 ? "text-primary" : "text-destructive"}`}>
                        {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, title, value, subtitle, change }: {
  icon: React.ElementType;
  title: string;
  value: string;
  subtitle?: string;
  change?: number;
}) {
  const up = (change ?? 0) >= 0;

  return (
    <Card className="border-border/40 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 overflow-hidden">
      <CardContent className="p-3 h-full bg-gradient-to-br from-primary/8 to-primary/3 rounded-lg space-y-1">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-primary/15 text-primary">
            <Icon className="h-3 w-3" />
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium leading-tight truncate">
            {title}
          </p>
        </div>
        {change !== undefined && (
          <div className="flex justify-end">
            <span className={`inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${up ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive"}`}>
              {up ? <ArrowUpRight className="h-2 w-2" /> : <ArrowDownRight className="h-2 w-2" />}
              {Math.abs(change).toFixed(1)}%
            </span>
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight break-words">{value}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
