import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { getComparativo, getComparativoResumo, getUnidadesEmpresariais, type Comparativo, type ComparativoResumo, type UnidadeEmpresarial } from "@/lib/api";
import {
  DollarSign, TrendingUp, TrendingDown, Package, ShoppingCart,
  ArrowUpRight, ArrowDownRight, Loader2, BarChart3, Wallet, CreditCard, Store, Filter
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

type Perfil = "ADM" | "Vendas" | "FINANCEIRO" | string;

export default function Dashboard() {
  const { auth } = useAuth();
  const [comparativo, setComparativo] = useState<Comparativo[]>([]);
  const [resumo, setResumo] = useState<ComparativoResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [resumoLojas, setResumoLojas] = useState<ComparativoResumo[]>([]);
  const [unidadesMap, setUnidadesMap] = useState<Record<string, string>>({});
  const [filtroGrpoTipo, setFiltroGrpoTipo] = useState<string>("__all__");

  const perfil: Perfil = auth?.user?.GRUS_PERFIL || "ADM";
  const unemId = auth?.unidade?.unem_Id || "";
  const emprId = unemId.substring(0, 8);

  // Para ADM, passa apenas os 8 primeiros caracteres (nível empresa/corporação)
  const resumoId = perfil === "ADM" ? emprId : unemId;

  useEffect(() => {
    if (!unemId) return;
    setLoading(true);

    const fetches: Promise<unknown>[] = [
      getComparativo(unemId),
      getComparativoResumo(resumoId),
    ];

    // Para ADM, buscar unidades para mapear UNEM_ID → Sigla
    if (perfil === "ADM" && emprId) {
      fetches.push(getUnidadesEmpresariais(emprId));
    }

    Promise.all(fetches)
      .then(([comp, res, unidades]) => {
        setComparativo((comp as Comparativo[]) || []);
        const lojas = (res as ComparativoResumo[]) || [];
        setResumoLojas(lojas);

        // Resumo da unidade logada
        const lojaLogada = lojas.find((l) => l.UNEM_ID === unemId);
        setResumo(lojaLogada || lojas[0] || null);

        // Mapear UNEM_ID → unem_Sigla
        if (unidades && Array.isArray(unidades)) {
          const map: Record<string, string> = {};
          (unidades as UnidadeEmpresarial[]).forEach((u) => {
            map[u.unem_Id] = u.unem_Sigla || u.unem_Fantasia || u.unem_Id;
          });
          setUnidadesMap(map);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [unemId, resumoId, perfil, emprId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const vlrAtual = parseCurrency(resumo?.ITFT_VLR_CONTABIL);
  const vlrAnterior = parseCurrency(resumo?.ITFT_VLR_CONTABIL_ANT);
  const qtdAtual = parseCurrency(resumo?.ITFT_QTDE);
  const qtdAnterior = parseCurrency(resumo?.ITFT_QTDE_ANT);
  const crescimento = parseGrowth(resumo?.CRECIMENTO);
  // Lista única de GRPO_TIPO para o filtro
  const grpoTipos = useMemo(() => {
    const tipos = new Set<string>();
    comparativo.forEach((item) => tipos.add(item.GRPO_TIPO || "Geral"));
    return Array.from(tipos).sort();
  }, [comparativo]);

  // Dados filtrados
  const comparativoFiltrado = useMemo(() => {
    if (filtroGrpoTipo === "__all__") return comparativo;
    return comparativo.filter((item) => (item.GRPO_TIPO || "Geral") === filtroGrpoTipo);
  }, [comparativo, filtroGrpoTipo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const vlrAtual = parseCurrency(resumo?.ITFT_VLR_CONTABIL);
  const vlrAnterior = parseCurrency(resumo?.ITFT_VLR_CONTABIL_ANT);
  const qtdAtual = parseCurrency(resumo?.ITFT_QTDE);
  const qtdAnterior = parseCurrency(resumo?.ITFT_QTDE_ANT);
  const crescimento = parseGrowth(resumo?.CRECIMENTO);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão geral — Perfil: <Badge variant="secondary" className="ml-1">{perfil}</Badge>
          </p>
        </div>
      </div>

      {/* Summary cards — always shown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={DollarSign}
          title="Faturamento Atual"
          value={formatBRL(vlrAtual)}
          change={crescimento}
        />
        <SummaryCard
          icon={Wallet}
          title="Faturamento Anterior"
          value={formatBRL(vlrAnterior)}
        />
        <SummaryCard
          icon={Package}
          title="Qtd. Atual"
          value={qtdAtual.toLocaleString("pt-BR")}
          change={qtdAnterior > 0 ? ((qtdAtual - qtdAnterior) / qtdAnterior) * 100 : 0}
        />
        <SummaryCard
          icon={ShoppingCart}
          title="Qtd. Anterior"
          value={qtdAnterior.toLocaleString("pt-BR")}
        />
      </div>

      {/* Multi-lojas — ADM only */}
      {perfil === "ADM" && resumoLojas.length > 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Visão Multi-Lojas</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {resumoLojas.map((loja, i) => {
              const growth = parseGrowth(loja.CRECIMENTO);
              const vlr = parseCurrency(loja.ITFT_VLR_CONTABIL);
              const vlrAnt = parseCurrency(loja.ITFT_VLR_CONTABIL_ANT);
              const qtd = parseCurrency(loja.ITFT_QTDE);
              const qtdAnt = parseCurrency(loja.ITFT_QTDE_ANT);
              const isLogada = loja.UNEM_ID === unemId;
              const sigla = unidadesMap[loja.UNEM_ID] || loja.UNEM_ID || `Loja ${i + 1}`;

              return (
                <Card
                  key={i}
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
                        <span className="text-sm font-bold text-foreground">{formatBRL(vlr)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Fat. Anterior</span>
                        <span className="text-xs text-muted-foreground">{formatBRL(vlrAnt)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Qtd. Atual</span>
                        <span className="text-xs text-foreground">{qtd.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Qtd. Anterior</span>
                        <span className="text-xs text-muted-foreground">{qtdAnt.toLocaleString("pt-BR")}</span>
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
                    <span className="text-sm font-bold text-foreground">{formatBRL(resumoLojas.reduce((s, l) => s + parseCurrency(l.ITFT_VLR_CONTABIL), 0))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Fat. Anterior</span>
                    <span className="text-xs text-muted-foreground">{formatBRL(resumoLojas.reduce((s, l) => s + parseCurrency(l.ITFT_VLR_CONTABIL_ANT), 0))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Qtd. Atual</span>
                    <span className="text-xs text-foreground">{resumoLojas.reduce((s, l) => s + parseCurrency(l.ITFT_QTDE), 0).toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Qtd. Anterior</span>
                    <span className="text-xs text-muted-foreground">{resumoLojas.reduce((s, l) => s + parseCurrency(l.ITFT_QTDE_ANT), 0).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

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
            {comparativo.length === 0 ? (
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
                    {comparativo.map((item, i) => {
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
      {perfil === "Vendas" && comparativo.length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Ranking de Crescimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...comparativo]
                .sort((a, b) => parseGrowth(b.CRECIMENTO) - parseGrowth(a.CRECIMENTO))
                .slice(0, 8)
                .map((item, i) => {
                  const growth = parseGrowth(item.CRECIMENTO);
                  const maxAbsGrowth = Math.max(
                    ...comparativo.map((c) => Math.abs(parseGrowth(c.CRECIMENTO))),
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

function SummaryCard({ icon: Icon, title, value, change }: {
  icon: React.ElementType;
  title: string;
  value: string;
  change?: number;
}) {
  const up = (change ?? 0) >= 0;
  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          {change !== undefined && (
            <span className={`flex items-center gap-1 text-xs font-medium ${up ? "text-accent" : "text-destructive"}`}>
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {change.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}
