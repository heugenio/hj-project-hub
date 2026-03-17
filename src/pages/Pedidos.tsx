import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, ShoppingCart } from "lucide-react";
import { useState } from "react";

const mockPedidos = [
  { id: "PED-001", cliente: "João Silva", data: "2026-03-15", valor: 4500.00, status: "Aprovado", itens: 3 },
  { id: "PED-002", cliente: "Maria Santos", data: "2026-03-14", valor: 1280.50, status: "Pendente", itens: 2 },
  { id: "PED-003", cliente: "Carlos Lima", data: "2026-03-14", valor: 8920.00, status: "Aprovado", itens: 5 },
  { id: "PED-004", cliente: "Ana Costa", data: "2026-03-13", valor: 650.00, status: "Cancelado", itens: 1 },
  { id: "PED-005", cliente: "Pedro Oliveira", data: "2026-03-12", valor: 3200.00, status: "Entregue", itens: 4 },
  { id: "PED-006", cliente: "Lucia Ferreira", data: "2026-03-11", valor: 15400.00, status: "Aprovado", itens: 8 },
  { id: "PED-007", cliente: "Roberto Alves", data: "2026-03-10", valor: 790.00, status: "Entregue", itens: 2 },
];

const statusVariant: Record<string, string> = {
  Aprovado: "bg-primary text-primary-foreground",
  Pendente: "bg-warning text-warning-foreground",
  Cancelado: "bg-destructive text-destructive-foreground",
  Entregue: "bg-accent text-accent-foreground",
};

export default function Pedidos() {
  const [search, setSearch] = useState("");

  const filtered = mockPedidos.filter(
    (p) => p.cliente.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pedidos</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerenciamento de pedidos</p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por cliente ou nº pedido..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-center">Itens</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((pedido) => (
                <TableRow key={pedido.id}>
                  <TableCell className="font-mono text-sm font-medium">{pedido.id}</TableCell>
                  <TableCell>{pedido.cliente}</TableCell>
                  <TableCell>{new Date(pedido.data).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-center">{pedido.itens}</TableCell>
                  <TableCell className="text-right font-medium">R$ {pedido.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <Badge className={statusVariant[pedido.status] + " text-xs"}>{pedido.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Nenhum pedido encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
