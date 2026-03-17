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

    doc.setFontSize(14);
    doc.text("Resumo de Movimentação", 14, 15);
    doc.setFontSize(9);
    doc.text(`Período: ${dtInicial} a ${dtFinal}`, 14, 21);

    const tipoLabel = tipoOperacao === "E" ? "Entrada" : tipoOperacao === "S" ? "Saída" : "Todas";
    doc.text(`Tipo Operação: ${tipoLabel}`, 14, 26);

    const head = [["Operação", "Compra", "Tipo", "Nota", "Modelo", "Data Saída", "Cliente", "Pedido", "Vendedor", "Valor Total", "Tributos"]];
    const body: (string | number)[][] = [];

    grouped.forEach((g) => {
      g.items.forEach((r) => {
        body.push([
          r.OPCM_NOME_CLIENTE || "",
          r.HMOV_TIPO || "",
          r.DCFS_TIPO_MOVIMENTO || "",
          r.DCFS_NUMERO_NOTA || "",
          r.DCFS_MODELO_NOTA || "",
          r.DCFS_DATA_SAIDA || "",
          r.DCFS_NOME || "",
          r.PDDS_NUMERO || "",
          r.VDDR_NOME || "",
          fmtNum(parseNum(r.DCFS_VLR_TOTAL)),
          fmtNum(parseNum(r.ITFT_VLR_TRIBUTOS)),
        ]);
      });
    });

    body.push(["", "", "", "", "", "", "", "", "Total", fmtNum(totalVlr), fmtNum(totalTributos)]);

    autoTable(doc, {
      startY: 30,
      head,
      body,
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [55, 55, 55], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        9: { halign: "right" },
        10: { halign: "right" },
      },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.row.index === body.length - 1) {
          hookData.cell.styles.fontStyle = "bold";
          hookData.cell.styles.fillColor = [220, 220, 220];
        }
      },
    });

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
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Compra</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Tipo</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Nota</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Modelo</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Data Saída</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Cliente</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Pedido</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Vendedor</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Valor Total</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Tributos</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="text-center text-muted-foreground py-6">Nenhum dado encontrado</td>
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
                          <td colSpan={8} className="px-3 py-1.5 font-semibold text-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              {g.operacao}
                              <span className="text-muted-foreground font-normal ml-1">({g.items.length})</span>
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold">{fmtNum(g.total)}</td>
                          <td className="px-3 py-1.5 text-right font-semibold">{fmtNum(g.totalTributos)}</td>
                        </tr>
                        {/* Group items */}
                        {!isCollapsed &&
                          g.items.map((r, i) => (
                            <tr
                              key={i}
                              className={`border-b border-border/40 ${i % 2 === 0 ? "bg-background" : "bg-muted/30"} hover:bg-accent/40 transition-colors`}
                            >
                              <td className="px-3 py-1.5">{r.HMOV_TIPO || ""}</td>
                              <td className="px-3 py-1.5">{r.DCFS_TIPO_MOVIMENTO || ""}</td>
                              <td className="px-3 py-1.5 font-medium">{r.DCFS_NUMERO_NOTA}</td>
                              <td className="px-3 py-1.5">{r.DCFS_MODELO_NOTA}</td>
                              <td className="px-3 py-1.5">{r.DCFS_DATA_SAIDA}</td>
                              <td className="px-3 py-1.5">{r.DCFS_NOME}</td>
                              <td className="px-3 py-1.5">{r.PDDS_NUMERO || ""}</td>
                              <td className="px-3 py-1.5">{r.VDDR_NOME || ""}</td>
                              <td className="px-3 py-1.5 text-right font-medium">{fmtNum(parseNum(r.DCFS_VLR_TOTAL))}</td>
                              <td className="px-3 py-1.5 text-right">{fmtNum(parseNum(r.ITFT_VLR_TRIBUTOS))}</td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })
                )}
                {data.length > 0 && (
                  <tr className="bg-muted/60 border-t-2 border-border font-semibold">
                    <td colSpan={8} className="px-3 py-2 text-right">Total Geral</td>
                    <td className="px-3 py-2 text-right">{fmtNum(totalVlr)}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(totalTributos)}</td>
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
