// ============================================================================
// TEF (Transferência Eletrônica de Fundos) — Arquitetura desacoplada
// ----------------------------------------------------------------------------
// Suporta múltiplos provedores chamando diretamente as APIs LOCAIS dos agentes
// TEF instalados na máquina do operador (sem passar pelo backend):
//
//   - PayGo Web        ->  http://127.0.0.1:9999
//   - TEF Elgin (E1)   ->  http://127.0.0.1:2500
//   - CliSiTef WS      ->  http://127.0.0.1:60906
//   - Cappta SDK Web   ->  http://127.0.0.1:8090
//   - TEF ID (SwExp)   ->  http://127.0.0.1:4242
//   - Stone (Genius)   ->  http://127.0.0.1:8087
//   - GetNet (Lio)     ->  http://127.0.0.1:3030
//
// Cada provedor implementa a interface ITefProvider. Se a agente local não
// estiver disponível, cai automaticamente em modo "simulado" para permitir
// testes em desenvolvimento.
//
// Status em tempo real é emitido via TefBus (event emitter) — a UI assina
// para mostrar mensagens do PinPad ("INSIRA CARTÃO", "DIGITE A SENHA", etc.).
// ============================================================================

export type TefProvider =
  | 'paygo'
  | 'tef-id'
  | 'cappta'
  | 'clisitef'
  | 'sw-express' // alias legado
  | 'elgin'
  | 'stone'
  | 'getnet'
  | 'simulado';

export type TipoCartao = 'credito' | 'debito';
export type TefOperacao = 'venda' | 'cancelamento' | 'administrativa';

export type TefFase =
  | 'iniciando'
  | 'aguardando_pinpad'
  | 'insira_cartao'
  | 'digitando_senha'
  | 'processando'
  | 'aprovado'
  | 'negado'
  | 'cancelado'
  | 'erro'
  | 'timeout';

export interface TefRequest {
  provider: TefProvider;
  operacao?: TefOperacao;
  tipo: TipoCartao;
  valor: number;
  parcelas: number;
  documento?: string; // nº venda / pedido
  pdv?: string;
  operador?: string;
  timeoutMs?: number; // default 120000
}

export interface TefResultado {
  ok: boolean;
  cancelado?: boolean;
  mensagem?: string;
  nsu?: string;
  autorizacao?: string;
  bandeira?: string;
  adquirente?: string;
  rede?: string;
  parcelas?: number;
  valor?: number;
  dataHora?: string; // ISO
  comprovanteCliente?: string;
  comprovanteEstabelecimento?: string;
  raw?: any;
}

export interface TefStatusEvent {
  fase: TefFase;
  mensagem: string;
  provider: TefProvider;
  ts: number;
}

// ============================================================================
// Event bus — UI assina aqui para receber mensagens do PinPad em tempo real
// ============================================================================
type Listener = (ev: TefStatusEvent) => void;

class TefEventBus {
  private listeners = new Set<Listener>();
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(ev: TefStatusEvent) {
    // Log completo da integração
    console.log('[TEF]', ev.provider, ev.fase, '-', ev.mensagem);
    this.listeners.forEach((l) => {
      try { l(ev); } catch { /* noop */ }
    });
  }
}
export const TefBus = new TefEventBus();
const emit = (provider: TefProvider, fase: TefFase, mensagem: string) =>
  TefBus.emit({ provider, fase, mensagem, ts: Date.now() });

// ============================================================================
// Provider selection (persistido em localStorage)
// ============================================================================
const TEF_PROVIDER_KEY = 'tef_provider';
export function getTefProvider(): TefProvider {
  return (localStorage.getItem(TEF_PROVIDER_KEY) as TefProvider) || 'simulado';
}
export function setTefProvider(p: TefProvider) {
  localStorage.setItem(TEF_PROVIDER_KEY, p);
}

// ============================================================================
// Persistência de transações pendentes (reprocessamento seguro)
// ============================================================================
const TEF_PENDING_KEY = 'tef_pending';
export interface TefPending {
  id: string;
  request: TefRequest;
  createdAt: number;
}
export function listTefPending(): TefPending[] {
  try { return JSON.parse(localStorage.getItem(TEF_PENDING_KEY) || '[]'); } catch { return []; }
}
function savePending(p: TefPending) {
  const list = listTefPending();
  list.push(p);
  localStorage.setItem(TEF_PENDING_KEY, JSON.stringify(list));
}
function removePending(id: string) {
  const list = listTefPending().filter((x) => x.id !== id);
  localStorage.setItem(TEF_PENDING_KEY, JSON.stringify(list));
}

// ============================================================================
// Interface padrão (contrato dos provedores)
// ============================================================================
export interface ITefProvider {
  readonly name: TefProvider;
  iniciarPagamento(req: TefRequest, signal?: AbortSignal): Promise<TefResultado>;
  cancelarTransacao(nsu: string): Promise<boolean>;
  imprimirComprovante?(dados: TefResultado): Promise<void>;
}

// ============================================================================
// Utilitário: fetch com timeout + abort
// ============================================================================
async function tryAgent<T>(url: string, body?: any, timeoutMs = 5000): Promise<T | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    return (ct.includes('json') ? await res.json() : (await res.text() as any)) as T;
  } catch {
    return null;
  }
}

// ============================================================================
// Simulação (fallback dev) — também usada quando agente local não responde
// ============================================================================
async function simular(req: TefRequest): Promise<TefResultado> {
  emit(req.provider, 'iniciando', 'Iniciando transação (simulado)');
  await sleep(300);
  emit(req.provider, 'aguardando_pinpad', 'Aguardando PinPad');
  await sleep(500);
  emit(req.provider, 'insira_cartao', 'Insira / aproxime o cartão');
  await sleep(900);
  emit(req.provider, 'digitando_senha', 'Digite a senha no PinPad');
  await sleep(900);
  emit(req.provider, 'processando', 'Processando transação...');
  await sleep(900);
  if (Math.random() < 0.05) {
    emit(req.provider, 'negado', 'Transação negada');
    return { ok: false, mensagem: 'Transação negada pela operadora' };
  }
  const nsu = String(Math.floor(Math.random() * 9_000_000) + 1_000_000);
  const aut = String(Math.floor(Math.random() * 900_000) + 100_000);
  emit(req.provider, 'aprovado', `Aprovado • NSU ${nsu}`);
  return {
    ok: true,
    nsu,
    autorizacao: aut,
    bandeira: 'VISA',
    adquirente: req.provider.toUpperCase(),
    rede: req.provider.toUpperCase(),
    parcelas: req.parcelas,
    valor: req.valor,
    dataHora: new Date().toISOString(),
    comprovanteCliente:
      `COMPROVANTE TEF (${req.provider.toUpperCase()} • SIMULADO)\n` +
      `NSU ${nsu} • AUT ${aut}\n` +
      `Valor R$ ${req.valor.toFixed(2)} • ${req.parcelas}x`,
  };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// Provider genérico baseado em agente HTTP local
// ============================================================================
interface AgentSpec {
  name: TefProvider;
  baseUrl: string;
  endpointVenda: string;
  endpointCancel?: string;
  buildPayload: (req: TefRequest) => any;
  parseResponse: (data: any) => Partial<TefResultado>;
}

function makeAgentProvider(spec: AgentSpec): ITefProvider {
  return {
    name: spec.name,
    async iniciarPagamento(req, signal) {
      emit(spec.name, 'iniciando', `Conectando ao agente ${spec.name} (${spec.baseUrl})...`);
      const pending: TefPending = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, request: req, createdAt: Date.now() };
      savePending(pending);
      const timeoutMs = req.timeoutMs ?? 120_000;

      // 1) Probe rápida no agente local
      emit(spec.name, 'aguardando_pinpad', 'Aguardando PinPad...');
      const probe = await tryAgent(spec.baseUrl, undefined, 1500);
      if (probe === null) {
        emit(spec.name, 'erro', `Agente ${spec.name} não respondeu em ${spec.baseUrl}. Verifique se o agente TEF local está em execução.`);
        removePending(pending.id);
        return {
          ok: false,
          provider: spec.name,
          mensagem: `Agente TEF ${spec.name} não está disponível em ${spec.baseUrl}. Inicie o agente local e tente novamente.`,
        };
      }

      // 2) Inicia venda
      try {
        emit(spec.name, 'insira_cartao', 'Insira / aproxime o cartão');
        const ctl = new AbortController();
        const to = setTimeout(() => ctl.abort(), timeoutMs);
        signal?.addEventListener('abort', () => ctl.abort());

        const url = spec.baseUrl + spec.endpointVenda;
        const payload = spec.buildPayload(req);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ctl.signal,
        });
        clearTimeout(to);
        if (!res.ok) {
          emit(spec.name, 'erro', `Agente respondeu HTTP ${res.status}`);
          removePending(pending.id);
          return { ok: false, mensagem: `Agente ${spec.name} HTTP ${res.status}` };
        }
        const data = await res.json().catch(() => ({}));
        const parsed = spec.parseResponse(data);
        removePending(pending.id);
        if (parsed.ok) {
          emit(spec.name, 'aprovado', `Aprovado • NSU ${parsed.nsu || '-'}`);
          return {
            valor: req.valor,
            parcelas: req.parcelas,
            adquirente: spec.name.toUpperCase(),
            dataHora: new Date().toISOString(),
            ...parsed,
            ok: true,
          };
        }
        emit(spec.name, 'negado', parsed.mensagem || 'Transação negada');
        return { ok: false, mensagem: parsed.mensagem || 'Não aprovada', raw: data };
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          emit(spec.name, 'timeout', 'Timeout — tempo esgotado');
          return { ok: false, mensagem: 'Timeout TEF' };
        }
        emit(spec.name, 'erro', e?.message || 'Erro desconhecido');
        return { ok: false, mensagem: e?.message || 'Erro TEF' };
      }
    },
    async cancelarTransacao(nsu) {
      if (!spec.endpointCancel) return false;
      try {
        const res = await fetch(spec.baseUrl + spec.endpointCancel, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nsu }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}

// ============================================================================
// Especificações dos provedores
// ============================================================================
const PROVIDERS: Record<TefProvider, ITefProvider> = {
  paygo: makeAgentProvider({
    name: 'paygo',
    baseUrl: 'http://127.0.0.1:9999',
    endpointVenda: '/payment',
    endpointCancel: '/cancelment',
    buildPayload: (r) => ({
      operation: r.tipo === 'credito' ? 'CREDIT' : 'DEBIT',
      amount: Math.round(r.valor * 100),
      installments: r.parcelas,
      orderId: r.documento,
      operatorId: r.operador,
    }),
    parseResponse: (d) => ({
      ok: d?.result === 'AUTHORIZED' || d?.status === 'APPROVED',
      nsu: d?.nsu || d?.atk,
      autorizacao: d?.authorizationCode || d?.codigoAutorizacao,
      bandeira: d?.brand || d?.bandeira,
      rede: d?.acquirer || d?.adquirente,
      mensagem: d?.message || d?.mensagem,
      comprovanteCliente: d?.customerReceipt,
      comprovanteEstabelecimento: d?.merchantReceipt,
    }),
  }),
  'tef-id': makeAgentProvider({
    name: 'tef-id',
    baseUrl: 'http://127.0.0.1:4242',
    endpointVenda: '/v1/payment',
    endpointCancel: '/v1/cancel',
    buildPayload: (r) => ({
      modalidade: r.tipo === 'credito' ? 3 : 2,
      valor: r.valor.toFixed(2),
      parcelas: r.parcelas,
      cupomFiscal: r.documento,
    }),
    parseResponse: (d) => ({
      ok: !!d?.aprovado || d?.status === 0,
      nsu: d?.nsu,
      autorizacao: d?.codigoAutorizacao,
      bandeira: d?.bandeira,
      rede: d?.rede,
      mensagem: d?.mensagem,
      comprovanteCliente: d?.viaCliente,
      comprovanteEstabelecimento: d?.viaEstabelecimento,
    }),
  }),
  cappta: makeAgentProvider({
    name: 'cappta',
    baseUrl: 'http://127.0.0.1:8090',
    endpointVenda: '/v2/payments',
    endpointCancel: '/v2/payments/cancel',
    buildPayload: (r) => ({
      paymentType: r.tipo === 'credito' ? 'CreditCard' : 'DebitCard',
      amount: Math.round(r.valor * 100),
      installments: r.parcelas,
      reference: r.documento,
    }),
    parseResponse: (d) => ({
      ok: d?.status === 'Approved' || d?.approved === true,
      nsu: d?.nsu,
      autorizacao: d?.authorizationCode,
      bandeira: d?.cardBrand,
      rede: d?.acquirer,
      mensagem: d?.message,
    }),
  }),
  clisitef: makeAgentProvider({
    name: 'clisitef',
    baseUrl: 'http://127.0.0.1:60906',
    endpointVenda: '/clisitef/iniciarFuncao',
    endpointCancel: '/clisitef/cancelar',
    buildPayload: (r) => ({
      funcao: r.tipo === 'credito' ? 3 : 2,
      valor: r.valor.toFixed(2),
      cupomFiscal: r.documento,
      operador: r.operador,
    }),
    parseResponse: (d) => ({
      ok: d?.serviceStatus === 0 || d?.aprovado === true,
      nsu: d?.nsuSitef || d?.nsu,
      autorizacao: d?.codigoAutorizacao,
      bandeira: d?.bandeira,
      rede: d?.rede,
      mensagem: d?.mensagem,
      comprovanteCliente: d?.comprovanteCliente,
      comprovanteEstabelecimento: d?.comprovanteEstabelecimento,
    }),
  }),
  'sw-express': makeAgentProvider({
    name: 'sw-express',
    baseUrl: 'http://127.0.0.1:60906',
    endpointVenda: '/clisitef/iniciarFuncao',
    buildPayload: (r) => ({ funcao: r.tipo === 'credito' ? 3 : 2, valor: r.valor.toFixed(2) }),
    parseResponse: (d) => ({
      ok: d?.serviceStatus === 0,
      nsu: d?.nsuSitef,
      autorizacao: d?.codigoAutorizacao,
      bandeira: d?.bandeira,
      mensagem: d?.mensagem,
    }),
  }),
  elgin: makeAgentProvider({
    name: 'elgin',
    baseUrl: 'http://127.0.0.1:2500',
    endpointVenda: '/tef/venda',
    endpointCancel: '/tef/cancelar',
    buildPayload: (r) => ({
      tipo: r.tipo === 'credito' ? 'CREDITO' : 'DEBITO',
      valor: Math.round(r.valor * 100),
      parcelas: r.parcelas,
      documento: r.documento,
    }),
    parseResponse: (d) => ({
      ok: d?.status === 'APROVADO' || d?.aprovado,
      nsu: d?.nsu,
      autorizacao: d?.codigoAutorizacao,
      bandeira: d?.bandeira,
      rede: d?.rede,
      mensagem: d?.mensagem,
    }),
  }),
  stone: makeAgentProvider({
    name: 'stone',
    baseUrl: 'http://127.0.0.1:8087',
    endpointVenda: '/api/payments',
    endpointCancel: '/api/payments/cancel',
    buildPayload: (r) => ({
      paymentMethod: r.tipo === 'credito' ? 'credit' : 'debit',
      amount: Math.round(r.valor * 100),
      installments: r.parcelas,
      orderId: r.documento,
    }),
    parseResponse: (d) => ({
      ok: d?.status === 'approved',
      nsu: d?.nsu || d?.atk,
      autorizacao: d?.authorizationCode,
      bandeira: d?.brand,
      rede: 'STONE',
      mensagem: d?.message,
    }),
  }),
  getnet: makeAgentProvider({
    name: 'getnet',
    baseUrl: 'http://127.0.0.1:3030',
    endpointVenda: '/v1/lio/payment',
    endpointCancel: '/v1/lio/cancel',
    buildPayload: (r) => ({
      type: r.tipo === 'credito' ? 'CREDIT' : 'DEBIT',
      amount: Math.round(r.valor * 100),
      installments: r.parcelas,
      orderId: r.documento,
    }),
    parseResponse: (d) => ({
      ok: d?.status === 'CONFIRMED',
      nsu: d?.nsu,
      autorizacao: d?.authorizationCode,
      bandeira: d?.brand,
      rede: 'GETNET',
      mensagem: d?.message,
    }),
  }),
  simulado: {
    name: 'simulado',
    async iniciarPagamento(req) { return simular(req); },
    async cancelarTransacao() { return true; },
  },
};

// ============================================================================
// API pública
// ============================================================================
export function getTefProviderImpl(p: TefProvider): ITefProvider {
  return PROVIDERS[p] || PROVIDERS.simulado;
}

export async function iniciarTransacaoTef(req: TefRequest, signal?: AbortSignal): Promise<TefResultado> {
  const impl = getTefProviderImpl(req.provider);
  return impl.iniciarPagamento(req, signal);
}

export async function cancelarTransacaoTef(provider: TefProvider, nsu: string): Promise<boolean> {
  return getTefProviderImpl(provider).cancelarTransacao(nsu);
}

// Som opcional (sucesso/erro) — Web Audio API, sem assets
export function playTefSound(kind: 'success' | 'error') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    if (kind === 'success') {
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
    } else {
      o.frequency.setValueAtTime(220, ctx.currentTime);
      o.frequency.setValueAtTime(165, ctx.currentTime + 0.18);
    }
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch { /* noop */ }
}
