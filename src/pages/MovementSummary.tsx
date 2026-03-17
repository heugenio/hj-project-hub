import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getResumoMovimento, type MovementSummary as MovementSummaryType } from "@/lib/api";
import { toast } from "sonner";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Resumo de Movimentação</h1>
        <p className="text-muted-foreground text-sm mt-1">Consulta de notas por período e tipo de operação</p>
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
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo Operação</label>
              <Select value={tipoOperacao} onValueChange={setTipoOperacao}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="V">Venda</SelectItem>
                  <SelectItem value="D">Devolução</SelectItem>
                  <SelectItem value="T">Transferência</SelectItem>
                  <SelectItem value="R">Remessa</SelectItem>
                </SelectContent>
              </Select>
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Resultado ({data.length} registros)</CardTitle>
            {data.length > 0 && (
              <span className="text-sm font-semibold text-primary">Total: {fmtBRL(totalVlr)}</span>
            )}
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nota</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Data Saída</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum dado encontrado</TableCell>
                  </TableRow>
                ) : (
                  data.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.DCFS_NUMERO_NOTA}</TableCell>
                      <TableCell>{r.DCFS_MODELO_NOTA}</TableCell>
                      <TableCell>{r.DCFS_DATA_SAIDA}</TableCell>
                      <TableCell>{r.OPCM_NOME_CLIENTE}</TableCell>
                      <TableCell>{r.DCFS_NOME}</TableCell>
                      <TableCell className="text-right">{fmtBRL(parseNum(r.DCFS_VLR_TOTAL))}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
