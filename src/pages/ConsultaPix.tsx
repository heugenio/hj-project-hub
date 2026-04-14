import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCofres, getGerarToken, getConsultaPixRecebidos, type Cofre } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
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
  apiKey: string;
  clientId: string;
  clientSecret: string;
  chavePix: string;
  urlApi: string;
  urlToken: string;
  ambientePix: string;
  tipoChave: string;
}

function mapPixStatus(status: string): 'confirmado' | 'pendente' | 'cancelado' {
  if (!status) return 'confirmado';
  const s = status.toUpperCase();
  if (s === 'CONCLUIDA' || s === 'ATIVA' || s === 'CONCLUIDO') return 'confirmado';
  if (s.includes('REMOVIDA') || s === 'CANCELADA') return 'cancelado';
  return 'pendente';
}

function getDefaultUrlApi(nome: string): string {
  const n = nome.toUpperCase();
  if (n.includes('ITAU') || n.includes('ITAÚ')) return 'https://secure.api.itau/pix_recebimentos/v2/pix';
  if (n.includes('BRASIL') || n.includes(' BB')) return 'https://api.bb.com.br/pix/v1/pix';
  return '';
}

function getDefaultUrlToken(nome: string): string {
  const n = nome.toUpperCase();
  if (n.includes('ITAU') || n.includes('ITAÚ')) return 'https://sts.itau.com.br/api/cfauth/oauth/token';
  if (n.includes('BRASIL') || n.includes(' BB')) return 'https://oauth.bb.com.br/oauth/token';
  return '';
}

function getTransactionTimestamp(dataHora: string): number {
  const timestamp = new Date(dataHora).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

// No more mock data - starts empty
const statusConfig = {
  confirmado: { label: "Confirmado", variant: "default" as const, className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/25" },
  pendente: { label: "Pendente", variant: "secondary" as const, className: "bg-amber-500/15 text-amber-700 border-amber-500/30 hover:bg-amber-500/25" },
  cancelado: { label: "Cancelado", variant: "destructive" as const, className: "bg-red-500/15 text-red-700 border-red-500/30 hover:bg-red-500/25" },
};

export default function ConsultaPix() {
  const { toast } = useToast();

  // Filters
  const today = new Date();
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);
  const [dataInicial, setDataInicial] = useState(format(twoDaysAgo, "yyyy-MM-dd"));
  const [dataFinal, setDataFinal] = useState(format(today, "yyyy-MM-dd"));
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroChave, setFiltroChave] = useState("");
  const [filtroBanco, setFiltroBanco] = useState("todos");
  const [buscaRapida, setBuscaRapida] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  // State
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<PixTransaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<PixTransaction | null>(null);
  const [showJsonRaw, setShowJsonRaw] = useState(false);
  const [showBankConfig, setShowBankConfig] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Bank configs
  const [bankConfigs, setBankConfigs] = useState<BankConfig[]>([]);
  const [loadingCofres, setLoadingCofres] = useState(false);

  // Load cofres from API
  useEffect(() => {
    const loadCofres = async () => {
      setLoadingCofres(true);
      try {
        const cofres = await getCofres();
        const configs: BankConfig[] = cofres
          .filter(c => c.COFR_CLIENT_SECRET && c.COFR_CLIENT_SECRET.trim() !== '')
          .map((c, idx) => ({
          id: String(idx + 1),
          nome: c.COFR_NOME || `Cofre ${idx + 1}`,
          apiKey: c.COFR_API_KEY || "",
          clientId: c.COFR_CLIENT_ID || "",
          clientSecret: c.COFR_CLIENT_SECRET || "",
          chavePix: c.COFR_CHAVE_PIX || "",
          urlApi: c.COFR_URL_API || getDefaultUrlApi(c.COFR_NOME || ""),
          urlToken: c.COFR_URL_TOKEN || getDefaultUrlToken(c.COFR_NOME || ""),
          ambientePix: c.COFR_AMBIENTE_PIX || "",
          tipoChave: c.COFR_TIPO_CHAVE || "",
        }));
        setBankConfigs(configs);
      } catch (err) {
        console.error("Erro ao carregar cofres:", err);
        toast({ title: "Erro", description: "Não foi possível carregar as configurações dos cofres.", variant: "destructive" });
      } finally {
        setLoadingCofres(false);
      }
    };
    loadCofres();
  }, []);

  // Filtered data
  const filtered = useMemo(() => {
    let result = [...transactions];

    if (filtroTipo !== "todos") result = result.filter(t => t.tipo === filtroTipo);
    if (filtroStatus !== "todos") result = result.filter(t => t.status === filtroStatus);
    if (filtroChave) result = result.filter(t => t.chavePix.toLowerCase().includes(filtroChave.toLowerCase()));
    if (filtroBanco !== "todos") result = result.filter(t => t.instituicao === filtroBanco);

    // Date filter - only apply if different from the query dates (API already filters by date)
    // Use lenient comparison to handle timezone offsets
    if (dataInicial) {
      const dtIni = new Date(dataInicial + "T00:00:00-03:00");
      result = result.filter(t => {
        const txDate = new Date(t.dataHora);
        return !isNaN(txDate.getTime()) && txDate >= dtIni;
      });
    }
    if (dataFinal) {
      const dtFim = new Date(dataFinal + "T23:59:59-03:00");
      result = result.filter(t => {
        const txDate = new Date(t.dataHora);
        return !isNaN(txDate.getTime()) && txDate <= dtFim;
      });
    }

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

    return result.sort((a, b) => getTransactionTimestamp(b.dataHora) - getTransactionTimestamp(a.dataHora));
  }, [transactions, filtroTipo, filtroStatus, filtroChave, filtroBanco, dataInicial, dataFinal, buscaRapida]);

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

  const handleConsultar = async () => {
    if (!dataInicial || !dataFinal) {
      toast({ title: "Atenção", description: "Informe a data inicial e final para consultar.", variant: "destructive" });
      return;
    }

    if (bankConfigs.length === 0) {
      toast({ title: "Atenção", description: "Nenhum cofre configurado. Verifique a configuração dos bancos.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const allTx: PixTransaction[] = [];
    const inicio = `${dataInicial}T00:00:00Z`;
    const fim = `${dataFinal}T23:59:59Z`;

    const configsToQuery = filtroBanco !== "todos"
      ? bankConfigs.filter(b => b.nome === filtroBanco || b.chavePix === filtroBanco)
      : bankConfigs;

    for (const bank of configsToQuery) {
      const isItau = bank.nome.toUpperCase().includes('ITAU') || bank.nome.toUpperCase().includes('ITAÚ') || bank.urlApi.toLowerCase().includes('itau');

      if (!bank.urlApi) {
        console.warn(`Cofre ${bank.nome} sem URL API, pulando...`);
        continue;
      }

      // For Itaú, route the entire query through the Java server (mTLS required)
      if (isItau) {
        let itauTransactions: PixTransaction[] = [];

        // Tentativa 1: Consultar via servidor Java (mTLS)
        try {
          console.log(`[PIX] Consultando Itaú via servidor Java para ${bank.nome}...`);
          const result = await getConsultaPixRecebidos(bank.nome, inicio, fim);
          console.log(`[PIX] Resposta Java para ${bank.nome}:`, result);

          const pixArray = (result as any)?.pix || (result as any)?.transactions || (result as any)?.cobs || [];
          itauTransactions = (Array.isArray(pixArray) ? pixArray : []).map((pix: any) => ({
            txId: pix.txid || pix.txId || pix.endToEndId || '',
            endToEndId: pix.endToEndId || '',
            valor: parseFloat(pix.valor || pix.valor?.original || '0'),
            dataHora: pix.horario || pix.criacao || pix.dataHoraPagamento || '',
            tipo: 'entrada' as const,
            status: mapPixStatus(pix.status),
            pagadorNome: pix.pagador?.nome || pix.pagador?.nomeCompleto || 'N/A',
            pagadorDocumento: pix.pagador?.cpf || pix.pagador?.cnpj || 'N/A',
            recebedorNome: pix.favorecido?.nome || pix.recebedor?.nome || 'N/A',
            recebedorDocumento: pix.favorecido?.cpf || pix.favorecido?.cnpj || pix.recebedor?.cpf || pix.recebedor?.cnpj || 'N/A',
            chavePix: pix.chave || '',
            instituicao: bank.nome,
            rawJson: pix,
          }));
        } catch (err: any) {
          console.warn(`[PIX] Servidor Java falhou para ${bank.nome}:`, err?.message);
        }

        // Tentativa 2: Fallback via Edge Function usando COFR_API_KEY como bearer token
        if (itauTransactions.length === 0 && bank.apiKey && bank.apiKey.length > 50) {
          try {
            console.log(`[PIX] Fallback: consultando Itaú via Edge Function com COFR_API_KEY para ${bank.nome}...`);
            const { data, error } = await supabase.functions.invoke('pix-consulta', {
              body: {
                urlApi: bank.urlApi || 'https://secure.api.itau/pix_recebimentos/v2/pix',
                inicio,
                fim,
                bearerToken: bank.apiKey,
                apiKey: '',
                clientId: '',
                clientSecret: '',
                urlToken: '',
              },
            });

            if (error) {
              console.error(`[PIX] Edge Function fallback erro ${bank.nome}:`, error);
              toast({ title: `Erro - ${bank.nome}`, description: error.message, variant: "destructive" });
            } else if (data?.transactions && data.transactions.length > 0) {
              itauTransactions = data.transactions.map((tx: PixTransaction) => ({
                ...tx,
                instituicao: bank.nome,
              }));
              console.log(`[PIX] Fallback: ${itauTransactions.length} transações encontradas para ${bank.nome}`);
            } else {
              console.warn(`[PIX] Fallback: nenhuma transação retornada para ${bank.nome}`);
              toast({ title: `${bank.nome}`, description: "Nenhuma transação encontrada no período.", variant: "default" });
            }
          } catch (err: any) {
            console.error(`[PIX] Fallback erro ${bank.nome}:`, err);
            toast({ title: `Erro - ${bank.nome}`, description: err?.message || "Erro ao consultar PIX", variant: "destructive" });
          }
        } else if (itauTransactions.length === 0) {
          toast({ title: `${bank.nome}`, description: "Nenhuma transação encontrada e COFR_API_KEY não disponível para fallback.", variant: "default" });
        }

        if (itauTransactions.length > 0) {
          allTx.push(...itauTransactions);
        }
        continue;
      }

      // For non-Itaú, require clientId/clientSecret
      if (!bank.clientId || !bank.clientSecret) {
        console.warn(`Cofre ${bank.nome} sem configuração completa, pulando...`);
        continue;
      }

      try {
        const requestBody: Record<string, string> = {
          urlToken: bank.urlToken,
          urlApi: bank.urlApi,
          clientId: bank.clientId,
          clientSecret: bank.clientSecret,
          apiKey: bank.apiKey,
          inicio,
          fim,
        };

        const { data, error } = await supabase.functions.invoke('pix-consulta', {
          body: requestBody,
        });

        if (error) {
          console.error(`Erro cofre ${bank.nome}:`, error);
          toast({ title: `Erro - ${bank.chavePix || bank.nome}`, description: error.message, variant: "destructive" });
          continue;
        }

        if (data?.transactions) {
          const txsWithBank = data.transactions.map((tx: PixTransaction) => ({
            ...tx,
            instituicao: bank.nome,
          }));
          allTx.push(...txsWithBank);
        }
      } catch (err: any) {
        console.error(`Erro cofre ${bank.nome}:`, err);
        toast({ title: `Erro - ${bank.chavePix || bank.nome}`, description: err.message || "Erro desconhecido", variant: "destructive" });
      }
    }

    setTransactions(allTx);
    setCurrentPage(1);
    setLoading(false);
    toast({ title: "Consulta realizada", description: `${allTx.length} transação(ões) encontrada(s) em ${configsToQuery.length} cofre(s).` });
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
    setFiltroBanco("todos");
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
          <CardContent className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <div>
                <Label className="text-xs">Data Inicial</Label>
                <Input type="date" value={dataInicial} onChange={e => setDataInicial(e.target.value)} className="mt-1 h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Data Final</Label>
                <Input type="date" value={dataFinal} onChange={e => setDataFinal(e.target.value)} className="mt-1 h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
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
                <Input placeholder="CPF, CNPJ, e-mail..." value={filtroChave} onChange={e => setFiltroChave(e.target.value)} className="mt-1 h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Cofre / Banco</Label>
                <Select value={filtroBanco} onValueChange={setFiltroBanco}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Cofres</SelectItem>
                    {bankConfigs.map(b => (
                      <SelectItem key={b.id} value={b.nome}>{b.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={handleConsultar} disabled={loading}>
                {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Search className="h-3.5 w-3.5 mr-1" />}
                Consultar
              </Button>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-3.5 w-3.5 mr-1" /> Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick search + results */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <CardTitle className="text-base">Transações ({filtered.length}{transactions.length !== filtered.length ? ` / ${transactions.length}` : ''})</CardTitle>
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
             {loadingCofres ? (
               <div className="space-y-3">
                 {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
               </div>
             ) : bankConfigs.length === 0 ? (
               <p className="text-sm text-muted-foreground text-center py-8">Nenhum cofre encontrado na API.</p>
             ) : (
                bankConfigs.map((bank) => (
                  <Card key={bank.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        {bank.nome}
                        <Badge variant="outline" className="text-xs">{bank.ambientePix || "N/A"}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Chave PIX</p>
                          <p className="font-mono text-xs truncate">{bank.chavePix || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Tipo Chave</p>
                          <p className="text-xs">{bank.tipoChave || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">URL API</p>
                          <p className="font-mono text-xs truncate">{bank.urlApi || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">URL Token</p>
                          <p className="font-mono text-xs truncate">{bank.urlToken || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Client ID</p>
                          <p className="font-mono text-xs truncate">{bank.clientId || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Ambiente</p>
                          <p className="text-xs">{bank.ambientePix || "—"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
             )}
             <Button className="w-full" onClick={() => setShowBankConfig(false)}>
               Fechar
             </Button>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

