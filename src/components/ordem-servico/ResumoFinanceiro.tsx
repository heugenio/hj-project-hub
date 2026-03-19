import { Card, CardContent } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';
import type { ItemOS } from '@/lib/api-os';

interface ResumoFinanceiroProps {
  itens: ItemOS[];
}

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ResumoFinanceiro({ itens }: ResumoFinanceiroProps) {
  const subtotal = itens.reduce((sum, i) => sum + (i.ITOS_QTDE * i.ITOS_VLR_UNITARIO), 0);
  const descontoTotal = itens.reduce((sum, i) => sum + i.ITOS_DESCONTO, 0);
  const total = Math.max(0, subtotal - descontoTotal);

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
            <span className="text-muted-foreground">Descontos</span>
            <span className="font-medium text-destructive">- {formatCurrency(descontoTotal)}</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between">
            <span className="font-semibold text-foreground">Total</span>
            <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
