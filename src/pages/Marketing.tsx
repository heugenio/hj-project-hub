import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Package, Cake, Flame, DollarSign, Pencil, Send, Save, Clock,
  Users, Filter, Eye, MessageSquare, Mail, Smartphone, Search,
  Upload, X, CheckCircle2, RefreshCw, ImageIcon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Types
interface ContatoApi {
  PESS_MARCAR?: string;
  PESS_NOME?: string;
  PESS_RAZAO_SOCIAL?: string;
  PESS_SEXO?: string;
  PESS_FISICO_JURIDICO?: string;
  PESS_DATA_NASCIMENTO?: string;
  TELE_DDD?: string;
  TELE_NUMERO?: string;
  DCFS_DATA_NOTA?: string;
  UNEM_FANTASIA?: string;
  UNEM_FONE?: string;
  UNEM_ENDERECO?: string;
  UNEM_ID?: string;
  UNEM_MSG_ASSINATURA?: string;
}

interface Contato {
  tratamento: string;
  nome: string;
  telefone: string;
  ultimaCompra: string;
  loja: string;
  lojaUrl: string;
  raw: ContatoApi;
  selected: boolean;
}

interface MensagemWhts {
  MSWA_ID?: string;
  MSWA_TIPO?: string;
  MSWA_MENSAGEM?: string;
  MSWA_QTD_DIAS?: number;
  MSWA_STATUS?: string;
}

type CampanhaTipo = "Rodizio" | "Aniversario" | "Promocao" | "Personalizada";

const campanhaConfig: { tipo: CampanhaTipo; label: string; icon: React.ReactNode; color: string }[] = [
  { tipo: "Rodizio", label: "Rodízio de Pneus", icon: <RefreshCw className="h-5 w-5" />, color: "bg-accent/10 text-accent border-accent/20" },
  { tipo: "Aniversario", label: "Aniversário", icon: <Cake className="h-5 w-5" />, color: "bg-pink-500/10 text-pink-600 border-pink-500/20" },
  { tipo: "Promocao", label: "Promoção", icon: <Flame className="h-5 w-5" />, color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  { tipo: "Personalizada", label: "Campanha Personalizada", icon: <Pencil className="h-5 w-5" />, color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
];

const variaveisDisponiveis = [
  { var: "{NOME_CLIENTE}", desc: "Sr/Sra + Nome do cliente" },
  { var: "{DATA_ULTIMA_COMPRA}", desc: "Data da última compra" },
  { var: "{EMPR}", desc: "Nome da loja" },
  { var: "{NOME_LOJA}", desc: "Nome fantasia da loja que vendeu" },
  { var: "{URL_LOJA}", desc: "URL/assinatura da loja" },
];

function getBaseUrl(): string {
  return localStorage.getItem('hj_system_url_base') || 'http://3.214.255.198:8085';
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function Marketing() {
  // State
  const [campanhaAtiva, setCampanhaAtiva] = useState<CampanhaTipo>("Rodizio");
  const [canal, setCanal] = useState<string>("whatsapp");
  const [mensagem, setMensagem] = useState("");
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [imagemUrl, setImagemUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingMensagem, setLoadingMensagem] = useState(false);

  // Filters
  const [filtroPeriodoIni, setFiltroPeriodoIni] = useState("");
  const [filtroPeriodoFim, setFiltroPeriodoFim] = useState("");
  const [filtroProduto, setFiltroProduto] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("");

  const [grupos, setGrupos] = useState<{ grpo_id: string; grpo_Nome: string }[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [savingMsg, setSavingMsg] = useState(false);

  const selectedCount = contatos.filter(c => c.selected).length;

  // Fetch grupos on mount
  useEffect(() => {
    const fetchGrupos = async () => {
      setLoadingGrupos(true);
      try {
        const { data, error } = await supabase.functions.invoke('api-proxy', {
          body: { baseUrl: getBaseUrl(), endpoint: '/getGrupos', method: 'GET' },
        });
        if (error) throw new Error(error.message);
        let list: any[] = [];
        if (Array.isArray(data)) list = data;
        else if (typeof data === 'string') list = JSON.parse(data);
        setGrupos(list);
      } catch (err: any) {
        console.error('Erro ao buscar grupos:', err);
      } finally {
        setLoadingGrupos(false);
      }
    };
    fetchGrupos();
  }, []);

  // Map campaign type to API MSWA_TIPO value
  const getMswaTipo = (tipo: CampanhaTipo): string => {
    const map: Record<CampanhaTipo, string> = {
      Rodizio: "RODIZIO",
      Aniversario: "ANIVERSARIO",
      Promocao: "MARKETING",
      Personalizada: "MARKETING",
    };
    return map[tipo];
  };

  // Fetch message template when campaign type changes
  useEffect(() => {
    const fetchMensagem = async () => {
      setLoadingMensagem(true);
      try {
        const mswaTipo = getMswaTipo(campanhaAtiva);
        const endpoint = `/getMenssagensWhts?MSWA_TIPO=${mswaTipo}`;

        const { data, error } = await supabase.functions.invoke('api-proxy', {
          body: { baseUrl: getBaseUrl(), endpoint, method: 'GET' },
        });

        if (error) throw new Error(error.message);

        let result: MensagemWhts | null = null;
        if (Array.isArray(data) && data.length > 0) {
          result = data[0];
        } else if (data && typeof data === 'object' && !Array.isArray(data)) {
          result = data as MensagemWhts;
        }

        if (result) {
          if (result.MSWA_MENSAGEM) {
            setMensagem(result.MSWA_MENSAGEM);
          }
          // Calculate dates based on MSWA_QTD_DIAS
          const qtdDias = Number(result.MSWA_QTD_DIAS) || 0;
          if (qtdDias > 0) {
            const hoje = new Date();
            const fim = new Date(hoje);
            fim.setDate(fim.getDate() - qtdDias);
            const ini = new Date(fim);
            ini.setDate(ini.getDate() - 7);
            setFiltroPeriodoFim(formatDate(fim));
            setFiltroPeriodoIni(formatDate(ini));
          }
        }
      } catch (err: any) {
        console.error('Erro ao buscar mensagem:', err);
      } finally {
        setLoadingMensagem(false);
      }
    };

    fetchMensagem();
  }, [campanhaAtiva]);

  // Upload image file to storage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `campanha_${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from('marketing-images')
        .upload(fileName, file, { contentType: file.type, upsert: true });

      if (error) throw error;

      const { data: publicData } = supabase.storage
        .from('marketing-images')
        .getPublicUrl(data.path);

      setImagemUrl(publicData.publicUrl);
      toast.success('Imagem enviada com sucesso!');
    } catch (err: any) {
      console.error('Erro no upload:', err);
      toast.error('Erro ao enviar imagem: ' + err.message);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Fetch contacts from API
  const gerarLista = useCallback(async () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem('hj_unidade');
      let unemId = '';
      if (stored) {
        try { unemId = JSON.parse(stored).unem_Id || JSON.parse(stored).UNEM_ID || ''; } catch {}
      }
      const mswaTipo = getMswaTipo(campanhaAtiva);
      const params = new URLSearchParams();
      params.set('MSWA_TIPO', mswaTipo);
      if (filtroPeriodoIni) params.set('DATAINI', filtroPeriodoIni);
      if (filtroPeriodoFim) params.set('DATAFIM', filtroPeriodoFim);
      if (filtroGrupo && filtroGrupo !== '__all__') params.set('Grupo', filtroGrupo);
      if (filtroProduto) params.set('Produto', filtroProduto);
      params.set('UNEM_ID', unemId);

      const endpoint = `/getContatosMsg?${params.toString()}`;

      const { data, error } = await supabase.functions.invoke('api-proxy', {
        body: { baseUrl: getBaseUrl(), endpoint, method: 'GET' },
      });

      if (error) throw new Error(error.message);
      
      let rawList: ContatoApi[] = [];
      if (typeof data === 'string') {
        rawList = JSON.parse(data);
      } else if (Array.isArray(data)) {
        rawList = data;
      }

      const mapped: Contato[] = rawList.map(r => {
        const isFisica = (r.PESS_FISICO_JURIDICO || '').toUpperCase().includes('FISIC');
        const sexo = (r.PESS_SEXO || '').toUpperCase();
        const tratamento = isFisica ? (sexo === 'F' ? 'Sra' : 'Sr') : '';
        const ddd = (r.TELE_DDD || '').replace(/\D/g, '');
        const numero = (r.TELE_NUMERO || '').replace(/\D/g, '');
        const telefone = ddd && numero ? `${ddd}-${numero}` : numero || '';
        return {
          tratamento,
          nome: r.PESS_NOME || r.PESS_RAZAO_SOCIAL || '',
          telefone,
          ultimaCompra: (r.DCFS_DATA_NOTA || '').split(' ')[0],
          loja: r.UNEM_FANTASIA || '',
          lojaUrl: r.UNEM_MSG_ASSINATURA || '',
          raw: r,
          selected: false,
        };
      });

      setContatos(mapped);
      setSelectAll(false);
      toast.success(`${mapped.length} contato(s) encontrado(s)`);
    } catch (err: any) {
      console.error('Erro ao gerar lista:', err);
      toast.error('Erro ao buscar contatos: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [campanhaAtiva, filtroPeriodoIni, filtroPeriodoFim, filtroGrupo, filtroProduto]);

  // Save message template
  const salvarMensagem = async () => {
    setSavingMsg(true);
    try {
      const mswaTipo = getMswaTipo(campanhaAtiva);
      const { data, error } = await supabase.functions.invoke('api-proxy', {
        body: {
          baseUrl: getBaseUrl(),
          endpoint: '/setMenssagensWhts',
          method: 'POST',
          body: { MSWA_TIPO: mswaTipo, MSWA_MENSAGEM: mensagem },
        },
      });
      if (error) throw new Error(error.message);
      toast.success('Mensagem salva com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar mensagem:', err);
      toast.error('Erro ao salvar mensagem: ' + err.message);
    } finally {
      setSavingMsg(false);
    }
  };

  // Toggle select all
  const toggleSelectAll = () => {
    const next = !selectAll;
    setSelectAll(next);
    setContatos(prev => prev.map(c => ({ ...c, selected: next })));
  };

  // Toggle single contact
  const toggleContato = (idx: number) => {
    setContatos(prev => prev.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c));
  };

  // Preview message with simulated data
  const previewMsg = mensagem
    .replace("{NOME_CLIENTE}", "Sr João Silva")
    .replace("{DATA_ULTIMA_COMPRA}", "15/01/2026")
    .replace("{EMPR}", "Auto Peças Centro")
    .replace("{NOME_LOJA}", "Filial Sul")
    .replace("{URL_LOJA}", "https://loja.exemplo.com")
    .replace(/\\n/g, "\n");

  // Send messages
  const enviarMensagens = async () => {
    const selecionados = contatos.filter(c => c.selected);
    if (selecionados.length === 0) {
      toast.warning("Selecione ao menos um destinatário");
      return;
    }
    setSending(true);
    let enviados = 0;
    let erros = 0;

    for (const contato of selecionados) {
      try {
        const storedUnidade = localStorage.getItem('hj_unidade');
        let emprNome = '';
        if (storedUnidade) { try { emprNome = JSON.parse(storedUnidade).unem_Fantasia || ''; } catch {} }
        const nomeComTratamento = contato.tratamento ? `${contato.tratamento} ${contato.nome}` : contato.nome;
        const texto = mensagem
          .replace("{NOME_CLIENTE}", nomeComTratamento)
          .replace("{DATA_ULTIMA_COMPRA}", contato.ultimaCompra || "")
          .replace("{EMPR}", emprNome)
          .replace("{NOME_LOJA}", contato.loja || "")
          .replace("{URL_LOJA}", contato.lojaUrl || "")
          .replace(/\\n/g, "\n");

        const phone = contato.telefone.replace(/\D/g, "");
        if (!phone) { erros++; continue; }

        const payload: any = {
          number: phone,
          canal,
        };

        if (imagemUrl) {
          payload.type = "media";
          payload.mediaType = "image";
          payload.file = imagemUrl;
          payload.text = texto;
        } else {
          payload.type = "text";
          payload.text = texto;
        }

        console.log('=== ENVIO MARKETING ===', JSON.stringify(payload, null, 2));

        const { error } = await supabase.functions.invoke('send-whatsapp', {
          body: payload,
        });

        if (error) throw error;
        enviados++;
      } catch (err: any) {
        console.error('Erro envio:', err);
        erros++;
      }
    }

    toast.success(`${enviados} mensagem(ns) enviada(s)${erros > 0 ? `, ${erros} erro(s)` : ""}`);
    setSending(false);
  };

  // Insert variable into message
  const insertVar = (v: string) => {
    setMensagem(prev => prev + " " + v);
  };

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Marketing / Campanhas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Envie mensagens personalizadas para seus clientes</p>
        </div>
        <Badge variant="outline" className="text-xs px-3 py-1 gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {selectedCount} selecionado(s)
        </Badge>
      </div>

      {/* Campaign Type Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {campanhaConfig.map(c => (
          <button
            key={c.tipo}
            onClick={() => setCampanhaAtiva(c.tipo)}
            className={`group relative rounded-xl border-2 p-3 text-left transition-all duration-200 hover:scale-[1.02] ${
              campanhaAtiva === c.tipo
                ? `${c.color} border-current shadow-md`
                : "bg-card border-border hover:border-muted-foreground/30"
            }`}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              {c.icon}
              <span className="text-[11px] font-medium leading-tight">{c.label}</span>
            </div>
            {campanhaAtiva === c.tipo && (
              <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Filters + Message */}
        <div className="lg:col-span-2 space-y-5">
          {/* Filters */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                Filtros de Segmentação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-[9px] text-muted-foreground">Período Início</Label>
                  <Input type="date" value={filtroPeriodoIni} onChange={e => setFiltroPeriodoIni(e.target.value)} className="h-7 text-[9px] px-1" />
                </div>
                <div>
                  <Label className="text-[9px] text-muted-foreground">Período Fim</Label>
                  <Input type="date" value={filtroPeriodoFim} onChange={e => setFiltroPeriodoFim(e.target.value)} className="h-7 text-[9px] px-1" />
                </div>
                <div>
                  <Label className="text-[9px] text-muted-foreground">Produto</Label>
                  <Input value={filtroProduto} onChange={e => setFiltroProduto(e.target.value)} placeholder="Nome do produto" className="h-7 text-[9px]" />
                </div>
                <div>
                  <Label className="text-[9px] text-muted-foreground">Grupo de Produto</Label>
                  <Select value={filtroGrupo} onValueChange={setFiltroGrupo}>
                    <SelectTrigger className="h-7 text-[10px]">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__" className="text-xs">Todos</SelectItem>
                      {grupos.map(g => (
                        <SelectItem key={g.grpo_id} value={g.grpo_id} className="text-xs">{g.grpo_Nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" onClick={gerarLista} disabled={loading} className="gap-1.5">
                  {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Gerar Lista
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Message Editor */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Editor de Mensagem
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground">Canal:</Label>
                  <Select value={canal} onValueChange={setCanal}>
                    <SelectTrigger className="h-7 w-[130px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp"><span className="flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> WhatsApp</span></SelectItem>
                      <SelectItem value="email"><span className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> E-mail</span></SelectItem>
                      <SelectItem value="sms"><span className="flex items-center gap-1.5"><Smartphone className="h-3 w-3" /> SMS</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Variables */}
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1.5 block">Variáveis disponíveis (clique para inserir):</Label>
                <div className="flex flex-wrap gap-1.5">
                  {variaveisDisponiveis.map(v => (
                    <button
                      key={v.var}
                      onClick={() => insertVar(v.var)}
                      className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                      title={v.desc}
                    >
                      {v.var}
                    </button>
                  ))}
                </div>
              </div>

              <Textarea
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                rows={4}
                placeholder="Digite sua mensagem..."
                className="text-sm resize-none normal-case"
              />
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={salvarMensagem} disabled={savingMsg} className="gap-1.5 h-7 text-xs">
                  {savingMsg ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar Mensagem
                </Button>
              </div>

              {/* Image upload */}
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5" /> Imagem de Marketing (opcional):
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {uploadingImage ? "Enviando..." : "Upload Imagem"}
                  </Button>
                  {imagemUrl && (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <img src={imagemUrl} alt="Preview" className="h-8 w-8 rounded object-cover border border-border" />
                      <span className="text-[10px] text-muted-foreground truncate flex-1">{imagemUrl.split('/').pop()}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setImagemUrl("")}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recipients Table */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Destinatários
                  {contatos.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{contatos.length}</Badge>
                  )}
                </CardTitle>
                {contatos.length > 0 && (
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={toggleSelectAll}>
                    <Checkbox checked={selectAll} className="h-3 w-3" />
                    {selectAll ? "Desmarcar Todos" : "Selecionar Todos"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {contatos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">Nenhum contato carregado</p>
                  <p className="text-xs mt-1">Use os filtros acima e clique em "Gerar Lista"</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-10 text-center">#</TableHead>
                        <TableHead className="text-[10px]">Cliente</TableHead>
                        <TableHead className="text-[10px]">Telefone</TableHead>
                        <TableHead className="text-[10px]">Última Compra</TableHead>
                        <TableHead className="text-[10px]">Loja</TableHead>
                        <TableHead className="w-10 text-center">
                          <Checkbox checked={selectAll} onCheckedChange={toggleSelectAll} className="h-3.5 w-3.5" />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contatos.map((c, idx) => (
                        <TableRow key={idx} className={`text-xs transition-colors ${c.selected ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                          <TableCell className="text-center text-muted-foreground text-[10px]">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-[11px]">
                            {c.tratamento && <span className="text-muted-foreground mr-1">{c.tratamento}</span>}
                            {c.nome}
                          </TableCell>
                          <TableCell className="text-[10px] text-muted-foreground">{c.telefone || "—"}</TableCell>
                          <TableCell className="text-[10px]">{c.ultimaCompra || "—"}</TableCell>
                          <TableCell className="text-[10px]">{c.loja || "—"}</TableCell>
                          <TableCell className="text-center">
                            <Checkbox checked={c.selected} onCheckedChange={() => toggleContato(idx)} className="h-3.5 w-3.5" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Preview + Actions */}
        <div className="space-y-5">
          {/* Preview */}
          <Card className="border-border/60 sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                Pré-visualização
              </CardTitle>
              <CardDescription className="text-[10px]">Simulação com dados fictícios</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 p-4 border border-green-200/50 dark:border-green-800/30">
                {/* Chat bubble */}
                <div className="bg-card rounded-lg rounded-tl-none p-3 shadow-sm border border-border/40 max-w-[280px]">
                  <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground">{previewMsg}</p>
                  {imagemUrl && (
                    <div className="mt-2 rounded-md overflow-hidden border border-border/30">
                      <img src={imagemUrl} alt="Preview" className="w-full h-auto max-h-40 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}
                  <span className="text-[9px] text-muted-foreground mt-1.5 block text-right">14:32 ✓✓</span>
                </div>
              </div>

              {/* Campaign info */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Tipo de Campanha</span>
                  <Badge variant="outline" className="text-[9px]">{campanhaAtiva}</Badge>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Canal</span>
                  <Badge variant="outline" className="text-[9px] capitalize">{canal}</Badge>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Destinatários</span>
                  <Badge variant="secondary" className="text-[9px]">{selectedCount}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full gap-2 justify-start"
                onClick={enviarMensagens}
                disabled={sending || selectedCount === 0}
              >
                {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar Mensagens ({selectedCount})
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
