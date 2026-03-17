import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Package, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  getConsultaEstoqueFiliais,
  getGrupos,
  getMarcas,
  type EstoqueItem,
  type Grupo,
  type Marca,
} from "@/lib/api";

export default function Estoque() {
  const { auth } = useAuth();
  const [search, setSearch] = useState("");
  const [referencia, setReferencia] = useState("");
  const [grupoFilter, setGrupoFilter] = useState("__all__");
  const [marcaFilter, setMarcaFilter] = useState("__all__");

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [estoque, setEstoque] = useState<EstoqueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Load filters on mount
  useEffect(() => {
    getGrupos().then(setGrupos).catch(() => toast.error("Erro ao carregar grupos"));
    getMarcas().then(setMarcas).catch(() => toast.error("Erro ao carregar marcas"));
  }, []);

  const handleSearch = async () => {
    if (!auth?.unidade?.empr_id) {
      toast.error("Empresa não identificada. Faça login novamente.");
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const data = await getConsultaEstoqueFiliais({
        empr_id: auth.unidade.empr_id,
        prod_nome: search || undefined,
        referencia: referencia || undefined,
        grpo_id: grupoFilter !== "__all__" ? grupoFilter : undefined,
        marc_id: marcaFilter !== "__all__" ? marcaFilter : undefined,
      });
      setEstoque(data);
      if (data.length === 0) toast.info("Nenhum produto encontrado");
    } catch {
      toast.error("Erro ao consultar estoque");
    } finally {
      setLoading(false);
    }
  };

  // Detect dynamic filial columns (G01, G02, etc.)
  const filialColumns = estoque.length > 0
    ? Object.keys(estoque[0]).filter((k) => /^G\d{2}$/.test(k) || k === "GO" || k === "DF")
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Estoque</h1>
        <p className="text-muted-foreground text-sm mt-1">Consulta de estoque por filiais</p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome do produto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Input
                placeholder="Referência..."
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className="sm:w-[160px]"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={grupoFilter} onValueChange={setGrupoFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os Grupos</SelectItem>
                  {grupos.map((g) => (
                    <SelectItem key={g.grpo_id} value={g.grpo_id}>{g.grpo_Nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={marcaFilter} onValueChange={setMarcaFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Marca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as Marcas</SelectItem>
                  {marcas.map((m) => (
                    <SelectItem key={m.marc_id} value={m.marc_id}>{m.marc_Nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleSearch} disabled={loading} className="sm:w-auto">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Consultar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Referência</TableHead>
                  {filialColumns.map((col) => (
                    <TableHead key={col} className="text-right">{col}</TableHead>
                  ))}
                  <TableHead className="text-right font-bold">Geral</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estoque.map((item, i) => (
                  <TableRow key={`${item.Codigo}-${i}`}>
                    <TableCell className="font-mono text-xs">{item.Codigo}</TableCell>
                    <TableCell className="font-medium max-w-[250px] truncate">{item.Nome}</TableCell>
                    <TableCell className="text-xs">{item.Referencia}</TableCell>
                    {filialColumns.map((col) => (
                      <TableCell key={col} className="text-right tabular-nums">
                        {(item as Record<string, string | undefined>)[col] || "0"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold tabular-nums">{item.Geral || "0"}</TableCell>
                  </TableRow>
                ))}
                {searched && !loading && estoque.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3 + filialColumns.length + 1} className="text-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                )}
                {!searched && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      Utilize os filtros acima e clique em Consultar
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {estoque.length > 0 && (
            <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
              {estoque.length} produto(s) encontrado(s)
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}