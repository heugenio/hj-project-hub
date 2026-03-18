import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { getComparativo, getComparativoResumo, type Comparativo, type ComparativoResumo } from "@/lib/api";
import {
  DollarSign, TrendingUp, TrendingDown, Package, ShoppingCart,
  ArrowUpRight, ArrowDownRight, Loader2, BarChart3, Wallet, CreditCard
} from "lucide-react";
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

  const perfil: Perfil = auth?.user?.GRUS_PERFIL || "ADM";
  const unemId = auth?.unidade?.unem_Id || "";

  // Para ADM, passa apenas os 8 primeiros caracteres (nível empresa/corporação)
  const resumoId = perfil === "ADM" ? unemId.substring(0, 8) : unemId;
  const [resumoLojas, setResumoLojas] = useState<ComparativoResumo[]>([]);

  useEffect(() => {
    if (!unemId) return;
    setLoading(true);
    Promise.all([
      getComparativo(unemId),
      getComparativoResumo(resumoId),
    ])
      .then(([comp, res]) => {
        setComparativo(comp || []);
        setResumoLojas(res || []);
        setResumo(res?.[0] || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [unemId, resumoId]);

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

  // Chart data from comparativo
  const chartData = comparativo.map((item) => ({
    grupo: item.GRPO_NOME || "N/A",
    atual: parseCurrency(item.ITFT_VLR_CONTABIL),
    anterior: parseCurrency(item.ITFT_VLR_CONTABIL_ANT),
    crescimento: parseGrowth(item.CRECIMENTO),
  }));

  const pieData = comparativo
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

      {/* Profile-specific sections */}
      {(perfil === "ADM" || perfil === "Vendas") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Comparativo por Grupo (Atual vs Anterior)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-10">Sem dados disponíveis</p>
              ) : (
                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="grupo" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" angle={-20} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => formatBRL(value)} />
                      <Bar dataKey="atual" name="Período Atual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="anterior" name="Período Anterior" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

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
