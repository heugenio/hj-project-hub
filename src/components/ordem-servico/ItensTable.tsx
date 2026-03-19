import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Package, Wrench } from 'lucide-react';
import type { ItemOS } from '@/lib/api-os';

interface ItensTableProps {
  itens: ItemOS[];
  onChange: (itens: ItemOS[]) => void;
}

function emptyItem(): ItemOS {
  return {
    ITOS_TIPO: 'S',
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

export function ItensTable({ itens, onChange }: ItensTableProps) {
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

  const servicos = itens.filter((i) => i.ITOS_TIPO === 'S');
  const produtos = itens.filter((i) => i.ITOS_TIPO === 'P');

  return (
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
                <TableHead className="text-xs w-[100px]">Tipo</TableHead>
                <TableHead className="text-xs">Descrição</TableHead>
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
                  <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-8">
                    Nenhum item adicionado. Clique em "Adicionar" para começar.
                  </TableCell>
                </TableRow>
              )}
              {itens.map((item, idx) => (
                <TableRow key={idx} className="group">
                  <TableCell className="p-1.5">
                    <Select
                      value={item.ITOS_TIPO}
                      onValueChange={(v) => updateItem(idx, 'ITOS_TIPO', v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="S">Serviço</SelectItem>
                        <SelectItem value="P">Produto</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1.5">
                    <Input
                      value={item.ITOS_DESCRICAO}
                      onChange={(e) => updateItem(idx, 'ITOS_DESCRICAO', e.target.value)}
                      className="h-8 text-xs"
                      placeholder="Descrição do item..."
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
  );
}
