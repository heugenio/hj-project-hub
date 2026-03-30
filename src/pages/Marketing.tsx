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
  PESS_EMAIL?: string;
}

type SendStatus = 'idle' | 'sent' | 'error' | 'skipped';

interface Contato {
  tratamento: string;
  nome: string;
  telefone: string;
  email: string;
  ultimaCompra: string;
  loja: string;
  lojaUrl: string;
  lojaEndereco: string;
  raw: ContatoApi;
  selected: boolean;
  sendStatus: SendStatus;
}

interface MensagemWhts {
  MSWA_ID?: string;
  MSWA_TIPO?: string;
  MSWA_MENSAGEM?: string;
  MSWA_QTD_DIAS?: number;
  MSWA_STATUS?: string;
}

interface Parametro {
  PRMT_NOME?: string;
  PRMT_VALOR?: string;
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
  { var: "{ENDLOJA}", desc: "Endereço da loja" },
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

// Helper to fetch a single parameter from API
async function fetchParametro(unemId: string, nome: string): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('api-proxy', {
      body: { baseUrl: getBaseUrl(), endpoint: `/getParametros?UNEM_ID=${unemId}&nome=${encodeURIComponent(nome)}`, method: 'GET' },
    });
    if (error) return '';
    let result: any = data;
    if (typeof data === 'string') { try { result = JSON.parse(data); } catch { return ''; } }
    if (Array.isArray(result) && result.length > 0) return (result[0].PRMT_VALOR || '').trim();
    if (result && result.PRMT_VALOR) return (result.PRMT_VALOR || '').trim();
    return '';
  } catch {
    return '';
  }
}

const VALID_WHATS_PROVIDERS = ['Nexus', 'WhatsAppOficial', 'BrasilAPI'];

function sanitizeProvider(value: string): string {
  const trimmed = value.trim();
  const match = VALID_WHATS_PROVIDERS.find(p => p.toLowerCase() === trimmed.toLowerCase());
  return match || '';
}

// ── Background sending state (persists across navigation) ──
interface BackgroundSendState {
  active: boolean;
  contatos: Contato[];
  progress: { current: number; total: number; enviados: number; erros: number; pulados: number };
  listeners: Set<() => void>;
}

const bgSend: BackgroundSendState = {
  active: false,
  contatos: [],
  progress: { current: 0, total: 0, enviados: 0, erros: 0, pulados: 0 },
  listeners: new Set(),
};

function notifyBgListeners() {
  bgSend.listeners.forEach(fn => fn());
}

const BATCH_SIZE = 10;
const BATCH_DELAYS = [10000, 15000, 10000]; // cycle through these delays between batches

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function Marketing() {
  // State
  const [campanhaAtiva, setCampanhaAtiva] = useState<CampanhaTipo>("Rodizio");
  const [canal, setCanal] = useState<string>("whatsapp");
  const [mensagem, setMensagem] = useState("");
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
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
  const [filtroUnemId, setFiltroUnemId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('hj_unidade');
      if (stored) {
        const u = JSON.parse(stored);
        return u.unem_Id || u.UNEM_ID || '__todas__';
      }
    } catch {}
    return '__todas__';
  });
  const [unidades, setUnidades] = useState<{ unem_Id: string; unem_Fantasia: string; unem_Endereco: string }[]>([]);
  const [loadingUnidades, setLoadingUnidades] = useState(false);

  const [grupos, setGrupos] = useState<{ grpo_id: string; grpo_Nome: string }[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [savingMsg, setSavingMsg] = useState(false);

  // Provider params state
  const [whatsProvider, setWhatsProvider] = useState<string>('');
  const [whatsToken, setWhatsToken] = useState<string>('');
  const [whatsDevice, setWhatsDevice] = useState<string>('');
  const [whatsPhoneNumberId, setWhatsPhoneNumberId] = useState<string>('');
  const [emailSenha, setEmailSenha] = useState<string>('');
  const [emailServidor, setEmailServidor] = useState<string>('');
  const [emailPorta, setEmailPorta] = useState<string>('');
  const [emailSsl, setEmailSsl] = useState<string>('');
  const [emailEndereco, setEmailEndereco] = useState<string>('');
  const [loadingParams, setLoadingParams] = useState(false);

  const selectedCount = contatos.filter(c => c.selected).length;

  // Get resolved UNEM_ID for parameters
  const getResolvedUnemId = (): string => {
    if (filtroUnemId && filtroUnemId !== '__todas__') return filtroUnemId;
    try {
      const stored = localStorage.getItem('hj_unidade');
      if (stored) {
        const u = JSON.parse(stored);
        return u.unem_Id || u.UNEM_ID || '';
      }
    } catch {}
    return '';
  };

  // Fetch parameters for the selected unidade
  const fetchParametros = useCallback(async () => {
    const unemId = getResolvedUnemId();
    if (!unemId) return;
    setLoadingParams(true);
    try {
      const [servidor, token, device, phoneId, senha, smtpServer, porta, ssl, endereco] = await Promise.all([
        fetchParametro(unemId, 'SERVIDORWHATS'),
        fetchParametro(unemId, 'TOKENWHATS'),
        fetchParametro(unemId, 'DEVICEWHATS'),
        fetchParametro(unemId, 'PHONENUMBERID'),
        fetchParametro(unemId, 'SenhaEmail'),
        fetchParametro(unemId, 'ServidorEmail'),
        fetchParametro(unemId, 'ServidorPorta'),
        fetchParametro(unemId, 'ServidorSSL'),
        fetchParametro(unemId, 'EnderecoEmail'),
      ]);
      console.log('SERVIDORWHATS raw value:', JSON.stringify(servidor));
      setWhatsProvider(sanitizeProvider(servidor));
      setWhatsToken(token);
      setWhatsDevice(device);
      setWhatsPhoneNumberId(phoneId);
      setEmailSenha(senha);
      setEmailServidor(smtpServer);
      setEmailPorta(porta);
      setEmailSsl(ssl);
      setEmailEndereco(endereco);
      if (servidor) {
        console.log(`Provedor WhatsApp configurado: ${servidor}`);
      }
    } catch (err: any) {
      console.error('Erro ao buscar parâmetros:', err);
    } finally {
      setLoadingParams(false);
    }
  }, [filtroUnemId]);

  // Fetch grupos, unidades and params on mount / filter change
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
    const fetchUnidades = async () => {
      setLoadingUnidades(true);
      try {
        const stored = localStorage.getItem('hj_unidade');
        let emprId = '';
        if (stored) {
          try { const u = JSON.parse(stored); emprId = u.empr_id || u.empr_Id || ''; } catch {}
        }
        if (!emprId) return;
        const { data, error } = await supabase.functions.invoke('api-proxy', {
          body: { baseUrl: getBaseUrl(), endpoint: `/getUnidadesEmpresariais?empr_id=${emprId}`, method: 'GET' },
        });
        if (error) throw new Error(error.message);
        let list: any[] = [];
        if (Array.isArray(data)) list = data;
        else if (typeof data === 'string') list = JSON.parse(data);
        setUnidades(list.map((u: any) => ({ unem_Id: u.unem_Id || u.UNEM_ID || '', unem_Fantasia: u.unem_Fantasia || u.UNEM_FANTASIA || '', unem_Endereco: u.unem_Endereco || u.UNEM_ENDERECO || '' })));
      } catch (err: any) {
        console.error('Erro ao buscar unidades:', err);
      } finally {
        setLoadingUnidades(false);
      }
    };
    fetchGrupos();
    fetchUnidades();
  }, []);

  // Fetch params when unidade filter changes
  useEffect(() => {
    fetchParametros();
  }, [fetchParametros]);

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
      if (filtroUnemId && filtroUnemId !== '__todas__') {
        params.set('UNEM_ID', filtroUnemId);
      }

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

      const mapped: Contato[] = rawList
        .filter(r => {
          if (canal === 'email') {
            return !!(r.PESS_EMAIL && r.PESS_EMAIL.trim() && r.PESS_EMAIL.includes('@'));
          } else {
            // whatsapp or sms - need TELE_NUMERO with at least 8 digits
            const num = (r.TELE_NUMERO || '').replace(/\D/g, '');
            if (num.length < 8) return false;
            // Para WhatsApp, validar que é celular: primeiro dígito após DDD deve ser > 6 (7, 8 ou 9)
            if (canal === 'whatsapp') {
              const firstDigit = parseInt(num.charAt(0), 10);
              if (isNaN(firstDigit) || firstDigit <= 6) return false;
            }
            return true;
          }
        })
        .map(r => {
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
            email: r.PESS_EMAIL || '',
            ultimaCompra: (r.DCFS_DATA_NOTA || '').split(' ')[0],
            loja: r.UNEM_FANTASIA || '',
            lojaUrl: r.UNEM_MSG_ASSINATURA || '',
            lojaEndereco: r.UNEM_ENDERECO || '',
            raw: r,
            selected: false,
            sendStatus: 'idle' as SendStatus,
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
  }, [campanhaAtiva, filtroPeriodoIni, filtroPeriodoFim, filtroGrupo, filtroProduto, filtroUnemId, canal]);

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

  // Update send status for a contact by index in the full list
  const updateSendStatus = (contatoNome: string, contatoKey: string, status: SendStatus) => {
    setContatos(prev => prev.map(c => {
      const key = canal === 'email' ? c.email : c.telefone.replace(/\D/g, '');
      if (c.nome === contatoNome && key === contatoKey) return { ...c, sendStatus: status };
      return c;
    }));
  };

  // Resolve address from selected unidade or logged-in unidade
  const resolveEnderecoLoja = (): string => {
    const unem = unidades.find(u => u.unem_Id === filtroUnemId);
    if (unem?.unem_Endereco) return unem.unem_Endereco;
    try {
      const stored = localStorage.getItem('hj_unidade');
      if (stored) {
        const u = JSON.parse(stored);
        return u.unem_Endereco || u.UNEM_ENDERECO || '';
      }
    } catch {}
    return '';
  };

  // Preview message with simulated data
  const enderecoLoja = resolveEnderecoLoja();
  const previewMsg = mensagem
    .replace("{NOME_CLIENTE}", "Sr João Silva")
    .replace("{DATA_ULTIMA_COMPRA}", "15/01/2026")
    .replace("{EMPR}", "Auto Peças Centro")
    .replace("{NOME_LOJA}", "Filial Sul")
    .replace("{URL_LOJA}", "https://loja.exemplo.com")
    .replace("{ENDLOJA}", enderecoLoja || "Rua Exemplo, 123 - Centro")
    .replace(/\\n/g, "\n");

  // Check if message was already sent via API
  const checkJaEnviada = async (tipo: string, fone: string): Promise<boolean> => {
    try {
      const foneLimpo = fone.replace(/\D/g, '');
      const foneConsulta = foneLimpo.startsWith('55') ? foneLimpo : '55' + foneLimpo;
      const now = new Date();
      const dataBr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      const params = new URLSearchParams({ MSWE_TIPO: tipo, MSWE_FONE: foneConsulta, MSWE_DATA: dataBr });
      const { data: result, error } = await supabase.functions.invoke('api-proxy', {
        body: { baseUrl: getBaseUrl(), endpoint: `/getMsgWths?${params.toString()}`, method: 'GET' },
      });
      if (error) return false;
      // Check for MSWE_ENVIADA === "Sim" in response
      if (Array.isArray(result)) {
        return result.some((r: any) => (r.MSWE_ENVIADA || '').trim().toLowerCase() === 'sim');
      }
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        return (result.MSWE_ENVIADA || '').trim().toLowerCase() === 'sim';
      }
      return false;
    } catch {
      return false;
    }
  };

  // Register sent message in API
  const registrarEnvio = async (texto: string, tipo: string, fone: string, enviada: string) => {
    try {
      const storedUnidade = localStorage.getItem('hj_unidade');
      let unemId = '';
      if (storedUnidade) { try { unemId = JSON.parse(storedUnidade).unem_Id || JSON.parse(storedUnidade).UNEM_ID || ''; } catch {} }

      const now = new Date();
      const dataEnvio = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      // Send full phone with country code 55 to avoid truncation
      const foneCompleto = fone.replace(/\D/g, '');
      const foneFinal = foneCompleto.startsWith('55') ? foneCompleto : '55' + foneCompleto;

      await supabase.functions.invoke('api-proxy', {
        body: {
          baseUrl: getBaseUrl(),
          endpoint: '/setMsgWths',
          method: 'POST',
          body: {
            MSWE_ID: '',
            MSWE_MENSAGEM: texto,
            MSWE_TIPO: tipo,
            MSWE_FONE: foneFinal,
            MSWE_DATA: dataEnvio,
            MSWE_ENVIADA: enviada,
            UNEM_ID: unemId,
          },
        },
      });
    } catch (err) {
      console.error('Erro ao registrar envio:', err);
    }
  };

  // Sync component state with background sending state
  useEffect(() => {
    const syncFromBg = () => {
      if (bgSend.active) {
        setSending(true);
        setSendProgress({ current: bgSend.progress.current, total: bgSend.progress.total });
        setContatos(prev => {
          // Merge statuses from bgSend.contatos into current contatos
          const bgMap = new Map<string, SendStatus>();
          bgSend.contatos.forEach(c => {
            const key = c.email || c.telefone.replace(/\D/g, '');
            bgMap.set(`${c.nome}_${key}`, c.sendStatus);
          });
          return prev.map(c => {
            const key = canal === 'email' ? c.email : c.telefone.replace(/\D/g, '');
            const bgStatus = bgMap.get(`${c.nome}_${key}`);
            if (bgStatus && bgStatus !== c.sendStatus) return { ...c, sendStatus: bgStatus };
            return c;
          });
        });
      } else if (sending && !bgSend.active) {
        // Background finished while we're mounted
        setSending(false);
        const p = bgSend.progress;
        let msg = `${p.enviados} mensagem(ns) enviada(s)`;
        if (p.pulados > 0) msg += `, ${p.pulados} já enviada(s)`;
        if (p.erros > 0) msg += `, ${p.erros} erro(s)`;
        if (p.erros > 0) toast.error(msg); else toast.success(msg);
      }
    };

    // Initial sync on mount
    syncFromBg();

    // Subscribe to updates
    bgSend.listeners.add(syncFromBg);
    return () => { bgSend.listeners.delete(syncFromBg); };
  }, [canal, sending]);

  // Send messages in batched background mode
  const enviarMensagens = async () => {
    const selecionados = contatos.filter(c => c.selected);
    if (selecionados.length === 0) {
      toast.warning("Selecione ao menos um destinatário");
      return;
    }

    if (bgSend.active) {
      toast.warning("Já existe um envio em andamento");
      return;
    }

    // Validate provider config
    if (canal === 'whatsapp' || canal === 'sms') {
      if (!whatsProvider) {
        toast.error("Provedor WhatsApp não configurado. Verifique o parâmetro SERVIDORWHATS para esta unidade.");
        return;
      }
      if (!whatsToken) {
        toast.error("Token WhatsApp não configurado. Verifique o parâmetro TOKENWHATS para esta unidade.");
        return;
      }
      if (whatsProvider === 'BrasilAPI' && !whatsDevice) {
        toast.error("DeviceToken não configurado. Verifique o parâmetro DEVICEWHATS para esta unidade.");
        return;
      }
    }
    if (canal === 'email') {
      if (!emailServidor || !emailEndereco) {
        toast.error("Configuração de e-mail incompleta. Verifique os parâmetros ServidorEmail e EnderecoEmail.");
        return;
      }
    }

    // Capture current config for background use
    const bgCanal = canal;
    const bgMensagem = mensagem;
    const bgImagemUrl = imagemUrl;
    const bgWhatsProvider = whatsProvider;
    const bgWhatsToken = whatsToken;
    const bgWhatsDevice = whatsDevice;
    const bgWhatsPhoneNumberId = whatsPhoneNumberId;
    const bgEmailSenha = emailSenha;
    const bgEmailServidor = emailServidor;
    const bgEmailPorta = emailPorta;
    const bgEmailSsl = emailSsl;
    const bgEmailEndereco = emailEndereco;
    const bgCampanhaAtiva = campanhaAtiva;
    const bgEnderecoLoja = enderecoLoja;
    const msweTipo = getMswaTipo(bgCampanhaAtiva);

    // Initialize background state
    bgSend.active = true;
    bgSend.contatos = selecionados.map(c => ({ ...c }));
    bgSend.progress = { current: 0, total: selecionados.length, enviados: 0, erros: 0, pulados: 0 };

    setSending(true);
    setSendProgress({ current: 0, total: selecionados.length });
    toast.info(`Iniciando envio escalonado de ${selecionados.length} mensagem(ns)...`);
    notifyBgListeners();

    // Run in background (detached from component lifecycle)
    (async () => {
      let processados = 0;
      let batchIndex = 0;
      let delayIndex = 0;

      // Split into batches of BATCH_SIZE
      const batches: Contato[][] = [];
      for (let i = 0; i < bgSend.contatos.length; i += BATCH_SIZE) {
        batches.push(bgSend.contatos.slice(i, i + BATCH_SIZE));
      }

      for (const batch of batches) {
        // Wait between batches (not before first)
        if (batchIndex > 0) {
          const delay = BATCH_DELAYS[delayIndex % BATCH_DELAYS.length];
          console.log(`Aguardando ${delay / 1000}s antes do próximo lote...`);
          await sleep(delay);
          delayIndex++;
        }

        for (const contato of batch) {
          const bgIdx = bgSend.contatos.findIndex(c => c.nome === contato.nome && 
            ((bgCanal === 'email' ? c.email : c.telefone.replace(/\D/g, '')) === 
             (bgCanal === 'email' ? contato.email : contato.telefone.replace(/\D/g, ''))));

          try {
            if (bgCanal === 'email') {
              const emailDest = contato.email;
              if (!emailDest) { bgSend.progress.erros++; continue; }

              const storedUnidade = localStorage.getItem('hj_unidade');
              let emprNome = '';
              if (storedUnidade) { try { emprNome = JSON.parse(storedUnidade).unem_Fantasia || ''; } catch {} }
              const nomeComTratamento = contato.tratamento ? `${contato.tratamento} ${contato.nome}` : contato.nome;
              const texto = bgMensagem
                .replace("{NOME_CLIENTE}", nomeComTratamento)
                .replace("{DATA_ULTIMA_COMPRA}", contato.ultimaCompra || "")
                .replace("{EMPR}", emprNome)
                .replace("{NOME_LOJA}", contato.loja || "")
                .replace("{URL_LOJA}", contato.lojaUrl || "")
                .replace("{ENDLOJA}", contato.lojaEndereco || bgEnderecoLoja || "")
                .replace(/\\n/g, "\n");

              // Check if already sent
              const jaEnviada = await checkJaEnviada(msweTipo, emailDest);
              if (jaEnviada) {
                if (bgIdx >= 0) bgSend.contatos[bgIdx].sendStatus = 'skipped';
                bgSend.progress.pulados++;
                processados++;
                bgSend.progress.current = processados;
                notifyBgListeners();
                continue;
              }

              const payload = {
                provider: 'Email' as const,
                token: bgEmailSenha,
                number: '',
                text: texto,
                emailTo: emailDest,
                emailFrom: bgEmailEndereco,
                emailSubject: `${bgCampanhaAtiva} - ${emprNome}`,
                smtpServer: bgEmailServidor,
                smtpPort: bgEmailPorta,
                smtpSsl: bgEmailSsl,
                smtpPassword: bgEmailSenha,
              };

              const { error } = await supabase.functions.invoke('send-message', { body: payload });
              if (error) {
                await registrarEnvio(texto, msweTipo, emailDest, "Nao");
                if (bgIdx >= 0) bgSend.contatos[bgIdx].sendStatus = 'error';
                bgSend.progress.erros++;
              } else {
                await registrarEnvio(texto, msweTipo, emailDest, "Sim");
                if (bgIdx >= 0) bgSend.contatos[bgIdx].sendStatus = 'sent';
                bgSend.progress.enviados++;
              }
            } else {
              // WhatsApp / SMS
              const phone = contato.telefone.replace(/\D/g, "");
              if (!phone) { bgSend.progress.erros++; continue; }

              // Check if already sent via API
              const jaEnviada = await checkJaEnviada(msweTipo, phone);
              if (jaEnviada) {
                if (bgIdx >= 0) bgSend.contatos[bgIdx].sendStatus = 'skipped';
                bgSend.progress.pulados++;
                processados++;
                bgSend.progress.current = processados;
                notifyBgListeners();
                continue;
              }

              const storedUnidade = localStorage.getItem('hj_unidade');
              let emprNome = '';
              if (storedUnidade) { try { emprNome = JSON.parse(storedUnidade).unem_Fantasia || ''; } catch {} }
              const nomeComTratamento = contato.tratamento ? `${contato.tratamento} ${contato.nome}` : contato.nome;
              const texto = bgMensagem
                .replace("{NOME_CLIENTE}", nomeComTratamento)
                .replace("{DATA_ULTIMA_COMPRA}", contato.ultimaCompra || "")
                .replace("{EMPR}", emprNome)
                .replace("{NOME_LOJA}", contato.loja || "")
                .replace("{URL_LOJA}", contato.lojaUrl || "")
                .replace("{ENDLOJA}", contato.lojaEndereco || bgEnderecoLoja || "")
                .replace(/\\n/g, "\n");

              const payload: any = {
                provider: bgWhatsProvider,
                token: bgWhatsToken,
                number: phone,
                text: texto,
              };

              if (bgWhatsProvider === 'BrasilAPI') payload.device = bgWhatsDevice;
              if (bgWhatsProvider === 'WhatsAppOficial') payload.phoneNumberId = bgWhatsPhoneNumberId;

              if (bgImagemUrl) {
                payload.type = "media";
                payload.mediaType = "image";
                payload.file = bgImagemUrl;
              } else {
                payload.type = "text";
              }

              console.log('=== ENVIO MARKETING ===', JSON.stringify(payload, null, 2));

              const { data: respData, error } = await supabase.functions.invoke('send-message', { body: payload });

              if (error) {
                console.error('Erro envio:', error);
                await registrarEnvio(texto, msweTipo, phone, "Nao");
                if (bgIdx >= 0) bgSend.contatos[bgIdx].sendStatus = 'error';
                bgSend.progress.erros++;
              } else if (respData && respData.success === false) {
                console.error('Erro envio (API):', respData);
                await registrarEnvio(texto, msweTipo, phone, "Nao");
                if (bgIdx >= 0) bgSend.contatos[bgIdx].sendStatus = 'error';
                bgSend.progress.erros++;
              } else {
                await registrarEnvio(texto, msweTipo, phone, "Sim");
                if (bgIdx >= 0) bgSend.contatos[bgIdx].sendStatus = 'sent';
                bgSend.progress.enviados++;
              }
            }
          } catch (err: any) {
            console.error('Erro envio:', err);
            if (bgIdx >= 0) bgSend.contatos[bgIdx].sendStatus = 'error';
            bgSend.progress.erros++;
          }
          processados++;
          bgSend.progress.current = processados;
          notifyBgListeners();
        }
        batchIndex++;
      }

      // Done
      bgSend.active = false;
      notifyBgListeners();
    })();
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
        <div className="flex items-center gap-3">
          {whatsProvider && (
            <Badge variant="outline" className="text-[9px] px-2 py-0.5 gap-1">
              <MessageSquare className="h-3 w-3" />
              {whatsProvider}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs px-3 py-1 gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {selectedCount} selecionado(s)
          </Badge>
        </div>
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
              <div className="flex items-center gap-4 mt-4">
                <Button size="sm" onClick={gerarLista} disabled={loading} className="gap-1.5">
                  {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Gerar Lista
                </Button>
                <div className="flex items-center gap-2">
                  <Label className="text-[9px] text-muted-foreground whitespace-nowrap">Unidade:</Label>
                  <Select value={filtroUnemId} onValueChange={setFiltroUnemId}>
                    <SelectTrigger className="h-7 text-[10px] w-[200px]">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__todas__" className="text-xs">Todas as Unidades</SelectItem>
                      {unidades.map(u => (
                        <SelectItem key={u.unem_Id} value={u.unem_Id} className="text-xs">{u.unem_Fantasia}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-8 text-center">#</TableHead>
                        <TableHead className="text-[10px]">Cliente</TableHead>
                        {canal === 'email' ? (
                          <TableHead className="text-[10px]">E-mail</TableHead>
                        ) : (
                          <TableHead className="text-[10px]">Telefone</TableHead>
                        )}
                        <TableHead className="text-[10px]">Última Compra</TableHead>
                        <TableHead className="text-[10px]">Loja</TableHead>
                        <TableHead className="w-8 text-center text-[10px]">Status</TableHead>
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
                          {canal === 'email' ? (
                            <TableCell className="text-[10px] text-muted-foreground">{c.email || "—"}</TableCell>
                          ) : (
                            <TableCell className="text-[10px] text-muted-foreground">{c.telefone || "—"}</TableCell>
                          )}
                          <TableCell className="text-[10px]">{c.ultimaCompra || "—"}</TableCell>
                          <TableCell className="text-[10px]">{c.loja || "—"}</TableCell>
                          <TableCell className="text-center">
                            {c.sendStatus === 'sent' && <span className="text-blue-500 text-sm tracking-tighter" aria-label="Enviado">✓✓</span>}
                            {c.sendStatus === 'error' && <span className="text-destructive text-sm" aria-label="Erro">✗</span>}
                            {c.sendStatus === 'skipped' && <span className="text-muted-foreground text-sm tracking-tighter" aria-label="Já enviado anteriormente">✓✓</span>}
                            {c.sendStatus === 'idle' && <span className="text-muted-foreground/40 text-sm" aria-label="Pendente">🕐</span>}
                          </TableCell>
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
          {/* Provider Info */}
          {loadingParams && (
            <Card className="border-border/60">
              <CardContent className="py-3 flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Carregando configurações...
              </CardContent>
            </Card>
          )}

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
              <div className={`rounded-xl p-4 border ${canal === 'email' ? 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200/50 dark:border-blue-800/30' : 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 border-green-200/50 dark:border-green-800/30'}`}>
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
                {canal !== 'email' && whatsProvider && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Provedor</span>
                    <Badge variant="outline" className="text-[9px]">{whatsProvider}</Badge>
                  </div>
                )}
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
                {sending ? `Enviando...` : `Enviar ${canal === 'email' ? 'E-mails' : 'Mensagens'} (${selectedCount})`}
              </Button>
              {sending && sendProgress.total > 0 && (
                <div className="space-y-1.5">
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300 rounded-full"
                      style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center font-medium">
                    {sendProgress.current} de {sendProgress.total} processadas
                  </p>
                  <div className="flex justify-center gap-3 text-[9px]">
                    <span className="text-blue-500">✓✓ {bgSend.progress.enviados}</span>
                    <span className="text-muted-foreground">⏭ {bgSend.progress.pulados}</span>
                    <span className="text-destructive">✗ {bgSend.progress.erros}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
