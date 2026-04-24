import { supabase } from '@/integrations/supabase/client';
import { getApiBaseUrl } from '@/lib/base-url';

function getBaseUrl(): string {
  return getApiBaseUrl();
}

async function proxyGet<T>(endpoint: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke('api-proxy', {
    body: { baseUrl: getBaseUrl(), endpoint, method: 'GET' },
  });
  if (error) throw new Error(`API error: ${error.message}`);
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  return JSON.parse(text) as T;
}

async function proxyPost<T>(endpoint: string, payload: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke('api-proxy', {
    body: { baseUrl: getBaseUrl(), endpoint, method: 'POST', body: payload },
  });
  if (error) throw new Error(`API error: ${error.message}`);
  // Handle non-JSON string responses (e.g. plain text error messages from backend)
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as T;
    } catch {
      throw new Error(data);
    }
  }
  return data as T;
}

// ===== Types =====

export interface TipoOS {
  TPOS_ID: string;
  TPOS_NOME: string;
  TPOS_PADRAO?: string;
}

export interface Cliente {
  PESS_ID: string;
  PESS_NOME: string;
  PESS_CPFCNPJ: string;
  PESS_FONE?: string;
  PESS_FONE_CELULAR?: string;
  PESS_EMAIL?: string;
  PESS_ENDERECO?: string;
  PESS_CIDADE?: string;
  PESS_UF?: string;
  PESS_FISICO_JURIDICO?: 'F' | 'J';
  PESS_TIPO?: 'F' | 'J';
  PESS_RAZAO_SOCIAL?: string;
  PESS_DATA_CADASTRO?: string;
  PESS_DATA_NASCIMENTO?: string;
  PESS_SEXO?: string;
  // Address fields
  ENDE_TIPO_LOGRADOURO?: string;
  ENDE_LOGRADOURO?: string;
  ENDE_NUMERO?: string;
  ENDE_COMPLEMENTO?: string;
  ENDE_CEP?: string;
  ENDE_ZONA?: string;
  ENDE_OBSERVACAO?: string;
  ESTA_NOME?: string;
  ESTA_UF?: string;
  BAIR_NOME?: string;
  MUNI_NOME?: string;
  // Document fields
  DOCS_IE?: string;
  DOCS_RG?: string;
  DOCS_ICMUNI?: string;
}

export interface Veiculo {
  VEIC_ID: string;
  VEIC_PLACA: string;
  VEIC_MARCA?: string;
  VEIC_MODELO?: string;
  VEIC_ANO?: string;
  VEIC_COR?: string;
  VEIC_KM?: string;
  PESS_ID?: string;
  MARC_VEIC_ID?: string;
  MODL_VEIC_ID?: string;
}

export interface MarcaVeiculo {
  MARC_VEIC_ID: string;
  MARC_VEIC_NOME: string;
}

export interface ModeloVeiculo {
  MODL_VEIC_ID: string;
  MODL_VEIC_NOME: string;
}

export interface ItemOS {
  ITOS_ID?: string;
  ITRQ_ID?: string;
  ORSV_ID?: string;
  ITOS_TIPO: 'P' | 'S'; // Produto | Serviço
  ITOS_DESCRICAO: string;
  ITOS_QTDE: number;
  ITOS_VLR_UNITARIO: number;
  ITOS_DESCONTO: number;
  ITOS_VLR_TOTAL: number;
  ITOS_SALDO_ESTOQUE?: number;
  ITOS_UNIDADE_MEDIDA?: string;
  ITRQ_PRECO_TABELA?: number;
  ITRQ_VLR_DESCONTO_SOBRE_TOTAL?: number;
  PROD_ID?: string;        // ID real do produto (PROD_ID da ConsultaEstoque)
  PROD_CODIGO?: string;    // Código visível ao usuário
}

export interface Vendedor {
  VDDR_ID: string;
  VDDR_NOME: string;
}

export interface Tecnico {
  TCNC_ID: string;
  TCNC_NOME: string;
}

export interface Midia {
  MDIA_ID: string;
  MDIA_NOME: string;
}

export interface OrdemServicoFull {
  ORSV_ID?: string;
  ORSV_NUMERO?: string;
  ORSV_DATA?: string;
  ORSV_STATUS?: string;
  TPOS_ID?: string;
  PESS_ID?: string;
  VEIC_ID?: string;
  VDDR_ID?: string;
  TCNC_ID?: string;
  MDIA_ID?: string;
  USRS_ID?: string;
  ORSV_OBSERVACOES?: string;
  ORSV_NR_CHECKLIST?: string;
  ORSV_VLR_SUBTOTAL?: number;
  ORSV_VLR_DESCONTO?: number;
  ORSV_VLR_DESCONTO_SERVICO?: number;
  ORSV_VLR_TOTAL?: number;
  ORSV_HODOMETRO?: string;
  UNEM_ID?: string;
  itens?: ItemOS[];
}

// ===== Municipios & Bairros =====

export interface Municipio {
  MUNI_ID?: string;
  MUNI_NOME: string;
}

export interface Bairro {
  BAIR_ID?: string;
  BAIR_NOME: string;
}

export const getMunicipios = (params: { uf: string; nome_muni?: string }) => {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return proxyGet<Municipio[]>(`/getMunicipios?${query}`);
};

export const getBairros = (params: { uf: string; nome_muni: string; nome?: string }) => {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return proxyGet<Bairro[]>(`/getBairros?${query}`);
};

// ===== API Calls =====

export const getTiposOrdemServicos = () =>
  proxyGet<TipoOS[]>('/getTiposOrdemServicos');

// Normaliza chaves de objetos retornados pela API (Java serializa em camelCase: pESS_NOME, eNDE_LOGRADOURO)
// para UPPERCASE consistente esperado pelo front (PESS_NOME, ENDE_LOGRADOURO).
function normalizeApiKeys<T = any>(input: any): T {
  if (Array.isArray(input)) return input.map((i) => normalizeApiKeys(i)) as any;
  if (!input || typeof input !== 'object') return input;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input)) {
    // Se a chave parece ter padrão "xXXX_..." (1ª minúscula seguida de UPPER), uppercaseia tudo
    const upperKey = /^[a-z][A-Z]/.test(k) ? k.toUpperCase() : k;
    // Mantém também a chave original como fallback (não sobrescreve UPPERCASE existente)
    if (out[upperKey] == null || out[upperKey] === '') {
      out[upperKey] = v;
    }
  }
  return out as T;
}

export const getClientes = async (params: { id?: string; nome?: string; cpfcnpj?: string }) => {
  // Sanitiza CPF/CNPJ removendo máscara (a API legada filtra apenas por dígitos)
  const cleanParams = { ...params };
  if (cleanParams.cpfcnpj) cleanParams.cpfcnpj = cleanParams.cpfcnpj.replace(/\D/g, '');

  const query = Object.entries(cleanParams)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  const raw = await proxyGet<any>(`/getClientes?${query}`);
  // API às vezes responde { success, message, rawHtml } quando não há dados
  if (raw && !Array.isArray(raw) && (raw.rawHtml || raw.message === '200 OK')) return [] as Cliente[];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((c) => normalizeApiKeys<Cliente>(c));
};

export const setCliente = (cliente: Partial<Cliente>) =>
  proxyPost<Cliente>('/setClientes', cliente);

export const getVeiculos = (params: { placa?: string; id?: string; pess_id?: string }) => {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return proxyGet<Veiculo[]>(`/getVeiculos?${query}`);
};

export const setVeiculo = (veiculo: Partial<Veiculo>) =>
  proxyPost<Veiculo>('/setVeiculos', veiculo);

export const getMarcasVeiculo = (nome?: string) => {
  const q = nome ? `?nome=${encodeURIComponent(nome)}` : '';
  return proxyGet<MarcaVeiculo[]>(`/getMarcaVeiculo${q}`);
};

export const setMarcaVeiculo = (marca: Partial<MarcaVeiculo>) =>
  proxyPost<MarcaVeiculo>('/setMarcaVeiculo', marca);

export const getModelosVeiculo = (idMarca: string, nome?: string) => {
  let q = `?idMarca=${encodeURIComponent(idMarca)}`;
  if (nome) q += `&nome=${encodeURIComponent(nome)}`;
  return proxyGet<ModeloVeiculo[]>(`/getModelosVeiculo${q}`);
};

export const setModeloVeiculo = (modelo: Partial<ModeloVeiculo & { MARC_VEIC_ID: string }>) =>
  proxyPost<ModeloVeiculo>('/setModelosVeiculo', modelo);

export const getVendedores = (params: { id?: string; nome?: string }) => {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return proxyGet<Vendedor[]>(`/getVendedores?${query}`);
};

export const getTecnicos = (params: { id?: string; nome?: string }) => {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return proxyGet<Tecnico[]>(`/getTecnicos?${query}`);
};

export const getMidias = (params: { id?: string; nome?: string }) => {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return proxyGet<Midia[]>(`/getMidias?${query}`);
};

export const getItensOrdemServicos = (orsvId: string) =>
  proxyGet<ItemOS[]>(`/getItensOrdemServicos?id=${encodeURIComponent(orsvId)}`);

export const getOrdemServicoById = async (orsvId: string, unemId?: string) => {
  // 1) Tenta direto por id
  const tryFetch = async (qs: string) => {
    const raw = await proxyGet<any>(`/getOrdemServicos?${qs}`);
    if (!raw) return null;
    if (Array.isArray(raw)) return raw.length > 0 ? raw[0] : null;
    if (raw.rawHtml || raw.message === '200 OK') return null;
    return raw;
  };

  let detalhe = await tryFetch(`id=${encodeURIComponent(orsvId)}`);

  // 2) Fallback: API legada exige unem_id; busca a lista e filtra pelo ID
  if (!detalhe && unemId) {
    try {
      const listRaw = await proxyGet<any>(`/getOrdemServicos?unem_id=${encodeURIComponent(unemId)}`);
      const list = Array.isArray(listRaw) ? listRaw : [];
      detalhe = list.find((os: any) => {
        const id = os.oRSV_ID || os.ORSV_ID || os.orsv_id;
        return String(id) === String(orsvId);
      }) || null;
    } catch {}
  }

  return detalhe ? (Array.isArray(detalhe) ? detalhe[0] : detalhe) : ({} as Record<string, any>);
};

export const setItensOrdemServicos = (itens: Partial<ItemOS>[]) =>
  proxyPost<unknown>('/setItensOrdemServicos', itens);

export const setOrdemServico = (os: Partial<OrdemServicoFull>) =>
  proxyPost<OrdemServicoFull>('/setOrdemServicos', os);

export const setCancelarOrdemServico = (
  orsvId: string,
  motivo: string,
  usrsId: string
) => {
  const qs = new URLSearchParams({
    id: orsvId,
    motivo: motivo,
    usrs_id: usrsId,
  }).toString();
  return proxyGet<unknown>(`/setCancelarOrdemServicos?${qs}`);
};

// ===== Pessoa-Veículo relationship =====

export interface PessoaVeiculo {
  PESS_ID?: string;
  PESS_NOME?: string;
  PESS_CPFCNPJ?: string;
  VEIC_ID?: string;
  VEIC_PLACA?: string;
  VEIC_MARCA?: string;
  VEIC_MODELO?: string;
  VEIC_ANO?: string;
  VEIC_COR?: string;
  VEIC_KM?: string;
}

export const getPessoasVeiculos = (params: { pess_id?: string; veic_id?: string }) => {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return proxyGet<PessoaVeiculo[]>(`/getPessoasVeiculos?${query}`);
};

// ===== Formas de Pagamento =====

export interface FormaPagamento {
  FPAG_ID: string;
  FPAG_NOME: string;
  FVEN_ID?: string;   // ID da Forma de Venda (usado pela API getGerarVencimentos)
  FVEN_NOME?: string; // Nome da Forma de Venda (rótulo apresentado ao usuário)
  FPAG_TIPO?: string; // ex: BOLETO, DINHEIRO, CARTAO
  FPAG_PARCELAS?: number; // total de parcelas (ex: 3 para "3X BOLETO")
  COFR_ID?: string;
}

export interface VencimentoGerado {
  // Campos legados (caso a API antiga responda)
  PARCELA?: number;
  DIAS?: number;
  VENCIMENTO?: string;
  PERC?: number;
  VALOR?: number;
  TIPO_PAGAMENTO?: string;
  COFR_NOME?: string;
  // Campos reais retornados pela API atual
  ITFV_ID?: string;
  ITFV_DIAS?: number;
  ITFV_DATA?: string; // YYYY-MM-DD
  ITFV_PERC?: number;
  ITFV_VLR?: number;
  TPPR_TIPO_PAGAMENTO?: string;
  COFR_ID?: string;
}

export const getGerarVencimentos = async (params: {
  fven_id: string;
  cofr_id: string;
  valor: number;
  dataref: string; // yyyy/MM/dd
}) => {
  const qs = new URLSearchParams({
    FVEN_ID: params.fven_id,
    COFR_ID: params.cofr_id,
    VALOR: String(params.valor),
    DATAREF: params.dataref,
  }).toString();
  const raw = await proxyGet<any>(`/getGerarVencimentos?${qs}`);
  if (raw && !Array.isArray(raw) && (raw.rawHtml || raw.message === '200 OK')) return [] as VencimentoGerado[];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((c) => normalizeApiKeys<VencimentoGerado>(c));
};

export interface FormaPagamentoItem {
  FPGI_ID?: string;
  FPAG_ID?: string;
  FPGI_PARCELA?: number;
  FPGI_DIAS?: number;
  FPGI_PERC?: number;
  FPGI_TIPO_PAGAMENTO?: string;
  COFR_ID?: string;
  // Campos adicionais retornados pelo endpoint atual
  TPPR_ID?: string;
  TPPR_TIPO_PAGAMENTO?: string;
  TPPR_NOME?: string;
}

export const getFormasPagamentos = async (unemId?: string) => {
  const qs = unemId ? `?unem_id=${encodeURIComponent(unemId)}` : '';
  const raw = await proxyGet<any>(`/getFormasPagamentos${qs}`);
  if (raw && !Array.isArray(raw) && (raw.rawHtml || raw.message === '200 OK')) return [] as FormaPagamento[];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((c) => normalizeApiKeys<FormaPagamento>(c));
};

// Aceita { itfv_id, cofr_id } (uso atual na finalização) ou string fpagId (legado)
export const getFormasPagamentosItens = async (
  params: string | { itfv_id?: string; cofr_id?: string; fpag_id?: string }
) => {
  let qs = '';
  if (typeof params === 'string') {
    qs = `fpag_id=${encodeURIComponent(params)}`;
  } else {
    const parts: string[] = [];
    if (params.itfv_id) parts.push(`ITFV_ID=${encodeURIComponent(params.itfv_id)}`);
    if (params.cofr_id) parts.push(`COFR_ID=${encodeURIComponent(params.cofr_id)}`);
    if (params.fpag_id) parts.push(`fpag_id=${encodeURIComponent(params.fpag_id)}`);
    qs = parts.join('&');
  }
  const raw = await proxyGet<any>(`/getFormasPagamentosItens?${qs}`);
  if (raw && !Array.isArray(raw) && (raw.rawHtml || raw.message === '200 OK')) return [] as FormaPagamentoItem[];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((c) => normalizeApiKeys<FormaPagamentoItem>(c));
};

export interface ParcelaFinalizacao {
  parcela: number;
  itfv_id?: string;
  dias?: number;
  vencimento: string; // YYYY/MM/DD
  perc: number;
  valor: number;
  tipo_pagamento?: string;
  cofr_id?: string;
}

export interface FinalizarOSPayload {
  ORSV_ID: string;
  ORSV_NUMERO?: string;
  USRS_ID: string;
  UNEM_ID?: string;
  EMPR_ID?: string;
  FPAG_ID: string;
  FVEN_ID?: string;
  COFR_ID?: string;
  COFR_SERVICO_ID?: string;
  VALOR_TOTAL: number;
  DATA_FINALIZACAO: string; // YYYY/MM/DD
  parcelas: ParcelaFinalizacao[];
}

export const setFinalizarOS = async (payload: FinalizarOSPayload) => {
  // Log para auditoria/debug do JSON enviado ao backend
  // eslint-disable-next-line no-console
  console.log('[setFinalizarOS] Payload enviado:', JSON.stringify(payload, null, 2));
  const response = await proxyPost<unknown>('/setFinalizarOS', payload);
  // eslint-disable-next-line no-console
  console.log('[setFinalizarOS] Resposta:', response);
  return response;
};
