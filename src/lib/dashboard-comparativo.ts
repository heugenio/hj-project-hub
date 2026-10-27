import { parseValorBR, type Comparativo, type SalesDemo } from "@/lib/api";

export function previousSalesPeriod(now: Date) {
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  end.setDate(Math.min(now.getDate(), end.getDate()));
  const month = `${end.getFullYear()}/${String(end.getMonth() + 1).padStart(2, "0")}`;
  return { dtInicial: `${month}/01`, dtFinal: `${month}/${String(end.getDate()).padStart(2, "0")}` };
}

// Usar apenas valores reais de cada período; não inferir o tipo de grupo pelo produto.
export function comparativoFromSales(id: string, current: SalesDemo[], previous: SalesDemo[]): Comparativo[] {
  const groups = new Map<string, { name: string; current: number; previous: number; qty: number; prevQty: number }>();
  for (const [rows, isCurrent] of [[current, true], [previous, false]] as const) {
    for (const row of rows) {
      const key = row.GRPO_ID || row.GRUPO;
      const group = groups.get(key) || { name: row.GRUPO.replace(/^\d+\s*-\s*/, "").trim(), current: 0, previous: 0, qty: 0, prevQty: 0 };
      if (isCurrent) {
        group.current += parseValorBR(row.ITFT_VLR_CONTABIL);
        group.qty += parseValorBR(row.ITFT_QTDE_FATURADA);
      } else {
        group.previous += parseValorBR(row.ITFT_VLR_CONTABIL);
        group.prevQty += parseValorBR(row.ITFT_QTDE_FATURADA);
      }
      groups.set(key, group);
    }
  }
  const format = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  return Array.from(groups.values(), (group) => ({
    UNEM_ID: id, GRPO_NOME: group.name, GRPO_TIPO: "Geral",
    ITFT_VLR_CONTABIL: format(group.current), ITFT_QTDE: format(group.qty),
    ITFT_VLR_CONTABIL_ANT: format(group.previous), ITFT_QTDE_ANT: format(group.prevQty),
    CRECIMENTO: String(group.previous > 0 ? (group.current - group.previous) / group.previous * 100 : 0),
  }));
}