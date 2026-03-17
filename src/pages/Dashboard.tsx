import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

const stats = [
  { title: "Vendas do Mês", value: "R$ 284.500", change: "+12.5%", up: true, icon: DollarSign },
  { title: "Pedidos", value: "1.284", change: "+8.2%", up: true, icon: ShoppingCart },
  { title: "Produtos em Estoque", value: "5.432", change: "-2.1%", up: false, icon: Package },
  { title: "Faturamento", value: "R$ 1.2M", change: "+15.3%", up: true, icon: TrendingUp },
];

const monthlyData = [
  { mes: "Jan", vendas: 65000, meta: 70000 },
  { mes: "Fev", vendas: 72000, meta: 70000 },
  { mes: "Mar", vendas: 68000, meta: 75000 },
  { mes: "Abr", vendas: 85000, meta: 75000 },
  { mes: "Mai", vendas: 92000, meta: 80000 },
  { mes: "Jun", vendas: 78000, meta: 80000 },
  { mes: "Jul", vendas: 95000, meta: 85000 },
  { mes: "Ago", vendas: 88000, meta: 85000 },
  { mes: "Set", vendas: 102000, meta: 90000 },
  { mes: "Out", vendas: 98000, meta: 90000 },
  { mes: "Nov", vendas: 110000, meta: 95000 },
  { mes: "Dez", vendas: 125000, meta: 95000 },
];

const categoryData = [
  { name: "Eletrônicos", value: 35 },
  { name: "Vestuário", value: 25 },
  { name: "Alimentos", value: 20 },
  { name: "Outros", value: 20 },
];

const COLORS = ["hsl(215, 80%, 48%)", "hsl(160, 60%, 40%)", "hsl(38, 92%, 50%)", "hsl(280, 60%, 55%)"];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do seu negócio</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <span className={`flex items-center gap-1 text-xs font-medium ${stat.up ? "text-accent" : "text-destructive"}`}>
                  {stat.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {stat.change}
                </span>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Vendas vs Meta Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 46%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 46%)" tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString()}`} />
                <Bar dataKey="vendas" fill="hsl(215, 80%, 48%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="meta" fill="hsl(220, 15%, 85%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Vendas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {categoryData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {categoryData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-muted-foreground">{item.name} ({item.value}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
