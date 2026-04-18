import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const formatNumber = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ItensTable({ itens, onChange, unemId }: ItensTableProps) {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemOS>(emptyItem());

  const addItem = () => {
    if (!editingItem.PROD_ID && !editingItem.ITOS_DESCRICAO) return;
    const newItem = { ...editingItem, ITOS_VLR_TOTAL: calcTotal(editingItem) };
    onChange([...itens, newItem]);
    setEditingItem(emptyItem());
  };

  const removeItem = (index: number) => {
    onChange(itens.filter((_, i) => i !== index));
  };

  const updateEditingField = (field: keyof ItemOS, value: any) => {
    setEditingItem(prev => {
      const updated = { ...prev, [field]: value };
      updated.ITOS_VLR_TOTAL = calcTotal(updated);
      return updated;
    });
  };

  const applyProductToEditing = (produto: ConsultaEstoqueItem) => {
    const preco = parseFloat(produto.pCPR_PRECO || produto.PCPR_PRECO || produto.prod_Preco_Venda || '0') || 0;
    const saldo = parseFloat(produto.sEST_QTD_SALDO || produto.SEST_QTD_SALDO || produto.sest_Saldo || '0') || 0;
    const codigo = produto.pROD_CODIGO || produto.prod_Codigo || produto.Codigo || '';
    const natureza = (produto.pROD_NATUREZA_ECONOMICA || produto.pROD_Natureza_Economica || '').toLowerCase();
    const tipo: 'P' | 'S' = natureza.includes('servi') ? 'S' : 'P';
    const newItem: ItemOS = {
      ...editingItem,
      ITOS_TIPO: tipo,
      ITOS_DESCRICAO: produto.pROD_NOME || produto.prod_Nome || produto.Nome || '',
      PROD_ID: codigo,
      ITOS_VLR_UNITARIO: preco,
      ITOS_SALDO_ESTOQUE: saldo,
    };
    newItem.ITOS_VLR_TOTAL = calcTotal(newItem);
    setEditingItem(newItem);
  };

  const applyProductToExisting = (index: number, produto: ConsultaEstoqueItem) => {
    const preco = parseFloat(produto.pCPR_PRECO || produto.PCPR_PRECO || produto.prod_Preco_Venda || '0') || 0;
    const saldo = parseFloat(produto.sEST_QTD_SALDO || produto.SEST_QTD_SALDO || produto.sest_Saldo || '0') || 0;
    const codigo = produto.pROD_CODIGO || produto.prod_Codigo || produto.Codigo || '';
    const natureza = (produto.pROD_NATUREZA_ECONOMICA || produto.pROD_Natureza_Economica || '').toLowerCase();
    const tipo: 'P' | 'S' = natureza.includes('servi') ? 'S' : 'P';
    const updated = itens.map((item, i) => {
      if (i !== index) return item;
      const newItem: ItemOS = {
        ...item,
        ITOS_TIPO: tipo,
        ITOS_DESCRICAO: produto.pROD_NOME || produto.prod_Nome || produto.Nome || '',
        PROD_ID: codigo,
        ITOS_VLR_UNITARIO: preco,
        ITOS_SALDO_ESTOQUE: saldo,
      };
      newItem.ITOS_VLR_TOTAL = calcTotal(newItem);
      return newItem;
    });
    onChange(updated);
  };

  const buildOption = (p: ConsultaEstoqueItem) => {
    const codigo = p.pROD_CODIGO || p.prod_Codigo || p.Codigo || '';
    const nome = p.pROD_NOME || p.prod_Nome || p.Nome || '';
    const preco = parseFloat(p.pCPR_PRECO || p.PCPR_PRECO || p.prod_Preco_Venda || '0') || 0;
    const saldo = parseFloat(p.sEST_QTD_SALDO || p.SEST_QTD_SALDO || p.sest_Saldo || '0') || 0;
    return {
      id: codigo,
      label: `${codigo} - ${nome}`,
      sublabel: `Saldo: ${saldo.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} | R$ ${formatNumber(preco)}`,
      data: p,
    };
  };

  const fetchProdutosPorNome = useCallback(async (query: string) => {
    if (!unemId || query.length < 2) return [];
    try {
      const data = await getConsultaEstoque({ unem_id: unemId, prod_nome: query });
      return data.map(buildOption);
    } catch { return []; }
  }, [unemId]);

  const fetchProdutosPorCodigo = useCallback(async (query: string) => {
    if (!unemId || query.length < 2) return [];
    try {
      const data = await getConsultaEstoque({ unem_id: unemId, prod_codigo: query });
      return data.map(buildOption);
    } catch { return []; }
  }, [unemId]);

  const handleDialogSelect = (produto: ConsultaEstoqueItem) => {
    applyProductToEditing(produto);
  };

  const servicos = itens.filter((i) => i.ITOS_TIPO === 'S');
  const produtos = itens.filter((i) => i.ITOS_TIPO === 'P');

  return (
    <>
      <Card data-autocomplete-scope="itens-os">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Itens da OS
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                <Wrench className="h-3 w-3 mr-1" />{servicos.length} serviço(s)
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                <Package className="h-3 w-3 mr-1" />{produtos.length} produto(s)
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0 space-y-3">
          {/* Fixed input row */}
          <div className="bg-muted/20 border border-border/50 rounded-lg p-2 space-y-2">
            <div className="grid grid-cols-[90px_1fr_60px] gap-1.5 items-end">
              <div>
                <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Código</label>
                {unemId ? (
                  <AutocompleteInput
                    placeholder="Código..."
                    value={editingItem.PROD_ID || ''}
                    onChange={(v) => updateEditingField('PROD_ID' as keyof ItemOS, v)}
                    onSelect={(opt) => applyProductToEditing(opt.data)}
                    fetchOptions={fetchProdutosPorCodigo}
                    className="h-7 text-[10px] font-mono"
                  />
                ) : (
                  <Input
                    value={editingItem.PROD_ID || ''}
                    onChange={(e) => updateEditingField('PROD_ID' as keyof ItemOS, e.target.value)}
                    className="h-7 text-[10px] font-mono"
                    placeholder="Código..."
                  />
                )}
              </div>
              <div>
                <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Descrição</label>
                <div className="flex items-center gap-0.5">
                  {unemId ? (
                    <>
                      <div className="flex-1">
                        <AutocompleteInput
                          placeholder="Buscar produto/serviço..."
                          value={editingItem.ITOS_DESCRICAO}
                          onChange={(v) => updateEditingField('ITOS_DESCRICAO', v)}
                          onSelect={(opt) => applyProductToEditing(opt.data)}
                          fetchOptions={fetchProdutosPorNome}
                          className="h-7 text-[10px]"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => setSearchDialogOpen(true)}
                        title="Pesquisa avançada"
                      >
                        <Search className="h-3 w-3 text-primary" />
                      </Button>
                    </>
                  ) : (
                    <Input
                      value={editingItem.ITOS_DESCRICAO}
                      onChange={(e) => updateEditingField('ITOS_DESCRICAO', e.target.value)}
                      className="h-7 text-[10px]"
                      placeholder="Descrição..."
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Saldo</label>
                <Input
                  value={editingItem.ITOS_SALDO_ESTOQUE != null ? editingItem.ITOS_SALDO_ESTOQUE : ''}
                  readOnly
                  className="h-7 text-[10px] text-center bg-muted/30"
                  tabIndex={-1}
                />
              </div>
            </div>
            <div className="grid grid-cols-[65px_100px_85px_100px_auto] gap-1.5 items-end">
              <div>
                <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Qtde</label>
                <Input
                  type="number"
                  min={1}
                  value={editingItem.ITOS_QTDE}
                  onChange={(e) => updateEditingField('ITOS_QTDE', parseFloat(e.target.value) || 0)}
                  className="h-7 text-[10px] text-center"
                />
              </div>
              <div>
                <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Vlr Unit.</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={editingItem.ITOS_VLR_UNITARIO}
                  onChange={(e) => updateEditingField('ITOS_VLR_UNITARIO', parseFloat(e.target.value) || 0)}
                  className="h-7 text-[10px] text-right"
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Desconto</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={editingItem.ITOS_DESCONTO}
                  onChange={(e) => updateEditingField('ITOS_DESCONTO', parseFloat(e.target.value) || 0)}
                  className="h-7 text-[10px] text-right"
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Total</label>
                <div className="h-7 flex items-center justify-end px-2 text-[10px] font-bold text-primary bg-primary/5 border border-primary/20 rounded-md">
                  {formatNumber(editingItem.ITOS_VLR_TOTAL)}
                </div>
              </div>
              <div className="flex items-end">
                <Button
                  size="sm"
                  className="h-7 text-[10px] px-3"
                  onClick={addItem}
                  disabled={!editingItem.PROD_ID && !editingItem.ITOS_DESCRICAO}
                >
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
            </div>
          </div>

          {/* Items grid */}
          {itens.length === 0 ? (
            <div className="text-center text-muted-foreground text-[11px] py-6 border border-dashed border-border/50 rounded-lg">
              Nenhum item adicionado
            </div>
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-[24px_70px_1fr_50px_50px_80px_70px_80px_28px] gap-1 px-2 py-1">
                <span className="text-[9px] font-medium text-muted-foreground uppercase">#</span>
                <span className="text-[9px] font-medium text-muted-foreground uppercase">Código</span>
                <span className="text-[9px] font-medium text-muted-foreground uppercase">Descrição</span>
                <span className="text-[9px] font-medium text-muted-foreground uppercase text-center">Saldo</span>
                <span className="text-[9px] font-medium text-muted-foreground uppercase text-center">Qtde</span>
                <span className="text-[9px] font-medium text-muted-foreground uppercase text-right">Vlr Unit.</span>
                <span className="text-[9px] font-medium text-muted-foreground uppercase text-right">Desc.</span>
                <span className="text-[9px] font-medium text-muted-foreground uppercase text-right">Total</span>
                <span></span>
              </div>
              {/* Rows */}
              {itens.map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[24px_70px_1fr_50px_50px_80px_70px_80px_28px] gap-1 px-2 py-1.5 rounded-md bg-card border border-border/40 hover:border-primary/30 hover:bg-primary/[0.02] transition-colors group items-center"
                >
                  <span className="text-[10px] text-muted-foreground font-mono">{idx + 1}</span>
                  <span className="text-[10px] font-mono text-foreground truncate" title={item.PROD_ID}>{item.PROD_ID || '-'}</span>
                  <div className="flex items-center gap-1 min-w-0">
                    <Badge
                      variant="outline"
                      className={`text-[8px] px-1 py-0 shrink-0 ${item.ITOS_TIPO === 'S' ? 'border-accent text-accent' : 'border-primary text-primary'}`}
                    >
                      {item.ITOS_TIPO === 'S' ? 'S' : 'P'}
                    </Badge>
                    <span className="text-[10px] text-foreground truncate" title={item.ITOS_DESCRICAO}>{item.ITOS_DESCRICAO || '-'}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground text-center">{item.ITOS_SALDO_ESTOQUE ?? '-'}</span>
                  <span className="text-[10px] text-foreground text-center font-medium">{item.ITOS_QTDE}</span>
                  <span className="text-[10px] text-foreground text-right">{formatNumber(item.ITOS_VLR_UNITARIO)}</span>
                  <span className="text-[10px] text-muted-foreground text-right">{item.ITOS_DESCONTO > 0 ? formatNumber(item.ITOS_DESCONTO) : '-'}</span>
                  <span className="text-[10px] font-semibold text-foreground text-right">{formatNumber(item.ITOS_VLR_TOTAL)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeItem(idx)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
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