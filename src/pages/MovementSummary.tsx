import { useState, useMemo, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, FileDown, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getResumoMovimento, type MovementSummary as MovementSummaryType } from "@/lib/api";
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

function fmtNum(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface GroupedData {
  operacao: string;
  items: MovementSummaryType[];
  total: number;
  totalTributos: number;
}

export default function MovementSummary() {
  const { auth } = useAuth();
  const [dtInicial, setDtInicial] = useState(firstOfMonth());
  const [dtFinal, setDtFinal] = useState(todayStr());
  const [tipoOperacao, setTipoOperacao] = useState("");
  const [data, setData] = useState<MovementSummaryType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const handleSearch = async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const di = dtInicial.replace(/-/g, "/");
      const df = dtFinal.replace(/-/g, "/");
      const result = await getResumoMovimento({
        dtInicial: di,
        dtFinal: df,
        tipooperacao: tipoOperacao,
        unem_id: auth.unidade.unem_Id,
      });
      setData(result);
      setSearched(true);
      setCollapsed({});
      if (result.length === 0) toast.info("Nenhum registro encontrado.");
    } catch (e: any) {
      toast.error("Erro ao buscar dados: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo<GroupedData[]>(() => {
    const map = new Map<string, MovementSummaryType[]>();
    data.forEach((r) => {
      const key = r.OPCM_NOME_CLIENTE || "(Sem operação)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries()).map(([operacao, items]) => ({
      operacao,
      items,
      total: items.reduce((s, r) => s + parseNum(r.DCFS_VLR_TOTAL), 0),
      totalTributos: items.reduce((s, r) => s + parseNum(r.ITFT_VLR_TRIBUTOS), 0),
    }));
  }, [data]);

  const totalVlr = data.reduce((s, r) => s + parseNum(r.DCFS_VLR_TOTAL), 0);
  const totalTributos = data.reduce((s, r) => s + parseNum(r.ITFT_VLR_TRIBUTOS), 0);

  const toggleGroup = (op: string) => {
    setCollapsed((prev) => ({ ...prev, [op]: !prev[op] }));
  };

  const handleExportPDF = () => {
    if (data.length === 0) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo do Movimento", 14, 15);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const now = new Date();
    const dtPrint = `${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    doc.text(`Dt Impressão: ${dtPrint}`, pageW - 14, 10, { align: "right" });
    doc.text(`Usuário: ${auth?.user?.pess_Nome || ""}`, pageW - 14, 15, { align: "right" });

    const tipoLabel = tipoOperacao === "E" ? "Entrada" : tipoOperacao === "S" ? "Saída" : "Todas";
    doc.text(`Período: ${dtInicial} a ${dtFinal}  |  Tipo: ${tipoLabel}`, 14, 21);

    let startY = 26;

    const head = [["Data", "Data Emis.", "Mod.", "Serie / Nº", "Vlr Doc", "Nº Pedido", "Vlr Trib Subs", "Cód Vend", "Cliente/Fornecedor"]];

    grouped.forEach((g) => {
      // Operation title
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`Operação: ${g.operacao}`, 14, startY);
      startY += 2;

      const body = g.items.map((r) => [
        r.DCFS_DATA_SAIDA || "",
        r.DCFS_DATA_SAIDA || "",
        r.DCFS_MODELO_NOTA || "",
        r.DCFS_NUMERO_NOTA || "",
        fmtNum(parseNum(r.DCFS_VLR_TOTAL)),
        r.PDDS_NUMERO || "",
        fmtNum(parseNum(r.ITFT_VLR_TRIBUTOS)),
        r.VDDR_NOME || "",
        r.DCFS_NOME || "",
      ]);

      autoTable(doc, {
        startY,
        head,
        body,
        theme: "plain",
        styles: { fontSize: 7, cellPadding: 1.2 },
        headStyles: { fillColor: [90, 90, 90], textColor: 255, fontStyle: "bold", fontSize: 7 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          4: { halign: "right" },
          6: { halign: "right" },
        },
      });

      // Subtotal after table
      const finalY = (doc as any).lastAutoTable?.finalY || startY + 10;
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(`Total Operação: ${fmtNum(g.total)}`, 14, finalY + 4);
      doc.text(`T Tributos: ${fmtNum(g.totalTributos)}`, 100, finalY + 4);

      startY = finalY + 9;

      // Check page break
      if (startY > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        startY = 15;
      }
    });

    // Grand total
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const totalLabel = tipoOperacao === "E" ? "Total das Entradas" : tipoOperacao === "S" ? "Total das Saídas" : "Total Geral";
    doc.text(`${totalLabel} -->: ${fmtNum(totalVlr)}`, 14, startY);
    doc.text(`T Tributos: ${fmtNum(totalTributos)}`, 100, startY);

    doc.save(`resumo_movimentacao_${dtInicial}_${dtFinal}.pdf`);
    toast.success("PDF exportado com sucesso!");
  };

  const colCount = 10;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Resumo de Movimentação</h1>
        <p className="text-muted-foreground text-sm mt-1">Consulta de notas por período e tipo de operação</p>
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Data Inicial</label>
              <Input type="date" value={dtInicial} onChange={(e) => setDtInicial(e.target.value)} className="w-36 h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Data Final</label>
              <Input type="date" value={dtFinal} onChange={(e) => setDtFinal(e.target.value)} className="w-36 h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo Operação</label>
              <Select value={tipoOperacao} onValueChange={setTipoOperacao}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="E">Entrada</SelectItem>
                  <SelectItem value="S">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSearch} disabled={loading} size="sm" className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Consultar
            </Button>
            {data.length > 0 && (
              <Button onClick={handleExportPDF} variant="outline" size="sm" className="gap-1.5">
                <FileDown className="h-4 w-4" />
                Exportar PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {searched && (
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
            <CardTitle className="text-sm font-semibold">Resultado ({data.length} registros)</CardTitle>
            {data.length > 0 && (
              <div className="flex gap-4">
                <span className="text-sm font-semibold text-primary">Total: {fmtNum(totalVlr)}</span>
                <span className="text-sm font-semibold text-muted-foreground">Tributos: {fmtNum(totalTributos)}</span>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full" style={{ fontSize: "0.65rem" }}>
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Data</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Mod.</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Serie / Nº</th>
                  <th className="text-right px-2 py-1.5 font-semibold text-muted-foreground">Vlr Doc</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Nº Pedido</th>
                  <th className="text-right px-2 py-1.5 font-semibold text-muted-foreground">Vlr Trib</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Vendedor</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Cliente/Fornecedor</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted-foreground py-6">Nenhum dado encontrado</td>
                  </tr>
                ) : (
                  grouped.map((g) => {
                    const isCollapsed = collapsed[g.operacao];
                    return (
                      <Fragment key={g.operacao}>
                        {/* Group header */}
                        <tr
                          className="bg-muted/50 border-b border-border cursor-pointer hover:bg-muted/70 transition-colors"
                          onClick={() => toggleGroup(g.operacao)}
                        >
                          <td colSpan={5} className="px-2 py-1.5 font-semibold text-foreground">
                            <span className="inline-flex items-center gap-1">
                              {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              Operação: {g.operacao}
                              <span className="text-muted-foreground font-normal ml-1">({g.items.length})</span>
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold">{fmtNum(g.totalTributos)}</td>
                          <td className="px-2 py-1.5" />
                          <td className="px-2 py-1.5 text-right font-semibold">{fmtNum(g.total)}</td>
                        </tr>
                        {/* Group items */}
                        {!isCollapsed &&
                          g.items.map((r, i) => (
                            <tr
                              key={i}
                              className={`border-b border-border/40 ${i % 2 === 0 ? "bg-background" : "bg-muted/30"} hover:bg-accent/40 transition-colors`}
                            >
                              <td className="px-2 py-1">{r.DCFS_DATA_SAIDA}</td>
                              <td className="px-2 py-1">{r.DCFS_MODELO_NOTA}</td>
                              <td className="px-2 py-1 font-medium">{r.DCFS_NUMERO_NOTA}</td>
                              <td className="px-2 py-1 text-right font-medium">{fmtNum(parseNum(r.DCFS_VLR_TOTAL))}</td>
                              <td className="px-2 py-1">{r.PDDS_NUMERO || ""}</td>
                              <td className="px-2 py-1 text-right">{fmtNum(parseNum(r.ITFT_VLR_TRIBUTOS))}</td>
                              <td className="px-2 py-1">{r.VDDR_NOME || ""}</td>
                              <td className="px-2 py-1">{r.DCFS_NOME}</td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })
                )}
                {data.length > 0 && (
                  <tr className="bg-muted/60 border-t-2 border-border font-semibold">
                    <td colSpan={3} className="px-2 py-1.5 text-right">Total Geral</td>
                    <td className="px-2 py-1.5 text-right">{fmtNum(totalVlr)}</td>
                    <td className="px-2 py-1.5" />
                    <td className="px-2 py-1.5 text-right">{fmtNum(totalTributos)}</td>
                    <td colSpan={2} className="px-2 py-1.5" />
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
