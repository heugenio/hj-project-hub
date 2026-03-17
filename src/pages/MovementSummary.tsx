import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const movData = [
  { mes: "Jan", entradas: 120, saidas: 95 },
  { mes: "Fev", entradas: 140, saidas: 110 },
  { mes: "Mar", entradas: 100, saidas: 125 },
  { mes: "Abr", entradas: 160, saidas: 130 },
  { mes: "Mai", entradas: 180, saidas: 150 },
  { mes: "Jun", entradas: 150, saidas: 140 },
];

const mockMovimentos = [
  { produto: "Notebook Dell", tipo: "Entrada", quantidade: 20, data: "2026-03-15", responsavel: "João" },
  { produto: "Monitor LG", tipo: "Saída", quantidade: 5, data: "2026-03-14", responsavel: "Maria" },
  { produto: "Teclado Mecânico", tipo: "Entrada", quantidade: 50, data: "2026-03-13", responsavel: "Carlos" },
  { produto: "Mouse Wireless", tipo: "Saída", quantidade: 15, data: "2026-03-12", responsavel: "Ana" },
  { produto: "SSD 500GB", tipo: "Entrada", quantidade: 30, data: "2026-03-11", responsavel: "Pedro" },
  { produto: "Webcam HD", tipo: "Saída", quantidade: 8, data: "2026-03-10", responsavel: "João" },
];

export default function MovementSummary() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Resumo de Movimentação</h1>
        <p className="text-muted-foreground text-sm mt-1">Entradas e saídas de estoque</p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Movimentação Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={movData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
              <XAxis dataKey="mes" stroke="hsl(220, 10%, 46%)" />
              <YAxis stroke="hsl(220, 10%, 46%)" />
              <Tooltip />
              <Line type="monotone" dataKey="entradas" stroke="hsl(160, 60%, 40%)" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="saidas" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Últimas Movimentações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockMovimentos.map((m, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{m.produto}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-sm ${m.tipo === "Entrada" ? "text-accent" : "text-destructive"}`}>
                      {m.tipo === "Entrada" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {m.tipo}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{m.quantidade}</TableCell>
                  <TableCell>{new Date(m.data).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{m.responsavel}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
