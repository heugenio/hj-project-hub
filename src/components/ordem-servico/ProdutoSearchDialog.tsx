import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Loader2, Package } from 'lucide-react';
import { getConsultaEstoque, getGrupos, getMarcas, type ConsultaEstoqueItem, type Grupo, type Marca } from '@/lib/api';

interface ProdutoSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unemId: string;
  onSelect: (produto: ConsultaEstoqueItem) => void;
}

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
    // Reset
    setResults([]);
    setSearched(false);
    setProdCodigo('');
    setProdNome('');
    setMarcId('');
    setGrpoId('');
    setReferencia('');
    setAplicacao('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Pesquisa de Produtos
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Código</Label>
            <Input value={prodCodigo} onChange={(e) => setProdCodigo(e.target.value)} placeholder="Código" className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={prodNome} onChange={(e) => setProdNome(e.target.value)} placeholder="Nome do produto" className="h-8 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
          </div>
          <div>
            <Label className="text-xs">Referência</Label>
            <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Referência" className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Aplicação</Label>
            <Input value={aplicacao} onChange={(e) => setAplicacao(e.target.value)} placeholder="Aplicação" className="h-8 text-xs" />
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

        {/* Results */}
        <div className="flex-1 overflow-auto border rounded-md min-h-[200px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs">Código</TableHead>
                <TableHead className="text-xs">Produto</TableHead>
                <TableHead className="text-xs">Referência</TableHead>
                <TableHead className="text-xs text-right">Saldo</TableHead>
                <TableHead className="text-xs text-right">Preço</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {!loading && searched && results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">
                    Nenhum produto encontrado.
                  </TableCell>
                </TableRow>
              )}
              {!loading && results.map((item, idx) => (
                <TableRow
                  key={idx}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSelect(item)}
                >
                  <TableCell className="text-xs font-mono">{item.prod_Codigo || item.Codigo || ''}</TableCell>
                  <TableCell className="text-xs">{item.prod_Nome || item.Nome || ''}</TableCell>
                  <TableCell className="text-xs">{item.prod_Referencia || item.Referencia || ''}</TableCell>
                  <TableCell className="text-xs text-right">{item.sest_Saldo || item.Geral || ''}</TableCell>
                  <TableCell className="text-xs text-right">{item.prod_Preco_Venda || ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
