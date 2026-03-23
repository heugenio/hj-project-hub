import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, Package, Warehouse } from 'lucide-react';
import { getConsultaEstoque, getGrupos, getMarcas, type ConsultaEstoqueItem, type Grupo, type Marca } from '@/lib/api';

interface ProdutoSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unemId: string;
  onSelect: (produto: ConsultaEstoqueItem) => void;
}

const visibleCols = [
  'pROD_CODIGO', 'pROD_NOME', 'uNID_SIGLA', 'pCPR_PRECO',
  'sEST_QTD_SALDO', 'tEST_RESERVA', 'tEST_REQUISICOES',
  'gRPO_NOME', 'mARC_NOME', 'pROD_REFERENCIA',
];

const colLabelsMap: Record<string, string> = {
  prod_codigo: 'Código',
  prod_nome: 'Produto',
  prod_referencia: 'Referência',
  grpo_nome: 'Grupo',
  marc_nome: 'Marca',
  unid_sigla: 'Und',
  sest_qtd_saldo: 'Saldo',
  test_reserva: 'Reservado',
  test_requisicoes: 'Requisitado',
  pcpr_preco: 'Preço',
  prod_natureza_economica: 'Nat. Econômica',
};

const rightAlignKeys = new Set([
  'sest_qtd_saldo', 'test_reserva', 'test_requisicoes', 'pcpr_preco',
]);

const numericCols = new Set(['sest_qtd_saldo', 'test_reserva', 'test_requisicoes']);

const getColLabel = (col: string) => colLabelsMap[col.toLowerCase()] || col;
const isRightAlign = (col: string) => rightAlignKeys.has(col.toLowerCase());

const formatValue = (col: string, val: string | undefined) => {
  if (!val || val === '') return '';
  const lower = col.toLowerCase();
  if (rightAlignKeys.has(lower)) {
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    if (numericCols.has(lower)) return num.toLocaleString('pt-BR', { minimumFractionDigits: 0 });
    if (lower.includes('preco')) return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return num.toLocaleString('pt-BR');
  }
  return val;
};

export function ProdutoSearchDialog({ open, onOpenChange, unemId, onSelect }: ProdutoSearchDialogProps) {
  const [prodCodigo, setProdCodigo] = useState('');
  const [prodNome, setProdNome] = useState('');
  const [marcId, setMarcId] = useState('');
  const [grpoId, setGrpoId] = useState('');
  const [referencia, setReferencia] = useState('');
  const [aplicacao, setAplicacao] = useState('');

  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(false);

  const [results, setResults] = useState<ConsultaEstoqueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (open && marcas.length === 0 && grupos.length === 0) {
      setLoadingFilters(true);
      Promise.all([getMarcas(), getGrupos()])
        .then(([m, g]) => { setMarcas(m); setGrupos(g); })
        .catch(() => {})
        .finally(() => setLoadingFilters(false));
    }
  }, [open]);

  const handleSearch = useCallback(async () => {
    if (!prodNome && !prodCodigo && !referencia && !aplicacao) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await getConsultaEstoque({
        unem_id: unemId,
        prod_codigo: prodCodigo || undefined,
        prod_nome: prodNome || undefined,
        marc_id: marcId || undefined,
        grpo_id: grpoId || undefined,
        referencia: referencia || undefined,
        aplicacao: aplicacao || undefined,
      });
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [unemId, prodCodigo, prodNome, marcId, grpoId, referencia, aplicacao]);

  const handleSelect = (item: ConsultaEstoqueItem) => {
    onSelect(item);
    onOpenChange(false);
    setResults([]);
    setSearched(false);
    setProdCodigo('');
    setProdNome('');
    setMarcId('');
    setGrpoId('');
    setReferencia('');
    setAplicacao('');
  };

  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };

  // Build columns from results, filtered to visible set
  const columns = results.length > 0
    ? (() => {
        const allKeys = Object.keys(results[0]);
        const sorted: string[] = [];
        const remaining = new Set(allKeys);
        for (const ordKey of visibleCols) {
          const match = allKeys.find((k) => k.toLowerCase() === ordKey.toLowerCase());
          if (match && remaining.has(match)) {
            sorted.push(match);
            remaining.delete(match);
          }
        }
        return sorted;
      })()
    : visibleCols;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Pesquisa de Produtos
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Código</Label>
            <Input value={prodCodigo} onChange={(e) => setProdCodigo(e.target.value)} placeholder="Código" className="h-8 text-xs" onKeyDown={onEnter} />
          </div>
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={prodNome} onChange={(e) => setProdNome(e.target.value)} placeholder="Nome do produto" className="h-8 text-xs" onKeyDown={onEnter} />
          </div>
          <div>
            <Label className="text-xs">Referência</Label>
            <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Referência" className="h-8 text-xs" onKeyDown={onEnter} />
          </div>
          <div>
            <Label className="text-xs">Aplicação</Label>
            <Input value={aplicacao} onChange={(e) => setAplicacao(e.target.value)} placeholder="Aplicação" className="h-8 text-xs" onKeyDown={onEnter} />
          </div>
          <div>
            <Label className="text-xs">Marca</Label>
            <Select value={marcId} onValueChange={setMarcId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={loadingFilters ? 'Carregando...' : 'Todas'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {marcas.map((m) => (
                  <SelectItem key={m.marc_id} value={m.marc_id}>{m.marc_Nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Grupo</Label>
            <Select value={grpoId} onValueChange={setGrpoId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={loadingFilters ? 'Carregando...' : 'Todos'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {grupos.map((g) => (
                  <SelectItem key={g.grpo_id} value={g.grpo_id}>{g.grpo_Nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button size="sm" onClick={handleSearch} disabled={loading} className="self-end">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
          Pesquisar
        </Button>

        {/* Results - same style as ConsultaEstoque */}
        <div className="flex-1 overflow-auto border rounded-md min-h-[200px]">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/70 border-b border-border">
                {columns.map((col) => (
                  <th
                    key={col}
                    className={`px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap ${
                      isRightAlign(col) ? 'text-right' : 'text-left'
                    }`}
                  >
                    {getColLabel(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={columns.length} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              )}
              {!loading && searched && results.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                    <Warehouse className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Nenhum produto encontrado
                  </td>
                </tr>
              )}
              {!loading && !searched && results.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Utilize os filtros e clique em Pesquisar
                  </td>
                </tr>
              )}
              {!loading && results.map((item, i) => (
                <tr
                  key={i}
                  className={`border-b border-border/40 cursor-pointer hover:bg-accent/40 transition-colors ${
                    i % 2 === 0 ? 'bg-background' : 'bg-muted/30'
                  }`}
                  onClick={() => handleSelect(item)}
                >
                  {columns.map((col) => (
                    <td
                      key={col}
                      className={`px-2 py-1 whitespace-nowrap ${
                        isRightAlign(col)
                          ? 'text-right tabular-nums font-medium'
                          : col.toLowerCase() === 'prod_nome'
                          ? 'font-medium max-w-[250px] truncate'
                          : col.toLowerCase() === 'prod_codigo'
                          ? 'font-mono text-muted-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {formatValue(col, item[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {results.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {results.length} produto(s) encontrado(s)
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}