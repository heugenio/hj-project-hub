import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Package } from "lucide-react";

const mockEstoque = [
  { id: 1, produto: "Notebook Dell Inspiron", grupo: "Eletrônicos", marca: "Dell", quantidade: 45, minimo: 10, preco: 3499.90, filial: "Matriz" },
  { id: 2, produto: "Monitor LG 27\"", grupo: "Eletrônicos", marca: "LG", quantidade: 23, minimo: 5, preco: 1299.90, filial: "Matriz" },
  { id: 3, produto: "Teclado Mecânico", grupo: "Periféricos", marca: "Logitech", quantidade: 3, minimo: 10, preco: 459.90, filial: "Filial 1" },
  { id: 4, produto: "Mouse Wireless", grupo: "Periféricos", marca: "Logitech", quantidade: 67, minimo: 20, preco: 189.90, filial: "Filial 1" },
  { id: 5, produto: "Impressora HP", grupo: "Eletrônicos", marca: "HP", quantidade: 8, minimo: 5, preco: 899.90, filial: "Filial 2" },
  { id: 6, produto: "Cabo HDMI 2m", grupo: "Acessórios", marca: "Genérico", quantidade: 150, minimo: 50, preco: 29.90, filial: "Matriz" },
  { id: 7, produto: "SSD 500GB", grupo: "Componentes", marca: "Samsung", quantidade: 2, minimo: 10, preco: 349.90, filial: "Filial 2" },
  { id: 8, produto: "Webcam HD", grupo: "Periféricos", marca: "Logitech", quantidade: 34, minimo: 10, preco: 299.90, filial: "Matriz" },
];

const grupos = ["Todos", "Eletrônicos", "Periféricos", "Acessórios", "Componentes"];
const marcas = ["Todas", "Dell", "LG", "Logitech", "HP", "Samsung", "Genérico"];

export default function Estoque() {
  const [search, setSearch] = useState("");
  const [grupoFilter, setGrupoFilter] = useState("Todos");
  const [marcaFilter, setMarcaFilter] = useState("Todas");

  const filtered = mockEstoque.filter((item) => {
    const matchSearch = item.produto.toLowerCase().includes(search.toLowerCase());
    const matchGrupo = grupoFilter === "Todos" || item.grupo === grupoFilter;
    const matchMarca = marcaFilter === "Todas" || item.marca === marcaFilter;
    return matchSearch && matchGrupo && matchMarca;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Estoque</h1>
        <p className="text-muted-foreground text-sm mt-1">Consulta de estoque por filiais</p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={grupoFilter} onValueChange={setGrupoFilter}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Grupo" /></SelectTrigger>
              <SelectContent>
                {grupos.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={marcaFilter} onValueChange={setMarcaFilter}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Marca" /></SelectTrigger>
              <SelectContent>
                {marcas.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.produto}</TableCell>
                  <TableCell>{item.grupo}</TableCell>
                  <TableCell>{item.marca}</TableCell>
                  <TableCell>{item.filial}</TableCell>
                  <TableCell className="text-right">{item.quantidade}</TableCell>
                  <TableCell className="text-right">R$ {item.preco.toFixed(2)}</TableCell>
                  <TableCell>
                    {item.quantidade <= item.minimo ? (
                      <Badge variant="destructive" className="text-xs">Baixo</Badge>
                    ) : (
                      <Badge className="bg-accent text-accent-foreground text-xs">OK</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Nenhum produto encontrado
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
