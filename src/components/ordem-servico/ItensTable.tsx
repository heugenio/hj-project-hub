import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Package, Wrench, Search } from 'lucide-react';
import type { ItemOS } from '@/lib/api-os';
import { getConsultaEstoque, type ConsultaEstoqueItem } from '@/lib/api';
import { AutocompleteInput } from './AutocompleteInput';
import { ProdutoSearchDialog } from './ProdutoSearchDialog';

interface ItensTableProps {
  itens: ItemOS[];
  onChange: (itens: ItemOS[]) => void;
  unemId?: string;
}

function emptyItem(): ItemOS {
  return {
    ITOS_TIPO: 'P',
    ITOS_DESCRICAO: '',
    ITOS_QTDE: 1,
    ITOS_VLR_UNITARIO: 0,
    ITOS_DESCONTO: 0,
    ITOS_VLR_TOTAL: 0,
  };
}

function calcTotal(item: ItemOS): number {
  return Math.max(0, (item.ITOS_QTDE * item.ITOS_VLR_UNITARIO) - item.ITOS_DESCONTO);
}

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ItensTable({ itens, onChange, unemId }: ItensTableProps) {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchDialogIndex, setSearchDialogIndex] = useState<number | null>(null);

  const addItem = () => {
    onChange([...itens, emptyItem()]);
  };

  const removeItem = (index: number) => {
    onChange(itens.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ItemOS, value: any) => {
    const updated = itens.map((item, i) => {
      if (i !== index) return item;
      const newItem = { ...item, [field]: value };
      newItem.ITOS_VLR_TOTAL = calcTotal(newItem);
      return newItem;
    });
    onChange(updated);
  };

  const applyProduct = (index: number, produto: ConsultaEstoqueItem) => {
    const preco = parseFloat(produto.PCPR_PRECO || produto.prod_Preco_Venda || '0') || 0;
    const saldo = parseFloat(produto.SEST_QTD_SALDO || produto.sest_Saldo || '0') || 0;
    const updated = itens.map((item, i) => {
      if (i !== index) return item;
      const newItem: ItemOS = {
        ...item,
        ITOS_TIPO: 'P',
        ITOS_DESCRICAO: produto.prod_Nome || produto.Nome || '',
        PROD_ID: produto.prod_Codigo || produto.Codigo || '',
        ITOS_VLR_UNITARIO: preco,
        ITOS_SALDO_ESTOQUE: saldo,
      };
      newItem.ITOS_VLR_TOTAL = calcTotal(newItem);
      return newItem;
    });
    onChange(updated);
  };

  const fetchProdutos = useCallback(async (query: string) => {
    if (!unemId || query.length < 2) return [];
    try {
      const data = await getConsultaEstoque({ unem_id: unemId, prod_nome: query });
      return data.map((p) => ({
        id: p.prod_Codigo || p.Codigo || '',
        label: p.prod_Nome || p.Nome || '',
        data: p,
      }));
    } catch { return []; }
  }, [unemId]);

  const openSearchDialog = (index: number) => {
    setSearchDialogIndex(index);
    setSearchDialogOpen(true);
  };

  const handleDialogSelect = (produto: ConsultaEstoqueItem) => {
    if (searchDialogIndex !== null) {
      applyProduct(searchDialogIndex, produto);
    }
  };

  const servicos = itens.filter((i) => i.ITOS_TIPO === 'S');
  const produtos = itens.filter((i) => i.ITOS_TIPO === 'P');

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Itens da OS
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Wrench className="h-3 w-3 mr-1" />{servicos.length} serviço(s)
              </Badge>
              <Badge variant="secondary" className="text-xs">
                <Package className="h-3 w-3 mr-1" />{produtos.length} produto(s)
              </Badge>
              <Button size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs w-[100px]">Código</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs w-[70px] text-center">Saldo</TableHead>
                  <TableHead className="text-xs w-[80px] text-center">Qtde</TableHead>
                  <TableHead className="text-xs w-[120px] text-right">Vlr Unit.</TableHead>
                  <TableHead className="text-xs w-[100px] text-right">Desconto</TableHead>
                  <TableHead className="text-xs w-[120px] text-right">Total</TableHead>
                  <TableHead className="text-xs w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-8">
                      Nenhum item adicionado. Clique em "Adicionar" para começar.
                    </TableCell>
                  </TableRow>
                )}
                {itens.map((item, idx) => (
                  <TableRow key={idx} className="group">
                    <TableCell className="p-1.5">
                      <Input
                        value={item.PROD_ID || ''}
                        readOnly
                        className="h-8 text-xs font-mono bg-muted/30"
                        placeholder="—"
                        tabIndex={-1}
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <div className="flex items-center gap-1">
                        {unemId ? (
                          <>
                            <div className="flex-1">
                              <AutocompleteInput
                                placeholder="Buscar produto/serviço..."
                                value={item.ITOS_DESCRICAO}
                                onChange={(v) => updateItem(idx, 'ITOS_DESCRICAO', v)}
                                onSelect={(opt) => applyProduct(idx, opt.data)}
                                fetchOptions={fetchProdutos}
                                className="h-8 text-xs"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => openSearchDialog(idx)}
                              title="Pesquisa avançada de produtos"
                            >
                              <Search className="h-3.5 w-3.5 text-primary" />
                            </Button>
                          </>
                        ) : (
                          <Input
                            value={item.ITOS_DESCRICAO}
                            onChange={(e) => updateItem(idx, 'ITOS_DESCRICAO', e.target.value)}
                            className="h-8 text-xs"
                            placeholder="Descrição do item..."
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Input
                        value={item.ITOS_SALDO_ESTOQUE != null ? item.ITOS_SALDO_ESTOQUE : ''}
                        readOnly
                        className="h-8 text-xs text-center bg-muted/30"
                        tabIndex={-1}
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Input
                        type="number"
                        min={1}
                        value={item.ITOS_QTDE}
                        onChange={(e) => updateItem(idx, 'ITOS_QTDE', parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs text-center"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.ITOS_VLR_UNITARIO}
                        onChange={(e) => updateItem(idx, 'ITOS_VLR_UNITARIO', parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs text-right"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.ITOS_DESCONTO}
                        onChange={(e) => updateItem(idx, 'ITOS_DESCONTO', parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs text-right"
                      />
                    </TableCell>
                    <TableCell className="p-1.5 text-right text-xs font-semibold text-foreground">
                      {formatCurrency(item.ITOS_VLR_TOTAL)}
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {unemId && (
        <ProdutoSearchDialog
          open={searchDialogOpen}
          onOpenChange={setSearchDialogOpen}
          unemId={unemId}
          onSelect={handleDialogSelect}
        />
      )}
    </>
  );
}