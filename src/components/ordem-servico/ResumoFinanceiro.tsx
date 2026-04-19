import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign } from 'lucide-react';
import type { ItemOS } from '@/lib/api-os';

interface ResumoFinanceiroProps {
  itens: ItemOS[];
  descontoOS?: number;
  descontoServico?: number;
  onDescontoOSChange?: (v: number) => void;
  onDescontoServicoChange?: (v: number) => void;
}

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ResumoFinanceiro({
  itens,
  descontoOS = 0,
  descontoServico = 0,
  onDescontoOSChange,
  onDescontoServicoChange,
}: ResumoFinanceiroProps) {
  const subtotal = itens.reduce((sum, i) => sum + (i.ITOS_QTDE * i.ITOS_VLR_UNITARIO), 0);
  const descontoItens = itens.reduce((sum, i) => sum + i.ITOS_DESCONTO, 0);
  const subtotalServicos = itens
    .filter(i => i.ITOS_TIPO === 'S')
    .reduce((sum, i) => sum + Math.max(0, (i.ITOS_QTDE * i.ITOS_VLR_UNITARIO) - i.ITOS_DESCONTO), 0);
  const total = Math.max(0, subtotal - descontoItens - descontoOS - descontoServico);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Resumo Financeiro</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Desconto Itens</span>
            <span className="font-medium text-destructive">- {formatCurrency(descontoItens)}</span>
          </div>

          {onDescontoServicoChange && (
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                Desc. Serviços <span className="text-[10px] opacity-70">(máx {formatCurrency(subtotalServicos)})</span>
              </Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={descontoServico || ''}
                onChange={(e) => onDescontoServicoChange(parseFloat(e.target.value) || 0)}
                className="h-7 text-xs text-right w-28"
                placeholder="0,00"
              />
            </div>
          )}

          {onDescontoOSChange && (
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">Desc. Total OS</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={descontoOS || ''}
                onChange={(e) => onDescontoOSChange(parseFloat(e.target.value) || 0)}
                className="h-7 text-xs text-right w-28"
                placeholder="0,00"
              />
            </div>
          )}

          <div className="border-t border-border pt-2 flex justify-between">
            <span className="font-semibold text-foreground">Total</span>
            <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
