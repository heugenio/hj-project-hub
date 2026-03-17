import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const mockVendas = [
  { unidade: "Matriz", jan: 45000, fev: 52000, mar: 48000, abr: 55000, mai: 62000, jun: 58000 },
  { unidade: "Filial 1", jan: 32000, fev: 35000, mar: 38000, abr: 42000, mai: 39000, jun: 41000 },
  { unidade: "Filial 2", jan: 28000, fev: 30000, mar: 25000, abr: 33000, mai: 36000, jun: 34000 },
];

const chartData = [
  { mes: "Jan", Matriz: 45000, "Filial 1": 32000, "Filial 2": 28000 },
  { mes: "Fev", Matriz: 52000, "Filial 1": 35000, "Filial 2": 30000 },
  { mes: "Mar", Matriz: 48000, "Filial 1": 38000, "Filial 2": 25000 },
  { mes: "Abr", Matriz: 55000, "Filial 1": 42000, "Filial 2": 33000 },
  { mes: "Mai", Matriz: 62000, "Filial 1": 39000, "Filial 2": 36000 },
  { mes: "Jun", Matriz: 58000, "Filial 1": 41000, "Filial 2": 34000 },
];

export default function SalesDemo() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Demonstrativo de Vendas</h1>
        <p className="text-muted-foreground text-sm mt-1">Relatório de vendas por unidade empresarial</p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Vendas por Unidade (Semestral)</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ width: "100%", height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
              <XAxis dataKey="mes" stroke="hsl(220, 10%, 46%)" />
              <YAxis stroke="hsl(220, 10%, 46%)" tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString()}`} />
              <Bar dataKey="Matriz" fill="hsl(215, 80%, 48%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Filial 1" fill="hsl(160, 60%, 40%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Filial 2" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Detalhamento por Unidade</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Jan</TableHead>
                <TableHead className="text-right">Fev</TableHead>
                <TableHead className="text-right">Mar</TableHead>
                <TableHead className="text-right">Abr</TableHead>
                <TableHead className="text-right">Mai</TableHead>
                <TableHead className="text-right">Jun</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockVendas.map((v) => (
                <TableRow key={v.unidade}>
                  <TableCell className="font-medium">{v.unidade}</TableCell>
                  <TableCell className="text-right">R$ {v.jan.toLocaleString()}</TableCell>
                  <TableCell className="text-right">R$ {v.fev.toLocaleString()}</TableCell>
                  <TableCell className="text-right">R$ {v.mar.toLocaleString()}</TableCell>
                  <TableCell className="text-right">R$ {v.abr.toLocaleString()}</TableCell>
                  <TableCell className="text-right">R$ {v.mai.toLocaleString()}</TableCell>
                  <TableCell className="text-right">R$ {v.jun.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
