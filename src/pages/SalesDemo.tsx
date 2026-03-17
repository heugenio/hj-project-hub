import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getDemonstrativoVendas, type SalesDemo as SalesDemoType } from "@/lib/api";
import { toast } from "sonner";

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

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

export default function SalesDemo() {
  const { auth } = useAuth();
  const [dtInicial, setDtInicial] = useState(firstOfMonth());
  const [dtFinal, setDtFinal] = useState(todayStr());
  const [data, setData] = useState<SalesDemoType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

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
      if (result.length === 0) toast.info("Nenhum registro encontrado.");
    } catch (e: any) {
      toast.error("Erro ao buscar dados: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const totals = {
    qtd: data.reduce((s, r) => s + parseNum(r.DCFS_QTD), 0),
    qtdFat: data.reduce((s, r) => s + parseNum(r.ITFT_QTDE_FATURADA), 0),
    vlrContabil: data.reduce((s, r) => s + parseNum(r.ITFT_VLR_CONTABIL), 0),
    custo: data.reduce((s, r) => s + parseNum(r.ITFT_CUSTO_NA_OPERACAO), 0),
    vlrDev: data.reduce((s, r) => s + parseNum(r.VLR_DEV), 0),
    qtdDev: data.reduce((s, r) => s + parseNum(r.QTDE_DEV), 0),
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
          </div>
        </CardContent>
      </Card>

      {searched && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Resultado</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-right">Qtd NF</TableHead>
                  <TableHead className="text-right">Qtd Faturada</TableHead>
                  <TableHead className="text-right">Vlr Contábil</TableHead>
                  <TableHead className="text-right">Custo Operação</TableHead>
                  <TableHead className="text-right">Vlr Devolução</TableHead>
                  <TableHead className="text-right">Qtd Devolução</TableHead>
                  <TableHead className="text-right">Participação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum dado encontrado</TableCell>
                  </TableRow>
                ) : (
                  <>
                    {data.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.GRUPO}</TableCell>
                        <TableCell className="text-right">{r.DCFS_QTD}</TableCell>
                        <TableCell className="text-right">{r.ITFT_QTDE_FATURADA}</TableCell>
                        <TableCell className="text-right">{fmtBRL(parseNum(r.ITFT_VLR_CONTABIL))}</TableCell>
                        <TableCell className="text-right">{fmtBRL(parseNum(r.ITFT_CUSTO_NA_OPERACAO))}</TableCell>
                        <TableCell className="text-right">{fmtBRL(parseNum(r.VLR_DEV))}</TableCell>
                        <TableCell className="text-right">{r.QTDE_DEV}</TableCell>
                        <TableCell className="text-right">{r.ITFT_PARTICIPACAO}%</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right">{totals.qtd}</TableCell>
                      <TableCell className="text-right">{totals.qtdFat}</TableCell>
                      <TableCell className="text-right">{fmtBRL(totals.vlrContabil)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(totals.custo)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(totals.vlrDev)}</TableCell>
                      <TableCell className="text-right">{totals.qtdDev}</TableCell>
                      <TableCell className="text-right">-</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
