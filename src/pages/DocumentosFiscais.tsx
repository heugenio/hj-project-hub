import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, RefreshCw, Eraser, Download, FileText, Eye, Printer, Send, Share2,
  MoreVertical, FileX, FileEdit, FileArchive, Receipt, AlertTriangle, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import {
  getDocumentosFiscais,
  setCancelamentoDocumentoFiscal,
  setCartaCorrecaoDocumentoFiscal,
  setInutilizacaoDocumentoFiscal,
  type DocumentoFiscal,
} from "@/lib/api-os";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { format, subDays, parse } from "date-fns";

type TabKey = "saidas" | "entradas";

const MODELOS: Record<string, { label: string; full: string; color: string }> = {
  "55": { label: "NF-e", full: "Nota Fiscal Eletrônica", color: "bg-blue-500/10 text-blue-700 border-blue-300" },
  "65": { label: "NFC-e", full: "Nota Fiscal Consumidor", color: "bg-emerald-500/10 text-emerald-700 border-emerald-300" },
  "57": { label: "CT-e", full: "Conhecimento Transporte", color: "bg-amber-500/10 text-amber-700 border-amber-300" },
  "03": { label: "NFS-e", full: "Nota Fiscal Serviço", color: "bg-purple-500/10 text-purple-700 border-purple-300" },
  XX: { label: "Gerencial", full: "Nota Gerencial", color: "bg-slate-500/10 text-slate-700 border-slate-300" },
};

const ELECTRONIC_MODELS = ["55", "65", "57", "03"];

function modeloInfo(m?: string) {
  const key = (m || "").toUpperCase();
  return MODELOS[key] || { label: key || "—", full: key || "—", color: "bg-muted text-muted-foreground border-border" };
}

function situacaoBadge(s?: string) {
  const v = (s || "").toLowerCase();
  if (v.includes("autoriz") || v === "válido" || v === "valido")
    return <Badge className="bg-emerald-500/10 text-emerald-700 border border-emerald-300 gap-1 text-[10px] px-1.5 py-0"><CheckCircle2 className="h-3 w-3" />{v.includes("autoriz") ? "Autorizada" : "Válido"}</Badge>;
  if (v.includes("cancel")) return <Badge className="bg-red-500/10 text-red-700 border border-red-300 gap-1 text-[10px] px-1.5 py-0"><XCircle className="h-3 w-3" />Cancelada</Badge>;
  if (v.includes("deneg")) return <Badge className="bg-orange-500/10 text-orange-700 border border-orange-300 gap-1 text-[10px] px-1.5 py-0"><AlertTriangle className="h-3 w-3" />Denegada</Badge>;
  if (v.includes("erro") || v.includes("rejei")) return <Badge className="bg-rose-500/10 text-rose-700 border border-rose-300 gap-1 text-[10px] px-1.5 py-0"><AlertTriangle className="h-3 w-3" />Erro</Badge>;
  if (v.includes("pend") || v.includes("process")) return <Badge className="bg-amber-500/10 text-amber-700 border border-amber-300 gap-1 text-[10px] px-1.5 py-0"><Clock className="h-3 w-3" />Pendente</Badge>;
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0">{s || "—"}</Badge>;
}

function fmtMoney(v: any) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0").replace(",", "."));
  if (Number.isNaN(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(v?: string) {
  if (!v) return "—";
  // Formato BR vindo da API: "dd/MM/yyyy HH:mm:ss"
  const brMatch = v.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (brMatch) {
    const [, d, m, y, hh, mm] = brMatch;
    return hh ? `${d}/${m}/${y} ${hh}:${mm}` : `${d}/${m}/${y}`;
  }
  const tries = ["yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd", "yyyy/MM/dd"];
  for (const f of tries) {
    try {
      const d = parse(v.slice(0, f.length), f, new Date());
      if (!Number.isNaN(d.getTime())) return format(d, "dd/MM/yyyy");
    } catch {}
  }
  return v;
}

// Helpers para lidar com a resposta real da API (vários nomes de campo)
const getValor = (d: any) => d?.DCFS_VLR_TOTAL ?? d?.DCFS_VALOR_TOTAL ?? 0;
const getData = (d: any) => d?.DCFS_DATA_NOTA ?? d?.DCFS_DATA_EMISSAO ?? d?.DCFS_DATA_SAIDA ?? "";
const getStatus = (d: any) => d?.DCFS_STATUS ?? d?.DCFS_SITUACAO ?? "";
const getChave = (d: any) => d?.DCFS_CHAVE_ACESSO_NFE ?? d?.DCFS_CHAVE ?? "";
const getSerie = (d: any) => d?.DCFS_SERIE_NOTA ?? d?.DCFS_SERIE ?? "";

function parseXmlFromB64(b64: string): string {
  try {
    return atob(b64);
  } catch {
    return b64;
  }
}

const STORAGE_KEY = "verttice_docfiscal_filters";

export default function DocumentosFiscais() {
  const { auth } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<TabKey>("saidas");
  const today = format(new Date(), "yyyy-MM-dd");
  const sevenAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");

  const [filters, setFilters] = useState(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) return { ...JSON.parse(cached) };
    } catch {}
    return {
      dtInicio: sevenAgo,
      dtFinal: today,
      DCFS_NUMERO_NOTA: "",
      DCFS_NOME: "",
      DCFS_CPFCNPJ: "",
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  const unemId = auth?.unidade?.unem_Id || "";
  const unemNome = auth?.unidade?.unem_Fantasia || auth?.unidade?.unem_Razao_Social || "LOJA";

  const [docs, setDocs] = useState<DocumentoFiscal[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const tipoMovimento = tab === "saidas" ? "Saída" : "Entrada";

  const fetchDocs = useCallback(async () => {
    if (!unemId) {
      toast({ title: "Loja não identificada", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const data = await getDocumentosFiscais({
        UNEM_ID: unemId,
        dtInicio: filters.dtInicio,
        dtFinal: filters.dtFinal,
        DCFS_NUMERO_NOTA: filters.DCFS_NUMERO_NOTA || undefined,
        DCFS_NOME: filters.DCFS_NOME || undefined,
        DCFS_CPFCNPJ: filters.DCFS_CPFCNPJ || undefined,
        DCFS_TIPO_MOVIMENTO: tipoMovimento,
      });
      setDocs(data);
      setPage(1);
    } catch (e: any) {
      toast({ title: "Erro ao consultar", description: e?.message || String(e), variant: "destructive" });
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [unemId, filters, tipoMovimento, toast]);

  useEffect(() => {
    if (unemId) fetchDocs();
  }, [tab, unemId]);

  const totals = useMemo(() => {
    const total = docs.length;
    const valor = docs.reduce((a, d) => {
      const raw = getValor(d);
      const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "0").replace(",", "."));
      return a + (Number.isNaN(n) ? 0 : n);
    }, 0);
    let autorizadas = 0, canceladas = 0, erros = 0, pendentes = 0;
    for (const d of docs) {
      const s = getStatus(d).toLowerCase();
      if (s.includes("autoriz") || s === "válido" || s === "valido") autorizadas++;
      else if (s.includes("cancel")) canceladas++;
      else if (s.includes("erro") || s.includes("rejei") || s.includes("deneg")) erros++;
      else pendentes++;
    }
    return { total, valor, autorizadas, canceladas, erros, pendentes };
  }, [docs]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return docs.slice(start, start + pageSize);
  }, [docs, page]);
  const totalPages = Math.max(1, Math.ceil(docs.length / pageSize));

  const [viewDoc, setViewDoc] = useState<DocumentoFiscal | null>(null);
  const [cancelDoc, setCancelDoc] = useState<DocumentoFiscal | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [cceDoc, setCceDoc] = useState<DocumentoFiscal | null>(null);
  const [cceTexto, setCceTexto] = useState("");
  const [inutOpen, setInutOpen] = useState(false);
  const [inut, setInut] = useState({ serie: "", numeroInicial: "", numeroFinal: "", motivo: "" });
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSel, setExportSel] = useState<Record<string, boolean>>({ "55": true, "65": true, "57": true, "03": true });
  const [exporting, setExporting] = useState(false);

  const downloadXml = (doc: DocumentoFiscal) => {
    const xml = doc.DCFS_ARQUIVO_NFE ? parseXmlFromB64(doc.DCFS_ARQUIVO_NFE) : "";
    if (!xml) {
      toast({ title: "XML indisponível", variant: "destructive" });
      return;
    }
    const blob = new Blob([xml], { type: "text/xml;charset=utf-8" });
    const nome = `${getChave(doc) || doc.DCFS_NUMERO_NOTA || "documento"}.xml`;
    saveAs(blob, nome);
  };

  const visualizarXml = (doc: DocumentoFiscal) => {
    setViewDoc(doc);
  };

  const handleCancelar = async () => {
    if (!cancelDoc) return;
    if (cancelMotivo.trim().length < 15) {
      toast({ title: "Motivo deve ter ao menos 15 caracteres", variant: "destructive" });
      return;
    }
    try {
      await setCancelamentoDocumentoFiscal({
        DCFS_ID: cancelDoc.DCFS_ID || "",
        CHAVE: getChave(cancelDoc),
        MOTIVO: cancelMotivo.toUpperCase(),
      });
      toast({ title: "Cancelamento enviado", description: "Documento processado pela SEFAZ" });
      setCancelDoc(null);
      setCancelMotivo("");
      fetchDocs();
    } catch (e: any) {
      toast({ title: "Erro ao cancelar", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const handleCce = async () => {
    if (!cceDoc) return;
    if (cceTexto.trim().length < 15) {
      toast({ title: "Texto da CC-e deve ter ao menos 15 caracteres", variant: "destructive" });
      return;
    }
    try {
      await setCartaCorrecaoDocumentoFiscal({
        DCFS_ID: cceDoc.DCFS_ID || "",
        CHAVE: getChave(cceDoc),
        CORRECAO: cceTexto.toUpperCase(),
      });
      toast({ title: "Carta de Correção enviada" });
      setCceDoc(null);
      setCceTexto("");
      fetchDocs();
    } catch (e: any) {
      toast({ title: "Erro na CC-e", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const handleInutilizar = async () => {
    if (!inut.serie || !inut.numeroInicial || !inut.numeroFinal || inut.motivo.trim().length < 15) {
      toast({ title: "Preencha todos os campos (motivo ≥ 15 caracteres)", variant: "destructive" });
      return;
    }
    try {
      await setInutilizacaoDocumentoFiscal({
        UNEM_ID: unemId,
        SERIE: inut.serie,
        NUMERO_INICIAL: inut.numeroInicial,
        NUMERO_FINAL: inut.numeroFinal,
        MOTIVO: inut.motivo.toUpperCase(),
      });
      toast({ title: "Inutilização enviada" });
      setInutOpen(false);
      setInut({ serie: "", numeroInicial: "", numeroFinal: "", motivo: "" });
      fetchDocs();
    } catch (e: any) {
      toast({ title: "Erro na inutilização", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const compartilhar = async (doc: DocumentoFiscal) => {
    const url = `Nota ${doc.DCFS_NUMERO_NOTA} - Chave: ${doc.DCFS_CHAVE || "—"}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Documento Fiscal", text: url }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Copiado para área de transferência" });
    } catch {
      toast({ title: "Compartilhamento não disponível", variant: "destructive" });
    }
  };

  const enviarWhatsApp = (doc: DocumentoFiscal) => {
    const fone = (doc as any).DCFS_FONE || "";
    const txt = `Olá! Segue sua nota fiscal Nº ${doc.DCFS_NUMERO_NOTA}. Chave: ${doc.DCFS_CHAVE || ""}`;
    const url = `https://wa.me/${fone}?text=${encodeURIComponent(txt)}`;
    window.open(url, "_blank", "noopener");
  };

  const imprimir = () => window.print();

  const exportarXmls = async () => {
    const modelos = Object.entries(exportSel).filter(([, v]) => v).map(([k]) => k);
    if (modelos.length === 0) {
      toast({ title: "Selecione ao menos um modelo", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      const zip = new JSZip();
      let count = 0;
      for (const d of docs) {
        const modelo = (d.DCFS_MODELO_NOTA || "").toUpperCase();
        if (modelo === "XX") continue;
        if (!modelos.includes(modelo)) continue;
        const xml = d.DCFS_ARQUIVO_NFE ? parseXmlFromB64(d.DCFS_ARQUIVO_NFE) : "";
        if (!xml) continue;
        const nome = `${d.DCFS_CHAVE || `${d.DCFS_NUMERO_NOTA}_${d.DCFS_SERIE}`}.xml`;
        zip.file(nome, xml);
        count++;
      }
      if (count === 0) {
        toast({ title: "Nenhum XML encontrado no período selecionado", variant: "destructive" });
        return;
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const tipo = tab === "saidas" ? "SAIDAS" : "ENTRADAS";
      const data = format(new Date(), "yyyyMMdd");
      const lojaNome = String(unemNome).replace(/\W+/g, "_").toUpperCase();
      saveAs(blob, `XML_CONTABILIDADE_${lojaNome}_${tipo}_${data}.zip`);
      toast({ title: `${count} XML(s) exportados` });
      setExportOpen(false);
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const limparFiltros = () => {
    setFilters({
      dtInicio: sevenAgo,
      dtFinal: today,
      DCFS_NUMERO_NOTA: "",
      DCFS_NOME: "",
      DCFS_CPFCNPJ: "",
    });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Documentos Fiscais
          </h1>
          <p className="text-sm text-muted-foreground">
            Loja: <span className="font-medium text-foreground uppercase">{unemNome}</span>
            {" · "}
            UNEM_ID: <span className="font-mono">{unemId || "—"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setInutOpen(true)}>
            <FileX className="h-4 w-4 mr-1" /> Inutilização
          </Button>
          <Button variant="default" size="sm" onClick={() => setExportOpen(true)}>
            <FileArchive className="h-4 w-4 mr-1" /> Exportar XMLs Contabilidade
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="saidas">Saídas</TabsTrigger>
          <TabsTrigger value="entradas">Entradas</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <KPI label="Quantidade" value={String(totals.total)} />
        <KPI label="Valor Total" value={fmtMoney(totals.valor)} />
        <KPI label="Autorizadas" value={String(totals.autorizadas)} tone="emerald" />
        <KPI label="Canceladas" value={String(totals.canceladas)} tone="red" />
        <KPI label="Erro Autorização" value={String(totals.erros)} tone="amber" />
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
            <div>
              <Label className="text-[10px] uppercase">Data Inicial</Label>
              <Input type="date" value={filters.dtInicio} className="h-8 text-xs"
                onChange={(e) => setFilters({ ...filters, dtInicio: e.target.value })} />
            </div>
            <div>
              <Label className="text-[10px] uppercase">Data Final</Label>
              <Input type="date" value={filters.dtFinal} className="h-8 text-xs"
                onChange={(e) => setFilters({ ...filters, dtFinal: e.target.value })} />
            </div>
            <div>
              <Label className="text-[10px] uppercase">Nº Nota</Label>
              <Input value={filters.DCFS_NUMERO_NOTA} className="h-8 text-xs"
                onChange={(e) => setFilters({ ...filters, DCFS_NUMERO_NOTA: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label className="text-[10px] uppercase">Nome</Label>
              <Input value={filters.DCFS_NOME} className="h-8 text-xs uppercase"
                onChange={(e) => setFilters({ ...filters, DCFS_NOME: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label className="text-[10px] uppercase">CPF/CNPJ</Label>
              <Input value={filters.DCFS_CPFCNPJ} className="h-8 text-xs"
                onChange={(e) => setFilters({ ...filters, DCFS_CPFCNPJ: e.target.value.replace(/\D/g, "") })} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={fetchDocs} disabled={loading}>
                <Search className="h-4 w-4 mr-1" /> Pesquisar
              </Button>
              <Button size="sm" variant="outline" onClick={limparFiltros}>
                <Eraser className="h-4 w-4 mr-1" /> Limpar
              </Button>
              <Button size="sm" variant="ghost" onClick={fetchDocs} disabled={loading} title="Atualizar">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase">Modelo</TableHead>
                  <TableHead className="text-[10px] uppercase">Nº / Série</TableHead>
                  <TableHead className="text-[10px] uppercase">Emissão</TableHead>
                  <TableHead className="text-[10px] uppercase">Nome</TableHead>
                  <TableHead className="text-[10px] uppercase">CPF/CNPJ</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">Valor Total</TableHead>
                  <TableHead className="text-[10px] uppercase">Situação</TableHead>
                  <TableHead className="text-[10px] uppercase">Chave</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 9 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </>
                )}
                {!loading && paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Nenhum documento encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {!loading && paged.map((d, idx) => {
                  const mod = modeloInfo(d.DCFS_MODELO_NOTA);
                  const isGerencial = (d.DCFS_MODELO_NOTA || "").toUpperCase() === "XX";
                  const hasXml = !isGerencial && !!d.DCFS_ARQUIVO_NFE;
                  const chave = getChave(d);
                  const status = getStatus(d);
                  return (
                    <TableRow key={`${d.DCFS_ID || idx}-${chave || idx}`}>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${mod.color}`}>
                          {mod.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {d.DCFS_NUMERO_NOTA} / {getSerie(d) || "—"}
                      </TableCell>
                      <TableCell className="text-xs">{fmtDate(getData(d))}</TableCell>
                      <TableCell className="text-xs uppercase max-w-[200px] truncate">{d.DCFS_NOME || "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{d.DCFS_CPFCNPJ || "—"}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{fmtMoney(getValor(d))}</TableCell>
                      <TableCell>{situacaoBadge(status)}</TableCell>
                      <TableCell className="text-[10px] font-mono max-w-[180px] truncate" title={chave}>
                        {chave || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-popover">
                            <DropdownMenuItem onClick={() => visualizarXml(d)}>
                              <Eye className="h-4 w-4 mr-2" /> Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={imprimir}>
                              <Printer className="h-4 w-4 mr-2" /> Imprimir
                            </DropdownMenuItem>
                            {hasXml && (
                              <>
                                <DropdownMenuItem onClick={() => visualizarXml(d)}>
                                  <FileText className="h-4 w-4 mr-2" /> DANFE / PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => downloadXml(d)}>
                                  <Download className="h-4 w-4 mr-2" /> Download XML
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => enviarWhatsApp(d)}>
                                  <Send className="h-4 w-4 mr-2" /> Enviar WhatsApp
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            {hasXml && (d.DCFS_MODELO_NOTA || "") === "55" && (
                              <DropdownMenuItem onClick={() => setCceDoc(d)}>
                                <FileEdit className="h-4 w-4 mr-2" /> Carta Correção
                              </DropdownMenuItem>
                            )}
                            {hasXml && !((d.DCFS_SITUACAO || "").toLowerCase().includes("cancel")) && (
                              <DropdownMenuItem onClick={() => setCancelDoc(d)} className="text-destructive">
                                <XCircle className="h-4 w-4 mr-2" /> Cancelar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => compartilhar(d)}>
                              <Share2 className="h-4 w-4 mr-2" /> Compartilhar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {docs.length > pageSize && (
            <div className="flex items-center justify-between p-2 border-t text-xs">
              <span className="text-muted-foreground">
                Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, docs.length)} de {docs.length}
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <span className="px-2 py-1">Pág. {page} / {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewDoc} onOpenChange={(o) => !o && setViewDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Documento Nº {viewDoc?.DCFS_NUMERO_NOTA} — {modeloInfo(viewDoc?.DCFS_MODELO_NOTA).full}</DialogTitle>
            <DialogDescription>Resumo fiscal, protocolo e XML</DialogDescription>
          </DialogHeader>
          {viewDoc && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Info label="Chave de Acesso" value={viewDoc.DCFS_CHAVE} mono />
                <Info label="Protocolo" value={viewDoc.DCFS_PROTOCOLO} mono />
                <Info label="Data Emissão" value={fmtDate(viewDoc.DCFS_DATA_EMISSAO)} />
                <Info label="Autorização" value={fmtDate(viewDoc.DCFS_DATA_AUTORIZACAO)} />
                <Info label="Cliente / Fornecedor" value={viewDoc.DCFS_NOME} />
                <Info label="CPF/CNPJ" value={viewDoc.DCFS_CPFCNPJ} mono />
                <Info label="Valor Total" value={fmtMoney(viewDoc.DCFS_VALOR_TOTAL)} />
                <Info label="Situação" value={viewDoc.DCFS_SITUACAO} />
              </div>
              {viewDoc.DCFS_ARQUIVO_NFE && (
                <div>
                  <Label className="text-xs uppercase">XML</Label>
                  <pre className="mt-1 text-[10px] bg-muted p-2 rounded max-h-80 overflow-auto whitespace-pre-wrap break-all">
                    {parseXmlFromB64(viewDoc.DCFS_ARQUIVO_NFE)}
                  </pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {viewDoc?.DCFS_ARQUIVO_NFE && (
              <Button variant="outline" onClick={() => downloadXml(viewDoc)}>
                <Download className="h-4 w-4 mr-1" /> Download XML
              </Button>
            )}
            <Button variant="outline" onClick={imprimir}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
            <Button onClick={() => setViewDoc(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelDoc} onOpenChange={(o) => { if (!o) { setCancelDoc(null); setCancelMotivo(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Documento Nº {cancelDoc?.DCFS_NUMERO_NOTA}</DialogTitle>
            <DialogDescription>
              Chave: <span className="font-mono text-[10px]">{cancelDoc?.DCFS_CHAVE}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs uppercase">Motivo (mínimo 15 caracteres)</Label>
            <Textarea
              value={cancelMotivo}
              onChange={(e) => setCancelMotivo(e.target.value.toUpperCase())}
              rows={4}
              className="uppercase"
              placeholder="INFORME O MOTIVO DO CANCELAMENTO"
            />
            <p className="text-[10px] text-muted-foreground">{cancelMotivo.length}/255</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDoc(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleCancelar}>Confirmar Cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cceDoc} onOpenChange={(o) => { if (!o) { setCceDoc(null); setCceTexto(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carta de Correção — NF-e Nº {cceDoc?.DCFS_NUMERO_NOTA}</DialogTitle>
            <DialogDescription>Eventos fiscais (modelo 55)</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs uppercase">Texto da Correção (mín. 15 caracteres)</Label>
            <Textarea
              value={cceTexto}
              onChange={(e) => setCceTexto(e.target.value.toUpperCase())}
              rows={5}
              className="uppercase"
              placeholder="DESCREVA A CORREÇÃO"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCceDoc(null)}>Cancelar</Button>
            <Button onClick={handleCce}>Enviar CC-e</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inutOpen} onOpenChange={setInutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inutilização de Numeração</DialogTitle>
            <DialogDescription>Eventos fiscais — inutilizar faixa de numeração</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs uppercase">Série</Label>
              <Input value={inut.serie} className="uppercase"
                onChange={(e) => setInut({ ...inut, serie: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label className="text-xs uppercase">Nº Inicial</Label>
              <Input value={inut.numeroInicial}
                onChange={(e) => setInut({ ...inut, numeroInicial: e.target.value.replace(/\D/g, "") })} />
            </div>
            <div>
              <Label className="text-xs uppercase">Nº Final</Label>
              <Input value={inut.numeroFinal}
                onChange={(e) => setInut({ ...inut, numeroFinal: e.target.value.replace(/\D/g, "") })} />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase">Motivo (mín. 15 caracteres)</Label>
            <Textarea value={inut.motivo} rows={4} className="uppercase"
              onChange={(e) => setInut({ ...inut, motivo: e.target.value.toUpperCase() })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInutOpen(false)}>Cancelar</Button>
            <Button onClick={handleInutilizar}>Inutilizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar XMLs para Contabilidade</DialogTitle>
            <DialogDescription>
              Loja: <span className="font-medium uppercase">{unemNome}</span> · Tipo:{" "}
              <span className="font-medium">{tipoMovimento}</span> · Período:{" "}
              <span className="font-medium">{filters.dtInicio} a {filters.dtFinal}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs uppercase">Modelos a Exportar</Label>
            <div className="grid grid-cols-2 gap-2">
              {ELECTRONIC_MODELS.map((m) => (
                <label key={m} className="flex items-center gap-2 border rounded px-2 py-1 cursor-pointer">
                  <Checkbox
                    checked={!!exportSel[m]}
                    onCheckedChange={(v) => setExportSel({ ...exportSel, [m]: !!v })}
                  />
                  <Badge variant="outline" className={`text-[10px] ${modeloInfo(m).color}`}>{modeloInfo(m).label}</Badge>
                  <span className="text-xs">{modeloInfo(m).full}</span>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Notas gerenciais (XX) não são exportadas.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)} disabled={exporting}>Cancelar</Button>
            <Button onClick={exportarXmls} disabled={exporting}>
              {exporting ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Gerando...</> : <><Download className="h-4 w-4 mr-1" /> Baixar ZIP</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "red" | "amber" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-600" :
    tone === "red" ? "text-red-600" :
    tone === "amber" ? "text-amber-600" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
        <p className={`text-lg font-bold ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Info({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-sm ${mono ? "font-mono break-all" : ""}`}>{value || "—"}</p>
    </div>
  );
}
