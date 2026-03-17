import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, BoxesIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getProdutos, type Produto } from "@/lib/api";

export default function Produtos() {
  const [search, setSearch] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) {
      toast.warning("Digite o nome do produto para buscar");
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const data = await getProdutos(search);
      setProdutos(data);
      if (data.length === 0) toast.info("Nenhum produto encontrado");
    } catch {
      toast.error("Erro ao buscar produtos");
    } finally {
      setLoading(false);
    }
  };

  // Detect columns dynamically from first item, excluding known ones for custom rendering
  const knownCols = ["prod_Codigo", "prod_Nome", "prod_Referencia", "grpo_Nome", "marc_Nome", "prod_Unidade", "prod_Preco_Venda", "prod_Situacao"];

  // Build display columns from first result
  const displayColumns = produtos.length > 0
    ? Object.keys(produtos[0]).filter((k) => knownCols.includes(k) && produtos[0][k] !== undefined)
    : knownCols;

  const colLabels: Record<string, string> = {
    prod_Codigo: "Código",
    prod_Nome: "Produto",
    prod_Referencia: "Referência",
    grpo_Nome: "Grupo",
    marc_Nome: "Marca",
    prod_Unidade: "Unid.",
    prod_Preco_Venda: "Preço Venda",
    prod_Situacao: "Situação",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
        <p className="text-muted-foreground text-sm mt-1">Consulta de produtos por nome</p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
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
            <Button onClick={handleSearch} disabled={loading} className="sm:w-auto">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Consultar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/70 border-b border-border">
                  {displayColumns.map((col) => (
                    <th
                      key={col}
                      className={`px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap ${
                        col === "prod_Preco_Venda" ? "text-right" : "text-left"
                      }`}
                    >
                      {colLabels[col] || col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {produtos.map((item, i) => (
                  <tr
                    key={`${item.prod_Codigo || i}-${i}`}
                    className={`border-b border-border/40 hover:bg-accent/40 transition-colors ${
                      i % 2 === 0 ? "bg-background" : "bg-muted/30"
                    }`}
                  >
                    {displayColumns.map((col) => {
                      const val = item[col] || "-";
                      const isPrice = col === "prod_Preco_Venda";
                      const isName = col === "prod_Nome";
                      return (
                        <td
                          key={col}
                          className={`px-2 py-1 whitespace-nowrap ${
                            isPrice
                              ? "text-right tabular-nums font-medium"
                              : isName
                              ? "font-medium max-w-[250px] truncate"
                              : col === "prod_Codigo"
                              ? "font-mono text-muted-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {isPrice && val !== "-"
                            ? parseFloat(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                            : val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {searched && !loading && produtos.length === 0 && (
                  <tr>
                    <td colSpan={displayColumns.length} className="text-center py-8 text-muted-foreground">
                      <BoxesIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      Nenhum produto encontrado
                    </td>
                  </tr>
                )}
                {!searched && (
                  <tr>
                    <td colSpan={displayColumns.length} className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      Digite o nome e clique em Consultar
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {produtos.length > 0 && (
            <div className="px-3 py-1.5 border-t border-border text-xs text-muted-foreground">
              {produtos.length} produto(s) encontrado(s)
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
