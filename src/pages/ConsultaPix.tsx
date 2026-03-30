import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCofres, type Cofre } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Search, RefreshCw, Eye, Download, ChevronDown, ArrowUpRight, ArrowDownLeft,
  DollarSign, TrendingUp, TrendingDown, Activity, AlertTriangle, FileSpreadsheet, FileText,
  Filter, X, CreditCard, Settings
} from "lucide-react";
import { format } from "date-fns";

// Types
interface PixTransaction {
  txId: string;
  endToEndId: string;
  valor: number;
  dataHora: string;
  tipo: "entrada" | "saida";
  status: "confirmado" | "pendente" | "cancelado";
  pagadorNome: string;
  pagadorDocumento: string;
  recebedorNome: string;
  recebedorDocumento: string;
  chavePix: string;
  instituicao: string;
  rawJson?: Record<string, unknown>;
}

interface BankConfig {
  id: string;
  nome: string;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  token: string;
}

// Mock data for demonstration
const mockTransactions: PixTransaction[] = [
  {
    txId: "E00000000202301011234ABC00001",
    endToEndId: "E00000000202301011234s0000000001",
    valor: 1500.00,
    dataHora: "2025-03-30T10:30:00",
    tipo: "entrada",
    status: "confirmado",
    pagadorNome: "JOAO DA SILVA",
    pagadorDocumento: "***123456**",
    recebedorNome: "EMPRESA LTDA",
    recebedorDocumento: "12.345.678/0001-90",
    chavePix: "empresa@email.com",
    instituicao: "Banco do Brasil",
    rawJson: { txid: "E00000000202301011234ABC00001", valor: { original: "1500.00" }, status: "CONCLUIDA" },
  },
  {
    txId: "E00000000202301021234ABC00002",
    endToEndId: "E00000000202301021234s0000000002",
    valor: 350.50,
    dataHora: "2025-03-29T14:15:00",
    tipo: "saida",
    status: "confirmado",
    pagadorNome: "EMPRESA LTDA",
    pagadorDocumento: "12.345.678/0001-90",
    recebedorNome: "MARIA OLIVEIRA",
    recebedorDocumento: "***987654**",
    chavePix: "11999887766",
    instituicao: "Itaú",
  },
  {
    txId: "E00000000202301031234ABC00003",
    endToEndId: "E00000000202301031234s0000000003",
    valor: 2800.00,
    dataHora: "2025-03-28T09:00:00",
    tipo: "entrada",
    status: "pendente",
    pagadorNome: "CARLOS SOUZA",
    pagadorDocumento: "***456789**",
    recebedorNome: "EMPRESA LTDA",
    recebedorDocumento: "12.345.678/0001-90",
    chavePix: "12345678000190",
    instituicao: "Bradesco",
  },
  {
    txId: "E00000000202301041234ABC00004",
    endToEndId: "E00000000202301041234s0000000004",
    valor: 120.00,
    dataHora: "2025-03-27T16:45:00",
    tipo: "saida",
    status: "cancelado",
    pagadorNome: "EMPRESA LTDA",
    pagadorDocumento: "12.345.678/0001-90",
    recebedorNome: "ANA PEREIRA",
    recebedorDocumento: "***321654**",
    chavePix: "ana@email.com",
    instituicao: "Santander",
  },
  {
    txId: "E00000000202301051234ABC00005",
    endToEndId: "E00000000202301051234s0000000005",
    valor: 5000.00,
    dataHora: "2025-03-26T11:20:00",
    tipo: "entrada",
    status: "confirmado",
    pagadorNome: "PEDRO SANTOS",
    pagadorDocumento: "***654321**",
    recebedorNome: "EMPRESA LTDA",
    recebedorDocumento: "12.345.678/0001-90",
    chavePix: "chave-aleatoria-uuid",
    instituicao: "Banco do Brasil",
  },
];

const statusConfig = {
  confirmado: { label: "Confirmado", variant: "default" as const, className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/25" },
  pendente: { label: "Pendente", variant: "secondary" as const, className: "bg-amber-500/15 text-amber-700 border-amber-500/30 hover:bg-amber-500/25" },
  cancelado: { label: "Cancelado", variant: "destructive" as const, className: "bg-red-500/15 text-red-700 border-red-500/30 hover:bg-red-500/25" },
};

export default function ConsultaPix() {
  const { toast } = useToast();

  // Filters
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroChave, setFiltroChave] = useState("");
  const [filtroValorMin, setFiltroValorMin] = useState("");
  const [filtroValorMax, setFiltroValorMax] = useState("");
  const [filtroTxId, setFiltroTxId] = useState("");
  const [filtroBanco, setFiltroBanco] = useState("todos");
  const [buscaRapida, setBuscaRapida] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  // State
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<PixTransaction[]>(mockTransactions);
  const [selectedTx, setSelectedTx] = useState<PixTransaction | null>(null);
  const [showJsonRaw, setShowJsonRaw] = useState(false);
  const [showBankConfig, setShowBankConfig] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Bank configs
  const [bankConfigs, setBankConfigs] = useState<BankConfig[]>([
    { id: "1", nome: "Banco do Brasil", baseUrl: "", clientId: "", clientSecret: "", token: "" },
    { id: "2", nome: "Itaú", baseUrl: "", clientId: "", clientSecret: "", token: "" },
    { id: "3", nome: "Bradesco", baseUrl: "", clientId: "", clientSecret: "", token: "" },
    { id: "4", nome: "Santander", baseUrl: "", clientId: "", clientSecret: "", token: "" },
  ]);

  // Filtered data
  const filtered = useMemo(() => {
    let result = [...transactions];

    if (filtroTipo !== "todos") result = result.filter(t => t.tipo === filtroTipo);
    if (filtroStatus !== "todos") result = result.filter(t => t.status === filtroStatus);
    if (filtroChave) result = result.filter(t => t.chavePix.toLowerCase().includes(filtroChave.toLowerCase()));
    if (filtroTxId) result = result.filter(t => t.txId.toLowerCase().includes(filtroTxId.toLowerCase()));
    if (filtroBanco !== "todos") result = result.filter(t => t.instituicao === filtroBanco);
    if (filtroValorMin) result = result.filter(t => t.valor >= Number(filtroValorMin));
    if (filtroValorMax) result = result.filter(t => t.valor <= Number(filtroValorMax));
    if (dataInicial) result = result.filter(t => t.dataHora >= dataInicial);
    if (dataFinal) result = result.filter(t => t.dataHora <= dataFinal + "T23:59:59");

    if (buscaRapida) {
      const q = buscaRapida.toLowerCase();
      result = result.filter(t =>
        t.txId.toLowerCase().includes(q) ||
        t.pagadorNome.toLowerCase().includes(q) ||
        t.recebedorNome.toLowerCase().includes(q) ||
        t.chavePix.toLowerCase().includes(q) ||
        t.valor.toString().includes(q)
      );
    }

    return result;
  }, [transactions, filtroTipo, filtroStatus, filtroChave, filtroTxId, filtroBanco, filtroValorMin, filtroValorMax, dataInicial, dataFinal, buscaRapida]);

  const paginatedData = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  // Summary
  const summary = useMemo(() => {
    const totalRecebido = filtered.filter(t => t.tipo === "entrada" && t.status === "confirmado").reduce((s, t) => s + t.valor, 0);
    const totalEnviado = filtered.filter(t => t.tipo === "saida" && t.status === "confirmado").reduce((s, t) => s + t.valor, 0);
    const totalTx = filtered.length;
    const pendentes = filtered.filter(t => t.status === "pendente").length;
    return { totalRecebido, totalEnviado, totalTx, pendentes };
  }, [filtered]);

  const handleConsultar = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({ title: "Consulta realizada", description: `${transactions.length} transações encontradas.` });
    }, 1500);
  };

  const handleUpdateStatus = (tx: PixTransaction) => {
    toast({ title: "Status atualizado", description: `Transação ${tx.txId.slice(-8)} atualizada.` });
  };

  const clearFilters = () => {
    setDataInicial("");
    setDataFinal("");
    setFiltroTipo("todos");
    setFiltroStatus("todos");
    setFiltroChave("");
    setFiltroValorMin("");
    setFiltroValorMax("");
    setFiltroTxId("");
    setFiltroBanco("todos");
    setBuscaRapida("");
  };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const exportCSV = () => {
    const header = "TxId;Data;Valor;Tipo;Status;Pagador;Recebedor;Chave PIX;Banco\n";
    const rows = filtered.map(t =>
      `${t.txId};${t.dataHora};${t.valor};${t.tipo};${t.status};${t.pagadorNome};${t.recebedorNome};${t.chavePix};${t.instituicao}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pix_consulta_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exportação concluída", description: "Arquivo CSV gerado." });
  };

  return (
    <div className="space-y-4 p-2 md:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Consulta PIX</h1>
            <p className="text-sm text-muted-foreground">Gerencie e consulte transações PIX em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBankConfig(true)}>
            <Settings className="h-4 w-4 mr-1" /> Bancos
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-1" /> Filtros
          </Button>
        </div>
      </div>

      {/* Dashboard Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Recebido</p>
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(summary.totalRecebido)}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/15"><TrendingUp className="h-4 w-4 text-emerald-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Enviado</p>
                <p className="text-lg font-bold text-red-700">{formatCurrency(summary.totalEnviado)}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-500/15"><TrendingDown className="h-4 w-4 text-red-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Transações</p>
                <p className="text-lg font-bold text-foreground">{summary.totalTx}</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10"><Activity className="h-4 w-4 text-primary" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className={summary.pendentes > 0 ? "border-amber-500/20 bg-amber-500/5" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Pendentes</p>
                <p className="text-lg font-bold text-amber-700">{summary.pendentes}</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/15"><AlertTriangle className="h-4 w-4 text-amber-600" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Data Inicial</Label>
                <Input type="date" value={dataInicial} onChange={e => setDataInicial(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Data Final</Label>
                <Input type="date" value={dataFinal} onChange={e => setDataFinal(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="entrada">Recebido</SelectItem>
                    <SelectItem value="saida">Enviado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="confirmado">Confirmado</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Chave PIX</Label>
                <Input placeholder="CPF, CNPJ, e-mail, telefone..." value={filtroChave} onChange={e => setFiltroChave(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Valor Mínimo</Label>
                <Input type="number" placeholder="0,00" value={filtroValorMin} onChange={e => setFiltroValorMin(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Valor Máximo</Label>
                <Input type="number" placeholder="0,00" value={filtroValorMax} onChange={e => setFiltroValorMax(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">TxId</Label>
                <Input placeholder="ID da transação" value={filtroTxId} onChange={e => setFiltroTxId(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Banco</Label>
                <Select value={filtroBanco} onValueChange={setFiltroBanco}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="Banco do Brasil">Banco do Brasil</SelectItem>
                    <SelectItem value="Itaú">Itaú</SelectItem>
                    <SelectItem value="Bradesco">Bradesco</SelectItem>
                    <SelectItem value="Santander">Santander</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Button onClick={handleConsultar} disabled={loading}>
                {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                Consultar
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" /> Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick search + results */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <CardTitle className="text-base">Transações ({filtered.length})</CardTitle>
            <Input
              placeholder="Busca rápida..."
              value={buscaRapida}
              onChange={e => setBuscaRapida(e.target.value)}
              className="w-full sm:w-64"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">Nenhuma transação encontrada</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Ajuste os filtros ou realize uma nova consulta</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs font-semibold">Data/Hora</TableHead>
                      <TableHead className="text-xs font-semibold">Valor</TableHead>
                      <TableHead className="text-xs font-semibold">Tipo</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                      <TableHead className="text-xs font-semibold hidden md:table-cell">Pagador/Recebedor</TableHead>
                      <TableHead className="text-xs font-semibold hidden lg:table-cell">Chave PIX</TableHead>
                      <TableHead className="text-xs font-semibold hidden lg:table-cell">TxId</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((tx) => (
                      <TableRow key={tx.txId} className="group cursor-pointer hover:bg-muted/30" onClick={() => setSelectedTx(tx)}>
                        <TableCell className="text-xs py-3">
                          {format(new Date(tx.dataHora), "dd/MM/yyyy")}
                          <br />
                          <span className="text-muted-foreground">{format(new Date(tx.dataHora), "HH:mm")}</span>
                        </TableCell>
                        <TableCell className={`text-sm font-semibold py-3 ${tx.tipo === "entrada" ? "text-emerald-600" : "text-red-600"}`}>
                          {tx.tipo === "entrada" ? "+" : "-"}{formatCurrency(tx.valor)}
                        </TableCell>
                        <TableCell className="py-3">
                          {tx.tipo === "entrada" ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><ArrowDownLeft className="h-3 w-3" /> Entrada</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600"><ArrowUpRight className="h-3 w-3" /> Saída</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge className={statusConfig[tx.status].className}>{statusConfig[tx.status].label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs py-3 hidden md:table-cell">
                          <span className="font-medium">{tx.tipo === "entrada" ? tx.pagadorNome : tx.recebedorNome}</span>
                        </TableCell>
                        <TableCell className="text-xs py-3 hidden lg:table-cell font-mono text-muted-foreground truncate max-w-[150px]">{tx.chavePix}</TableCell>
                        <TableCell className="text-xs py-3 hidden lg:table-cell font-mono text-muted-foreground truncate max-w-[120px]">...{tx.txId.slice(-8)}</TableCell>
                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedTx(tx)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUpdateStatus(tx)}>
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-xs text-muted-foreground">Página {currentPage} de {totalPages}</p>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedTx} onOpenChange={() => { setSelectedTx(null); setShowJsonRaw(false); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Detalhes da Transação
            </DialogTitle>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className={`text-xl font-bold ${selectedTx.tipo === "entrada" ? "text-emerald-600" : "text-red-600"}`}>
                    {selectedTx.tipo === "entrada" ? "+" : "-"}{formatCurrency(selectedTx.valor)}
                  </p>
                </div>
                <Badge className={statusConfig[selectedTx.status].className}>{statusConfig[selectedTx.status].label}</Badge>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">TxId</p><p className="font-mono text-xs break-all">{selectedTx.txId}</p></div>
                <div><p className="text-xs text-muted-foreground">EndToEndId</p><p className="font-mono text-xs break-all">{selectedTx.endToEndId}</p></div>
                <div><p className="text-xs text-muted-foreground">Data/Hora</p><p>{format(new Date(selectedTx.dataHora), "dd/MM/yyyy HH:mm:ss")}</p></div>
                <div><p className="text-xs text-muted-foreground">Instituição</p><p>{selectedTx.instituicao}</p></div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">PAGADOR</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-xs text-muted-foreground">Nome</p><p>{selectedTx.pagadorNome}</p></div>
                  <div><p className="text-xs text-muted-foreground">Documento</p><p>{selectedTx.pagadorDocumento}</p></div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">RECEBEDOR</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-xs text-muted-foreground">Nome</p><p>{selectedTx.recebedorNome}</p></div>
                  <div><p className="text-xs text-muted-foreground">Documento</p><p>{selectedTx.recebedorDocumento}</p></div>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Chave PIX</p>
                <p className="font-mono text-sm">{selectedTx.chavePix}</p>
              </div>

              {selectedTx.rawJson && (
                <Collapsible open={showJsonRaw} onOpenChange={setShowJsonRaw}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${showJsonRaw ? "rotate-180" : ""}`} />
                      JSON da API
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="mt-2 p-3 rounded-lg bg-muted text-xs font-mono overflow-x-auto max-h-48">
                      {JSON.stringify(selectedTx.rawJson, null, 2)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              )}

              <Button className="w-full" onClick={() => handleUpdateStatus(selectedTx)}>
                <RefreshCw className="h-4 w-4 mr-1" /> Atualizar Status
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bank Config Dialog */}
      <Dialog open={showBankConfig} onOpenChange={setShowBankConfig}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configuração de Bancos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {bankConfigs.map((bank, idx) => (
              <Card key={bank.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{bank.nome}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Base URL</Label>
                      <Input
                        placeholder="https://api.banco.com.br/pix/v2"
                        value={bank.baseUrl}
                        onChange={e => {
                          const updated = [...bankConfigs];
                          updated[idx].baseUrl = e.target.value;
                          setBankConfigs(updated);
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Client ID</Label>
                      <Input
                        placeholder="Client ID"
                        value={bank.clientId}
                        onChange={e => {
                          const updated = [...bankConfigs];
                          updated[idx].clientId = e.target.value;
                          setBankConfigs(updated);
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Client Secret</Label>
                      <Input
                        type="password"
                        placeholder="Client Secret"
                        value={bank.clientSecret}
                        onChange={e => {
                          const updated = [...bankConfigs];
                          updated[idx].clientSecret = e.target.value;
                          setBankConfigs(updated);
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Token (Bearer)</Label>
                      <Input
                        type="password"
                        placeholder="Token"
                        value={bank.token}
                        onChange={e => {
                          const updated = [...bankConfigs];
                          updated[idx].token = e.target.value;
                          setBankConfigs(updated);
                        }}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button className="w-full" onClick={() => { setShowBankConfig(false); toast({ title: "Configuração salva" }); }}>
              Salvar Configuração
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

