import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Warehouse, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  getConsultaEstoque,
  getGrupos,
  getMarcas,
  type ConsultaEstoqueItem,
  type Grupo,
  type Marca,
} from "@/lib/api";

export default function ConsultaEstoque() {
  const { auth } = useAuth();
  const [prodNome, setProdNome] = useState("");
  const [prodCodigo, setProdCodigo] = useState("");
  const [referencia, setReferencia] = useState("");
  const [aplicacao, setAplicacao] = useState("");
  const [grupoFilter, setGrupoFilter] = useState("__all__");
  const [marcaFilter, setMarcaFilter] = useState("__all__");

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [items, setItems] = useState<ConsultaEstoqueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    getGrupos().then(setGrupos).catch(() => toast.error("Erro ao carregar grupos"));
    getMarcas().then(setMarcas).catch(() => toast.error("Erro ao carregar marcas"));
  }, []);

  const handleSearch = async () => {
    if (!auth?.unidade?.unem_Id) {
      toast.error("Unidade não identificada. Faça login novamente.");
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const data = await getConsultaEstoque({
        unem_id: auth.unidade.unem_Id,
        prod_nome: prodNome || undefined,
        prod_codigo: prodCodigo || undefined,
        referencia: referencia || undefined,
        aplicacao: aplicacao || undefined,
        grpo_id: grupoFilter !== "__all__" ? grupoFilter : undefined,
        marc_id: marcaFilter !== "__all__" ? marcaFilter : undefined,
      });
      setItems(data);
      if (data.length === 0) toast.info("Nenhum item encontrado");
    } catch {
      toast.error("Erro ao consultar estoque");
    } finally {
      setLoading(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch(); };

  // Build columns dynamically from first result
  const hiddenCols = new Set([
    "gRPO_ACRESCIMO_PERMITIDO", "gRPO_DESCONTO_PERMITIDO", "pROD_USAR_DESC_COMPLEMENTAR",
    "tEST_ID", "gRPO_ID", "pROD_ACEITA_SALDO_NEGATIVO", "pCPR_PRECO_MIN_PROD", "pROD_ID",
    "pROD_PESO_BRUTO", "tEST_CUSTO_MEDIO", "mARC_ID", "uEPD_ESTOQUE_MAXIMO",
    "pROD_CARACTERISTICAS", "nCMS_NOME", "uNEM_SIGLA", "pROD_MOVIMENTA_ESTOQUE", "pROD_PESO",
  ]);
  // Define preferred column order (lowercase keys)
  const columnOrder = [
    "prod_codigo", "prod_nome", "unid_sigla", "sest_qtd_saldo", "test_reserva", "test_requisicoes",
    "prod_referencia", "grpo_nome", "marc_nome", "prod_unidade",
    "sest_qtd", "sest_vlr_custo", "sest_vlr_venda", "prod_aplicacao", "prod_situacao",
    "prod_preco_venda", "prod_desc_complementar", "uepd_estoque_minimo", "pcpr_preco_prod",
    "pcpr_preco", "test_nome", "ncms_codigo", "unem_fantasia",
    "prod_natureza_economica", "prod_local_est",
  ];

  const columns = items.length > 0
    ? (() => {
        const allKeys = Object.keys(items[0]).filter((k) => !hiddenCols.has(k));
        const sorted: string[] = [];
        const remaining = new Set(allKeys.map((k) => k));
        for (const ordKey of columnOrder) {
          const match = allKeys.find((k) => k.toLowerCase() === ordKey);
          if (match && remaining.has(match)) {
            sorted.push(match);
            remaining.delete(match);
          }
        }
        // append any remaining columns not in the order list
        for (const k of allKeys) {
          if (remaining.has(k)) sorted.push(k);
        }
        return sorted;
      })()
    : [];

  const colLabelsMap: Record<string, string> = {
    prod_codigo: "Código",
    prod_nome: "Produto",
    prod_referencia: "Referência",
    grpo_nome: "Grupo",
    marc_nome: "Marca",
    prod_unidade: "Unid.",
    unid_sigla: "Und",
    sest_qtd: "Qtd",
    sest_qtd_saldo: "Saldo",
    test_reserva: "Reservado",
    test_requisicoes: "Requisitado",
    sest_vlr_custo: "Vlr Custo",
    sest_vlr_venda: "Vlr Venda",
    prod_aplicacao: "Aplicação",
    prod_situacao: "Situação",
    prod_preco_venda: "Preço Venda",
    prod_desc_complementar: "Desc. Complementar",
    uepd_estoque_minimo: "Estq. Mín.",
    pcpr_preco_prod: "Preço",
    pcpr_preco: "Preço",
    test_nome: "Tabela",
    ncms_codigo: "NCM",
    unem_fantasia: "Unidade",
    prod_natureza_economica: "Nat. Econômica",
    prod_local_est: "Local Estoque",
  };

  const getColLabel = (col: string) => {
    const lower = col.toLowerCase();
    return colLabelsMap[lower] || col;
  };

  const rightAlignKeys = new Set(["sest_qtd", "sest_vlr_custo", "sest_vlr_venda", "prod_preco_venda", "pcpr_preco_prod", "pcpr_preco", "uepd_estoque_minimo", "sest_qtd_saldo", "test_reserva", "test_requisicoes"]);
  const isRightAlign = (col: string) => rightAlignKeys.has(col.toLowerCase());

  const formatValue = (col: string, val: string | undefined) => {
    if (!val || val === "") return "-";
    const lower = col.toLowerCase();
    if (rightAlignKeys.has(lower)) {
      const num = parseFloat(val);
      if (isNaN(num)) return val;
      if (lower.includes("vlr") || lower.includes("preco")) {
        return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      }
      return num.toLocaleString("pt-BR");
    }
    return val;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Consulta Estoque</h1>
        <p className="text-muted-foreground text-sm mt-1">Consulta de estoque por unidade</p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome do produto..."
                  value={prodNome}
                  onChange={(e) => setProdNome(e.target.value)}
                  className="pl-9"
                  onKeyDown={onEnter}
                />
              </div>
              <Input
                placeholder="Código..."
                value={prodCodigo}
                onChange={(e) => setProdCodigo(e.target.value)}
                className="sm:w-[130px]"
                onKeyDown={onEnter}
              />
              <Input
                placeholder="Referência..."
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className="sm:w-[130px]"
                onKeyDown={onEnter}
              />
              <Input
                placeholder="Aplicação..."
                value={aplicacao}
                onChange={(e) => setAplicacao(e.target.value)}
                className="sm:w-[130px]"
                onKeyDown={onEnter}
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
                  {columns.map((col) => (
                    <th
                      key={col}
                      className={`px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap ${
                        isRightAlign(col) ? "text-right" : "text-left"
                      }`}
                    >
                      {getColLabel(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr
                    key={i}
                    className={`border-b border-border/40 hover:bg-accent/40 transition-colors ${
                      i % 2 === 0 ? "bg-background" : "bg-muted/30"
                    }`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col}
                        className={`px-2 py-1 whitespace-nowrap ${
                          isRightAlign(col)
                            ? "text-right tabular-nums font-medium"
                            : col.toLowerCase() === "prod_nome"
                            ? "font-medium max-w-[250px] truncate"
                            : col.toLowerCase() === "prod_codigo"
                            ? "font-mono text-muted-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {formatValue(col, item[col])}
                      </td>
                    ))}
                  </tr>
                ))}
                {searched && !loading && items.length === 0 && (
                  <tr>
                    <td colSpan={columns.length || 1} className="text-center py-8 text-muted-foreground">
                      <Warehouse className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      Nenhum item encontrado
                    </td>
                  </tr>
                )}
                {!searched && (
                  <tr>
                    <td colSpan={columns.length || 4} className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      Utilize os filtros acima e clique em Consultar
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {items.length > 0 && (
            <div className="px-3 py-1.5 border-t border-border text-xs text-muted-foreground">
              {items.length} item(ns) encontrado(s)
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
