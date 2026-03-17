import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, FileDown } from "lucide-react";
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

export default function MovementSummary() {
  const { auth } = useAuth();
  const [dtInicial, setDtInicial] = useState(firstOfMonth());
  const [dtFinal, setDtFinal] = useState(todayStr());
  const [tipoOperacao, setTipoOperacao] = useState("");
  const [data, setData] = useState<MovementSummaryType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

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
      if (result.length === 0) toast.info("Nenhum registro encontrado.");
    } catch (e: any) {
      toast.error("Erro ao buscar dados: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const totalVlr = data.reduce((s, r) => s + parseNum(r.DCFS_VLR_TOTAL), 0);

  const handleExportPDF = () => {
    if (data.length === 0) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.setFontSize(14);
    doc.text("Resumo de Movimentação", 14, 15);
    doc.setFontSize(9);
    doc.text(`Período: ${dtInicial} a ${dtFinal}`, 14, 21);

    const tipoLabel = tipoOperacao === "E" ? "Entrada" : tipoOperacao === "S" ? "Saída" : "Todas";
    doc.text(`Tipo Operação: ${tipoLabel}`, 14, 26);

    const head = [["Nota", "Modelo", "Data Saída", "Cliente", "Operação", "Valor Total"]];
    const body = data.map((r) => [
      r.DCFS_NUMERO_NOTA || "",
      r.DCFS_MODELO_NOTA || "",
      r.DCFS_DATA_SAIDA || "",
      r.OPCM_NOME_CLIENTE || "",
      r.DCFS_NOME || "",
      fmtNum(parseNum(r.DCFS_VLR_TOTAL)),
    ]);

    body.push(["", "", "", "", "Total", fmtNum(totalVlr)]);

    autoTable(doc, {
      startY: 30,
      head,
      body,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [55, 55, 55], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        5: { halign: "right" },
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
              <span className="text-sm font-semibold text-primary">Total: {fmtNum(totalVlr)}</span>
            )}
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Nota</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Modelo</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Data Saída</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Cliente</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Operação</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Valor Total</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground py-6">Nenhum dado encontrado</td>
                  </tr>
                ) : (
                  data.map((r, i) => (
                    <tr
                      key={i}
                      className={`border-b border-border/40 ${i % 2 === 0 ? "bg-background" : "bg-muted/30"} hover:bg-accent/40 transition-colors`}
                    >
                      <td className="px-3 py-1.5 font-medium">{r.DCFS_NUMERO_NOTA}</td>
                      <td className="px-3 py-1.5">{r.DCFS_MODELO_NOTA}</td>
                      <td className="px-3 py-1.5">{r.DCFS_DATA_SAIDA}</td>
                      <td className="px-3 py-1.5">{r.OPCM_NOME_CLIENTE}</td>
                      <td className="px-3 py-1.5">{r.DCFS_NOME}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{fmtNum(parseNum(r.DCFS_VLR_TOTAL))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
