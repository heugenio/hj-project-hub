import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, ChevronDown, ChevronRight, FileDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getDemonstrativoVendas, type SalesDemo as SalesDemoType } from "@/lib/api";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonth() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function parseNum(v: string | undefined): number {
  if (!v) return 0;
  return parseFloat(v.replace(",", ".")) || 0;
}

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtQtd(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

interface GroupedData {
  grupo: string;
  grpoId: string;
  items: SalesDemoType[];
  totals: {
    qtd: number;
    qtdFat: number;
    vlrContabil: number;
    custo: number;
    vlrDev: number;
    qtdDev: number;
    lucro: number;
    pctLucro: number;
  };
}

function formatGroupName(_grpoId: string, grupo: string): string {
  return grupo;
}

function groupByGrupo(data: SalesDemoType[]): GroupedData[] {
  const map = new Map<string, SalesDemoType[]>();
  for (const item of data) {
    const key = item.GRUPO || "Sem Grupo";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }

  return Array.from(map.entries()).map(([grupo, items]) => {
    const qtd = items.reduce((s, r) => s + parseNum(r.DCFS_QTD), 0);
    const qtdFat = items.reduce((s, r) => s + parseNum(r.ITFT_QTDE_FATURADA), 0);
    const vlrContabil = items.reduce((s, r) => s + parseNum(r.ITFT_VLR_CONTABIL), 0);
    const custo = items.reduce((s, r) => s + parseNum(r.ITFT_CUSTO_NA_OPERACAO), 0);
    const vlrDev = items.reduce((s, r) => s + parseNum(r.VLR_DEV), 0);
    const qtdDev = items.reduce((s, r) => s + parseNum(r.QTDE_DEV), 0);
    const lucro = vlrContabil - custo;
    const pctLucro = vlrContabil > 0 ? (lucro / vlrContabil) * 100 : 0;

    return {
      grupo,
      grpoId: items[0]?.GRPO_ID || "",
      items,
      totals: { qtd, qtdFat, vlrContabil, custo, vlrDev, qtdDev, lucro, pctLucro },
    };
  });
}

export default function SalesDemo() {
  const { auth } = useAuth();
  const [dtInicial, setDtInicial] = useState(firstOfMonth());
  const [dtFinal, setDtFinal] = useState(todayStr());
  const [data, setData] = useState<SalesDemoType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const di = dtInicial.replace(/-/g, "/");
      const df = dtFinal.replace(/-/g, "/");
      const result = await getDemonstrativoVendas({
        dtInicial: di,
        dtFinal: df,
        unem_id: auth.unidade.unem_Id,
      });
      setData(result);
      setSearched(true);
      // Start with all groups expanded
      const allGroups = groupByGrupo(result).map(g => g.grupo);
      setExpandedGroups(new Set(allGroups));
      if (result.length === 0) toast.info("Nenhum registro encontrado.");
    } catch (e: any) {
      toast.error("Erro ao buscar dados: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (grupo: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(grupo)) next.delete(grupo);
      else next.add(grupo);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedGroups(new Set(grouped.map((g) => g.grupo)));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  const grouped = groupByGrupo(data);

  const grandTotals = {
    qtd: data.reduce((s, r) => s + parseNum(r.DCFS_QTD), 0),
    qtdFat: data.reduce((s, r) => s + parseNum(r.ITFT_QTDE_FATURADA), 0),
    vlrContabil: data.reduce((s, r) => s + parseNum(r.ITFT_VLR_CONTABIL), 0),
    custo: data.reduce((s, r) => s + parseNum(r.ITFT_CUSTO_NA_OPERACAO), 0),
    vlrDev: data.reduce((s, r) => s + parseNum(r.VLR_DEV), 0),
    qtdDev: data.reduce((s, r) => s + parseNum(r.QTDE_DEV), 0),
    lucro: 0,
    pctLucro: 0,
  };
  grandTotals.lucro = grandTotals.vlrContabil - grandTotals.custo;
  grandTotals.pctLucro = grandTotals.vlrContabil > 0 ? (grandTotals.lucro / grandTotals.vlrContabil) * 100 : 0;

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    const pageWidth = doc.internal.pageSize.getWidth();
    const unidadeNome = auth?.unidade?.unem_Fantasia || auth?.unidade?.unem_Razao_Social || "";

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Demonstrativo de Vendas por Grupo", pageWidth / 2, 15, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Unidade: ${unidadeNome}`, 14, 23);
    doc.text(`Período: ${dtInicial.replace(/-/g, "/")} a ${dtFinal.replace(/-/g, "/")}`, 14, 28);

    const now = new Date();
    doc.text(`Dt Impressão: ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, pageWidth - 14, 23, { align: "right" });

    // Build table body
    const body: any[] = [];

    for (const group of grouped) {
      body.push([
        { content: formatGroupName(group.grpoId, group.grupo), colSpan: 12, styles: { fontStyle: "bold", fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: { bottom: 0.3, top: 0, left: 0, right: 0 }, lineColor: [180, 180, 180] } },
      ]);

      for (const item of group.items) {
        const vlr = parseNum(item.ITFT_VLR_CONTABIL);
        const cst = parseNum(item.ITFT_CUSTO_NA_OPERACAO);
        const lucro = item.ITFT_VLR_LUCRO ? parseNum(item.ITFT_VLR_LUCRO) : vlr - cst;
        const pct = item.ITFT_PER_LUCRO ? parseNum(item.ITFT_PER_LUCRO).toFixed(2) : (vlr > 0 ? ((lucro / vlr) * 100).toFixed(2) : "0.00");
        body.push([
          item.CURVA || "",
          item.PROD_CODIGO || "",
          item.PROD_NOME || "",
          item.PROD_REFERENCIA || "",
          item.ITFT_UNID_SIGLA || "",
          fmtQtd(parseNum(item.ITFT_QTDE_FATURADA)),
          fmtBRL(vlr),
          fmtBRL(cst),
          fmtBRL(lucro),
          `${pct}%`,
          `${item.ITFT_PARTICIPACAO || "0"}%`,
          item.SEST_QTD_MOV || "",
        ]);
      }

      body.push([
        { content: `Total do Grupo →`, colSpan: 5, styles: { fontStyle: "bold" } },
        { content: fmtQtd(group.totals.qtdFat), styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtBRL(group.totals.vlrContabil), styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtBRL(group.totals.custo), styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtBRL(group.totals.lucro), styles: { fontStyle: "bold", halign: "right" } },
        { content: `${group.totals.pctLucro.toFixed(2)}%`, styles: { fontStyle: "bold", halign: "right" } },
        "", "",
      ]);
    }

    body.push([
      { content: "Total Geral →", colSpan: 5, styles: { fontStyle: "bold", fillColor: [200, 200, 200], textColor: [0, 0, 0] } },
      { content: fmtQtd(grandTotals.qtdFat), styles: { fontStyle: "bold", fillColor: [200, 200, 200], halign: "right" } },
      { content: fmtBRL(grandTotals.vlrContabil), styles: { fontStyle: "bold", fillColor: [200, 200, 200], halign: "right" } },
      { content: fmtBRL(grandTotals.custo), styles: { fontStyle: "bold", fillColor: [200, 200, 200], halign: "right" } },
      { content: fmtBRL(grandTotals.lucro), styles: { fontStyle: "bold", fillColor: [200, 200, 200], halign: "right" } },
      { content: `${grandTotals.pctLucro.toFixed(2)}%`, styles: { fontStyle: "bold", fillColor: [200, 200, 200], halign: "right" } },
      { content: "", styles: { fillColor: [200, 200, 200] } },
      { content: "", styles: { fillColor: [200, 200, 200] } },
    ]);

    if (grandTotals.vlrDev > 0) {
      body.push([
        { content: "Devolução →", colSpan: 5, styles: { fontStyle: "bold" } },
        fmtQtd(grandTotals.qtdDev),
        fmtBRL(grandTotals.vlrDev),
        "", "", "", "", "",
      ]);
    }

    autoTable(doc, {
      startY: 33,
      head: [["Curva", "Código", "Produto", "Referência", "Unid", "Qtd", "Venda", "Custo", "Lucro", "%Lucro", "Partic.", "Saldo"]],
      body,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: {
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "right" },
        9: { halign: "right" },
        10: { halign: "right" },
        11: { halign: "right" },
      },
      theme: "grid",
    });

    doc.save(`demonstrativo_vendas_${dtInicial}_${dtFinal}.pdf`);
    toast.success("PDF exportado com sucesso!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Demonstrativo de Vendas</h1>
        <p className="text-muted-foreground text-sm mt-1">Relatório de vendas por grupo</p>
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Data Inicial</label>
              <Input type="date" value={dtInicial} onChange={(e) => setDtInicial(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Data Final</label>
              <Input type="date" value={dtFinal} onChange={(e) => setDtFinal(e.target.value)} className="w-40" />
            </div>
            <Button onClick={handleSearch} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Consultar
            </Button>
            {searched && data.length > 0 && (
              <Button onClick={exportPDF} variant="outline" className="gap-2 ml-auto">
                <FileDown className="h-4 w-4" />
                Exportar PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {searched && data.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Quantidade</p>
                <p className="text-xl font-bold text-foreground">{fmtQtd(grandTotals.qtdFat)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Total de Vendas</p>
                <p className="text-xl font-bold text-foreground">{fmtBRL(grandTotals.vlrContabil)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Lucro</p>
                <p className="text-xl font-bold text-green-600">{fmtBRL(grandTotals.lucro)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Devolução</p>
                <p className="text-xl font-bold text-destructive">{fmtBRL(grandTotals.vlrDev)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Valor Líquido</p>
                <p className="text-xl font-bold text-foreground">{fmtBRL(grandTotals.vlrContabil - grandTotals.vlrDev)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs">
              Expandir Todos
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs">
              Recolher Todos
            </Button>
          </div>

          {/* Grouped Table */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resultado por Grupo</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
               <Table className="text-xs">
                <TableHeader>
                  <TableRow className="[&>th]:py-1.5 [&>th]:px-2">
                     <TableHead className="w-7 px-1"></TableHead>
                     <TableHead className="w-12">Curva</TableHead>
                     <TableHead>Código</TableHead>
                     <TableHead>Produto</TableHead>
                     <TableHead>Referência</TableHead>
                     <TableHead className="w-10">Unid</TableHead>
                     <TableHead className="text-right w-16">Qtd</TableHead>
                     <TableHead className="text-right">Venda</TableHead>
                     <TableHead className="text-right">Custo</TableHead>
                     <TableHead className="text-right">Lucro</TableHead>
                     <TableHead className="text-right w-16">%Lucro</TableHead>
                     <TableHead className="text-right w-16">Partic.</TableHead>
                     <TableHead className="text-right w-16">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped.map((group) => {
                    const isExpanded = expandedGroups.has(group.grupo);
                    return (
                      <GroupRows
                        key={group.grpoId}
                        group={group}
                        isExpanded={isExpanded}
                        onToggle={() => toggleGroup(group.grupo)}
                      />
                    );
                  })}

                  {/* Grand Total */}
                  <TableRow className="bg-muted/70 font-bold border-t-2 border-border [&>td]:py-1.5 [&>td]:px-2">
                     <TableCell></TableCell>
                     <TableCell colSpan={5} className="font-bold">TOTAL GERAL</TableCell>
                     <TableCell className="text-right font-bold">{fmtQtd(grandTotals.qtdFat)}</TableCell>
                     <TableCell className="text-right font-bold">{fmtBRL(grandTotals.vlrContabil)}</TableCell>
                     <TableCell className="text-right font-bold">{fmtBRL(grandTotals.custo)}</TableCell>
                     <TableCell className="text-right font-bold">{fmtBRL(grandTotals.lucro)}</TableCell>
                     <TableCell className="text-right font-bold">{grandTotals.pctLucro.toFixed(2)}%</TableCell>
                     <TableCell className="text-right font-bold">-</TableCell>
                     <TableCell className="text-right font-bold">-</TableCell>
                   </TableRow>

                   {grandTotals.vlrDev > 0 && (
                     <TableRow className="bg-destructive/10 [&>td]:py-1.5 [&>td]:px-2">
                       <TableCell></TableCell>
                       <TableCell colSpan={5} className="font-bold text-destructive">DEVOLUÇÃO</TableCell>
                       <TableCell className="text-right">{fmtQtd(grandTotals.qtdDev)}</TableCell>
                       <TableCell className="text-right font-bold text-destructive">{fmtBRL(grandTotals.vlrDev)}</TableCell>
                       <TableCell colSpan={5}></TableCell>
                     </TableRow>
                   )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {searched && data.length === 0 && !loading && (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum dado encontrado para o período selecionado.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GroupRows({
  group,
  isExpanded,
  onToggle,
}: {
  group: GroupedData;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      {/* Group Header */}
      <TableRow
        className="bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors [&>td]:py-1.5 [&>td]:px-2"
        onClick={onToggle}
      >
         <TableCell className="w-7 px-1">
           {isExpanded ? (
             <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
           ) : (
             <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
           )}
         </TableCell>
         <TableCell colSpan={5} className="font-semibold text-xs">
           {formatGroupName(group.grpoId, group.grupo)}
         </TableCell>
         <TableCell className="text-right font-semibold">{fmtQtd(group.totals.qtdFat)}</TableCell>
         <TableCell className="text-right font-semibold">{fmtBRL(group.totals.vlrContabil)}</TableCell>
         <TableCell className="text-right font-semibold">{fmtBRL(group.totals.custo)}</TableCell>
         <TableCell className="text-right font-semibold">{fmtBRL(group.totals.lucro)}</TableCell>
         <TableCell className="text-right font-semibold">{group.totals.pctLucro.toFixed(2)}%</TableCell>
         <TableCell className="text-right font-semibold">-</TableCell>
         <TableCell className="text-right font-semibold">-</TableCell>
       </TableRow>

       {/* Detail Rows */}
       {isExpanded &&
         group.items.map((item, i) => {
           const vlr = parseNum(item.ITFT_VLR_CONTABIL);
           const cst = parseNum(item.ITFT_CUSTO_NA_OPERACAO);
           const lucro = item.ITFT_VLR_LUCRO ? parseNum(item.ITFT_VLR_LUCRO) : vlr - cst;
           const pctLucro = item.ITFT_PER_LUCRO ? parseNum(item.ITFT_PER_LUCRO).toFixed(2) : (vlr > 0 ? ((lucro / vlr) * 100).toFixed(2) : "0.00");

           return (
             <TableRow key={i} className={`text-xs [&>td]:py-1 [&>td]:px-2 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/15'}`}>
               <TableCell></TableCell>
               <TableCell className="text-muted-foreground">{item.CURVA || ""}</TableCell>
               <TableCell className="text-muted-foreground">{item.PROD_CODIGO || ""}</TableCell>
               <TableCell className="text-muted-foreground max-w-[200px] truncate" title={item.PROD_NOME || ""}><span className="line-clamp-2 whitespace-normal">{item.PROD_NOME || ""}</span></TableCell>
               <TableCell className="text-muted-foreground">{item.PROD_REFERENCIA || ""}</TableCell>
               <TableCell className="text-muted-foreground">{item.ITFT_UNID_SIGLA || ""}</TableCell>
               <TableCell className="text-right">{item.ITFT_QTDE_FATURADA}</TableCell>
               <TableCell className="text-right">{fmtBRL(vlr)}</TableCell>
               <TableCell className="text-right">{fmtBRL(cst)}</TableCell>
               <TableCell className="text-right">{fmtBRL(lucro)}</TableCell>
               <TableCell className="text-right">{pctLucro}%</TableCell>
               <TableCell className="text-right">{item.ITFT_PARTICIPACAO}%</TableCell>
               <TableCell className="text-right">{item.SEST_QTD_MOV || ""}</TableCell>
             </TableRow>
           );
         })}
     </>
   );
 }
