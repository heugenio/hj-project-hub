import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Receipt, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getPedidos, setFaturarPedido, type Pedido } from "@/lib/api";
import { toast } from "sonner";

export default function Faturamento() {
  const { auth } = useAuth();
  const [data, setData] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [faturando, setFaturando] = useState(false);
  const [payloads, setPayloads] = useState<{ id: string; numero?: string; ok: boolean; raw: string; error?: string }[]>([]);

  const today = new Date();
  const sevenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  const [dtInicial, setDtInicial] = useState(toISO(sevenDaysAgo));
  const [dtFinal, setDtFinal] = useState(toISO(today));

  const formatCurrency = (value?: number) =>
    (Number(value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (s?: string) => {
    if (!s) return "";
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString("pt-BR");
  };

  const handleSearch = async () => {
    if (!auth?.unidade?.unem_Id) {
      toast.error("Selecione uma unidade empresarial.");
      return;
    }
    setLoading(true);
    setSelected(new Set());
    try {
      const result = await getPedidos(auth.unidade.unem_Id, {
        status: "Abertos",
        dtInicial,
        dtFinal,
      });
      const list = Array.isArray(result) ? result : [];
      setData(list);
      setSearched(true);
      if (list.length === 0) toast.info("Nenhum pedido em aberto encontrado.");
    } catch (e: any) {
      toast.error("Erro ao buscar pedidos: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auth?.unidade?.unem_Id) handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.unidade?.unem_Id]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === data.length) setSelected(new Set());
    else setSelected(new Set(data.map((p) => p.PDDS_ID)));
  };

  const totalSelecionado = data
    .filter((p) => selected.has(p.PDDS_ID))
    .reduce((s, p) => s + (Number(p.PDDS_VLR_TOTAL) || 0), 0);

  const handleFaturar = async () => {
    if (selected.size === 0) {
      toast.error("Selecione ao menos um pedido para faturar.");
      return;
    }
    if (!confirm(`Confirma o faturamento de ${selected.size} pedido(s)?`)) return;

    setFaturando(true);
    let okCount = 0;
    let failCount = 0;
    const failedIds: string[] = [];

    for (const id of Array.from(selected)) {
      try {
        const res = await setFaturarPedido(id);
        if (res.ok) okCount++;
        else { failCount++; failedIds.push(id); }
      } catch {
        failCount++;
        failedIds.push(id);
      }
    }

    setFaturando(false);
    if (okCount > 0) toast.success(`${okCount} pedido(s) faturado(s) com sucesso.`);
    if (failCount > 0) toast.error(`${failCount} pedido(s) com falha: ${failedIds.join(", ")}`);
    setSelected(new Set());
    handleSearch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Faturamento
          </h1>
          <p className="text-sm text-muted-foreground">
            Pedidos em aberto disponíveis para faturamento
          </p>
        </div>
        <Button onClick={handleFaturar} disabled={faturando || selected.size === 0}>
          {faturando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
          Faturar selecionados ({selected.size})
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs">Data Inicial</Label>
              <Input type="date" value={dtInicial} onChange={(e) => setDtInicial(e.target.value)} className="h-8" />
            </div>
            <div>
              <Label className="text-xs">Data Final</Label>
              <Input type="date" value={dtFinal} onChange={(e) => setDtFinal(e.target.value)} className="h-8" />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Input value="Abertos" disabled className="h-8" />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={data.length > 0 && selected.size === data.length}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                <TableHead>Nº</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!searched && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Use os filtros acima para buscar pedidos.
                  </TableCell>
                </TableRow>
              )}
              {searched && data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Nenhum pedido em aberto.
                  </TableCell>
                </TableRow>
              )}
              {data.map((p) => (
                <TableRow key={p.PDDS_ID} data-state={selected.has(p.PDDS_ID) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(p.PDDS_ID)}
                      onCheckedChange={() => toggle(p.PDDS_ID)}
                      aria-label={`Selecionar pedido ${p.PDDS_NUMERO}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono">{p.PDDS_NUMERO}</TableCell>
                  <TableCell>{formatDate(p.PDDS_DATA)}</TableCell>
                  <TableCell>{p.PESS_NOME || p.PESS_RAZAO_SOCIAL || "-"}</TableCell>
                  <TableCell>{p.USRS_NOME_LOGIN || "-"}</TableCell>
                  <TableCell>
                    <Badge className="bg-primary text-primary-foreground">{p.PDDS_STATUS || "Aberto"}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(p.PDDS_VLR_TOTAL)}</TableCell>
                </TableRow>
              ))}
              {data.length > 0 && (
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={6} className="text-right font-semibold">
                    Total selecionado:
                  </TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totalSelecionado)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
