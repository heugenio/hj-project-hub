import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  getConsultaEstoqueFiliais,
  getGrupos,
  getMarcas,
  getUnidadesEmpresariais,
  type EstoqueItem,
  type Grupo,
  type Marca,
  type UnidadeEmpresarial,
} from "@/lib/api";

export default function Estoque() {
  const { auth } = useAuth();
  const [search, setSearch] = useState("");
  const [referencia, setReferencia] = useState("");
  const [grupoFilter, setGrupoFilter] = useState("__all__");
  const [marcaFilter, setMarcaFilter] = useState("__all__");

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [unidades, setUnidades] = useState<UnidadeEmpresarial[]>([]);
  const [estoque, setEstoque] = useState<EstoqueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Load filters and unidades on mount
  useEffect(() => {
    getGrupos().then(setGrupos).catch(() => toast.error("Erro ao carregar grupos"));
    getMarcas().then(setMarcas).catch(() => toast.error("Erro ao carregar marcas"));
    if (auth?.unidade?.empr_id) {
      getUnidadesEmpresariais(auth.unidade.empr_id)
        .then(setUnidades)
        .catch(() => {});
    }
  }, [auth?.unidade?.empr_id]);

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

  // Detect dynamic filial columns
  const filialColumns = estoque.length > 0
    ? Object.keys(estoque[0]).filter((k) => /^G\d{2}$/.test(k) || k === "GO" || k === "DF")
    : [];

  // Build UF label map from unidades: unem_Sigla -> unem_Uf
  const ufMap: Record<string, string> = {};
  unidades.forEach((u) => {
    if (u.unem_Sigla && u.unem_Uf) {
      ufMap[u.unem_Sigla] = u.unem_Uf;
    }
  });

  // Check if a column key is a UF total (like GO, DF — 2-letter state codes)
  const isUfColumn = (col: string) => /^[A-Z]{2}$/.test(col) && !/^\d/.test(col) && !col.startsWith("G0") && !col.startsWith("G1");

  // Identify logged store column
  const loggedSigla = auth?.unidade?.unem_Sigla || "";
  const isLoggedCol = (col: string) => col === loggedSigla;

  const getColumnLabel = (col: string) => {
    if (isUfColumn(col)) return col;
    return col;
  };

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
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/70 border-b border-border">
                  <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">Código</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">Produto</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">Ref.</th>
                  {filialColumns.map((col) => (
                    <th
                      key={col}
                      className={`text-right px-2 py-1.5 font-semibold whitespace-nowrap ${
                        isUfColumn(col)
                          ? "bg-primary/10 text-primary border-l border-r border-primary/20"
                          : "text-muted-foreground"
                      }`}
                    >
                      {getColumnLabel(col)}
                    </th>
                  ))}
                  <th className="text-right px-2 py-1.5 font-bold whitespace-nowrap bg-primary/15 text-primary border-l border-primary/20">
                    Geral
                  </th>
                </tr>
              </thead>
              <tbody>
                {estoque.map((item, i) => (
                  <tr
                    key={`${item.Codigo}-${i}`}
                    className={`border-b border-border/40 hover:bg-accent/40 transition-colors ${
                      i % 2 === 0 ? "bg-background" : "bg-muted/30"
                    }`}
                  >
                    <td className="px-2 py-1 font-mono text-muted-foreground whitespace-nowrap">{item.Codigo}</td>
                    <td className="px-2 py-1 font-medium max-w-[220px] truncate">{item.Nome}</td>
                    <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">{item.Referencia}</td>
                    {filialColumns.map((col) => {
                      const val = (item as unknown as Record<string, string | undefined>)[col] || "0";
                      const numVal = parseFloat(val) || 0;
                      return (
                        <td
                          key={col}
                          className={`text-right px-2 py-1 tabular-nums whitespace-nowrap ${
                            isUfColumn(col)
                              ? "bg-primary/5 font-semibold text-primary border-l border-r border-primary/10"
                              : numVal > 0 ? "text-foreground" : "text-muted-foreground/50"
                          }`}
                        >
                          {val}
                        </td>
                      );
                    })}
                    <td className="text-right px-2 py-1 font-bold tabular-nums whitespace-nowrap bg-primary/10 text-primary border-l border-primary/10">
                      {item.Geral || "0"}
                    </td>
                  </tr>
                ))}
                {searched && !loading && estoque.length === 0 && (
                  <tr>
                    <td colSpan={3 + filialColumns.length + 1} className="text-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      Nenhum produto encontrado
                    </td>
                  </tr>
                )}
                {!searched && (
                  <tr>
                    <td colSpan={3 + filialColumns.length + 1} className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      Utilize os filtros acima e clique em Consultar
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {estoque.length > 0 && (
            <div className="px-3 py-1.5 border-t border-border text-xs text-muted-foreground">
              {estoque.length} produto(s) encontrado(s)
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
