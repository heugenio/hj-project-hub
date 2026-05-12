import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, ShoppingCart, Plus, Eye } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getPedidos, type Pedido } from "@/lib/api";
import { toast } from "sonner";
import PedidoForm from "@/components/pedidos/PedidoForm";

const statusColor: Record<string, string> = {
  Aberto: "bg-primary text-primary-foreground",
  Faturado: "bg-accent text-accent-foreground",
  Cancelado: "bg-destructive text-destructive-foreground",
};

export default function Pedidos() {
  const { auth } = useAuth();
  const [data, setData] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [viewMode, setViewMode] = useState(false);

  const today = new Date();
  const sevenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  const [dtInicial, setDtInicial] = useState(toISO(sevenDaysAgo));
  const [dtFinal, setDtFinal] = useState(toISO(today));
  const [status, setStatus] = useState<string>("Abertos");

  const handleSearch = async () => {
    if (!auth?.unidade?.unem_Id) {
      toast.error("Selecione uma unidade empresarial.");
      return;
    }
    setLoading(true);
    try {
      const result = await getPedidos(auth.unidade.unem_Id, {
        status,
        dtInicial,
        dtFinal,
      });
      setData(Array.isArray(result) ? result : []);
      setSearched(true);
      if (!result || result.length === 0) toast.info("Nenhum pedido encontrado.");
    } catch (e: any) {
      toast.error("Erro ao buscar pedidos: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value?: number) =>
    (Number(value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatCpfCnpj = (value?: string) => {
    if (!value) return "";
    const d = value.replace(/\D/g, "");
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    return value;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    // já vem em dd/MM/yyyy do legado; se vier ISO, converte
    if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) return dateStr.slice(0, 10);
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("pt-BR");
  };

  if (showForm) {
    return (
      <PedidoForm
        editingPedido={editingPedido}
        viewMode={viewMode}
        onBack={() => {
          setShowForm(false);
          setEditingPedido(null);
          setViewMode(false);
          handleSearch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" /> Pedidos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gerenciamento de pedidos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { setEditingPedido(null); setViewMode(false); setShowForm(true); }} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo Pedido
          </Button>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Data Inicial</Label>
              <Input
                type="date"
                value={dtInicial}
                onChange={(e) => setDtInicial(e.target.value)}
                className="h-8 text-xs w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Data Final</Label>
              <Input
                type="date"
                value={dtFinal}
                onChange={(e) => setDtFinal(e.target.value)}
                className="h-8 text-xs w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  <SelectItem value="Abertos">Abertos</SelectItem>
                  <SelectItem value="Faturados">Faturados</SelectItem>
                  <SelectItem value="Cancelados">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSearch} disabled={loading} size="sm" className="h-8">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
              Consultar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="text-[11px]">
            <TableHeader>
              <TableRow className="[&>th]:h-7 [&>th]:px-2 [&>th]:py-1">
                <TableHead className="text-[10px] uppercase">Nº Pedido</TableHead>
                <TableHead className="text-[10px] uppercase">Data</TableHead>
                <TableHead className="text-[10px] uppercase">Cliente</TableHead>
                <TableHead className="text-[10px] uppercase">CPF/CNPJ</TableHead>
                <TableHead className="text-[10px] uppercase">Veículo</TableHead>
                <TableHead className="text-[10px] uppercase">Placa</TableHead>
                <TableHead className="text-[10px] uppercase text-right">Vlr Total</TableHead>
                <TableHead className="text-[10px] uppercase">Status</TableHead>
                <TableHead className="text-[10px] uppercase text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground text-sm py-8">
                    {searched ? "Nenhum pedido encontrado." : "Clique em Consultar para buscar os pedidos."}
                  </TableCell>
                </TableRow>
              )}
              {data.map((p, idx) => {
                const rowStatus = String(p.PDDS_STATUS ?? "");
                const cliente = p.PESS_NOME || p.PESS_RAZAO_SOCIAL || "";
                return (
                  <TableRow
                    key={p.PDDS_ID + idx}
                    className={`[&>td]:px-2 [&>td]:py-1 ${idx % 2 === 0 ? "" : "bg-muted/40"}`}
                  >
                    <TableCell className="font-mono text-[10px] font-medium whitespace-nowrap">{p.PDDS_NUMERO}</TableCell>
                    <TableCell className="text-[10px] whitespace-nowrap">{formatDate(p.PDDS_DATA)}</TableCell>
                    <TableCell className="text-[10px] max-w-[180px] truncate" title={cliente}>{cliente}</TableCell>
                    <TableCell className="text-[10px] font-mono whitespace-nowrap">{formatCpfCnpj(p.PESS_CPFCNPJ || p.PDDS_CPFCNPJ)}</TableCell>
                    <TableCell className="text-[10px] max-w-[120px] truncate" title={`${p.VEIC_MARCA ?? ""} ${p.VEIC_MODELO ?? ""}`}>{p.VEIC_MARCA} {p.VEIC_MODELO}</TableCell>
                    <TableCell className="text-[10px] font-mono whitespace-nowrap">{p.VEIC_PLACA}</TableCell>
                    <TableCell className="text-[10px] text-right whitespace-nowrap">{formatCurrency(p.PDDS_VLR_TOTAL)}</TableCell>
                    <TableCell>
                      <Badge className={(statusColor[rowStatus] || "bg-muted text-muted-foreground") + " text-[9px] px-1.5 py-0 whitespace-nowrap"}>
                        {rowStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => {
                            const isAberto = rowStatus.trim().toLowerCase() === 'aberto';
                            setEditingPedido(p);
                            setViewMode(!isAberto);
                            setShowForm(true);
                          }}
                          title={rowStatus.trim().toLowerCase() === 'aberto' ? 'Editar Pedido' : 'Visualizar Pedido'}
                          aria-label={rowStatus.trim().toLowerCase() === 'aberto' ? 'Editar Pedido' : 'Visualizar Pedido'}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
