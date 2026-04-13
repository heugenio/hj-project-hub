import { supabase } from '@/integrations/supabase/client';

function getBaseUrl(): string {
  return localStorage.getItem('hj_system_url_base') || 'http://3.214.255.198:8085';
}

async function proxyFetch(endpoint: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('api-proxy', {
    body: { baseUrl: getBaseUrl(), endpoint, method: 'GET' },
  });
  if (error) throw new Error(`API proxy error: ${error.message}`);
  // data may come as parsed object or string
  if (typeof data === 'object' && data !== null) return JSON.stringify(data);
  return data as string;
}

async function proxyFetchRaw(endpoint: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('api-proxy', {
    body: { baseUrl: getBaseUrl(), endpoint, method: 'GET' },
  });
  if (error) throw new Error(`API proxy error: ${error.message}`);
  if (typeof data === 'string') return JSON.parse(data);
  return data as Record<string, unknown>;
}

async function apiGet<T>(endpoint: string): Promise<T> {
  const text = await proxyFetch(endpoint);
  return JSON.parse(text) as T;
}

export async function getLogo(): Promise<string> {
  const result = await proxyFetchRaw('/getLogo');
  const base64 = result.base64 as string;
  const mimeType = (result.mimeType as string) || 'image/png';
  return `data:${mimeType};base64,${base64}`;
}

export async function getBanner(): Promise<string> {
  const result = await proxyFetchRaw('/getBanner');
  const base64 = result.base64 as string;
  const mimeType = (result.mimeType as string) || 'image/png';
  return `data:${mimeType};base64,${base64}`;
}

// Types
export interface Corporacao {
  cprc_id: string;
  cprc_Nome: string;
}

export interface Empresa {
  cprc_id: string;
  empr_id: string;
  empr_Nome: string;
}

export interface UnidadeEmpresarial {
  unem_Mail: string;
  empr_id: string;
  unem_Fone: string;
  unem_Fantasia: string;
  unem_CNPJ: string;
  unem_Razao_Social: string;
  unem_Id: string;
  unem_Sigla: string;
  unem_Uf?: string;
  unem_Endereco?: string;
}

export interface Usuario {
  usrs_Nome_Login: string;
  pess_Nome: string;
  usrs_ID: string;
  usrs_Senha: string;
  usrs_Situacao: string;
  pess_Email: string;
  pess_Codigo: string;
  pess_ID: string;
  GRUS_PERFIL?: string;
}

export interface Grupo {
  grpo_id: string;
  grpo_Nome: string;
}

export interface Marca {
  marc_id: string;
  marc_Nome: string;
}

export interface EstoqueItem {
  Codigo: string;
  Nome: string;
  Referencia: string;
  G01?: string;
  G02?: string;
  G03?: string;
  G04?: string;
  G05?: string;
  G06?: string;
  G07?: string;
  G08?: string;
  G09?: string;
  G10?: string;
  G11?: string;
  G12?: string;
  GO?: string;
  DF?: string;
  Geral?: string;
}

// API calls
export const getCorporacoes = () => apiGet<Corporacao[]>('/getCorporacoes');
export const getEmpresas = (cprcId: string) => apiGet<Empresa[]>(`/getEmpresas?cprc_id=${cprcId}`);
export const getUnidadesEmpresariais = (emprId: string) => apiGet<UnidadeEmpresarial[]>(`/getUnidadesEmpresariais?empr_id=${emprId}`);
export const getUsuarios = (unemId: string) => apiGet<Usuario[]>(`/getUsuario?unem_id=${unemId}`);
export const getGrupos = () => apiGet<Grupo[]>('/getGrupos');
export const getMarcas = () => apiGet<Marca[]>('/getMarcas');

// Produtos
export interface Produto {
  prod_Codigo?: string;
  prod_Nome?: string;
  prod_Referencia?: string;
  grpo_Nome?: string;
  marc_Nome?: string;
  prod_Unidade?: string;
  prod_Preco_Venda?: string;
  prod_Situacao?: string;
  [key: string]: string | undefined;
}

export const getProdutos = (nome: string) =>
  apiGet<Produto[]>(`/getProdutos?nome=${encodeURIComponent(nome)}`);

// Consulta Estoque (por unidade)
export interface ConsultaEstoqueItem {
  [key: string]: string | undefined;
}

export const getConsultaEstoque = (params: {
  unem_id: string;
  prod_codigo?: string;
  prod_nome?: string;
  marc_id?: string;
  grpo_id?: string;
  referencia?: string;
  aplicacao?: string;
}) => {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return apiGet<ConsultaEstoqueItem[]>(`/getConsultaEstoque?${query}`);
};

export interface SalesDemo {
  GRPO_ID: string;
  GRUPO: string;
  CURVA?: string;
  PROD_CODIGO?: string;
  PROD_NOME?: string;
  PROD_REFERENCIA?: string;
  ITFT_UNID_SIGLA?: string;
  DCFS_QTD: string;
  ITFT_QTDE_FATURADA: string;
  ITFT_VLR_CONTABIL: string;
  ITFT_CUSTO_NA_OPERACAO: string;
  ITFT_VLR_LUCRO?: string;
  ITFT_PER_LUCRO?: string;
  VLR_DEV: string;
  QTDE_DEV: string;
  ITFT_PARTICIPACAO: string;
  SEST_QTD_MOV?: string;
}

export interface MovementSummary {
  OPCM_NOME_CLIENTE: string;
  DCFS_DATA_SAIDA: string;
  DCFS_NUMERO_NOTA: string;
  DCFS_MODELO_NOTA: string;
  DCFS_VLR_TOTAL: string;
  DCFS_NOME: string;
  HMOV_TIPO?: string;
  DCFS_TIPO_MOVIMENTO?: string;
  PDDS_NUMERO?: string;
  VDDR_NOME?: string;
  ITFT_VLR_TRIBUTOS?: string;
}

export const getDemonstrativoVendas = (params: {
  dtInicial: string;
  dtFinal: string;
  unem_id: string;
}) => {
  const query = `dtInicial=${encodeURIComponent(params.dtInicial)}&dtFinal=${encodeURIComponent(params.dtFinal)}&unem_id=${encodeURIComponent(params.unem_id)}`;
  return apiGet<SalesDemo[]>(`/getDemonstrativoVendas?${query}`);
};

export const getResumoMovimento = (params: {
  dtInicial: string;
  dtFinal: string;
  tipooperacao: string;
  unem_id: string;
}) => {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return apiGet<MovementSummary[]>(`/getResumoMovimento?${query}`);
};

export const getConsultaEstoqueFiliais = (params: {
  prod_codigo?: string;
  prod_nome?: string;
  marc_id?: string;
  grpo_id?: string;
  referencia?: string;
  empr_id: string;
}) => {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return apiGet<EstoqueItem[]>(`/getConsultaEstoqueFiliais?${query}`);
};

// Comparativo
export interface Comparativo {
  UNEM_ID: string;
  GRPO_NOME: string;
  GRPO_TIPO?: string;
  ITFT_VLR_CONTABIL: string;
  ITFT_QTDE: string;
  ITFT_VLR_CONTABIL_ANT: string;
  ITFT_QTDE_ANT: string;
  CRECIMENTO: string;
}

export interface ComparativoResumo {
  UNEM_ID: string;
  ITFT_VLR_CONTABIL: string;
  ITFT_QTDE: string;
  ITFT_VLR_CONTABIL_ANT: string;
  ITFT_QTDE_ANT: string;
  CRECIMENTO: string;
}

export const getComparativo = (unem_id: string) =>
  apiGet<Comparativo[]>(`/getComparativo?unem_id=${encodeURIComponent(unem_id)}`);

export const getComparativoResumo = (unem_id: string) =>
  apiGet<ComparativoResumo[]>(`/getComparativoResumo?unem_id=${encodeURIComponent(unem_id)}`);

// Ordem de Serviço
export interface OrdemServico {
  vEIC_MARCA: string;
  oRSV_DATA: string;
  vEIC_PLACA: string;
  oRSV_OBSERVACOES: string;
  oRSV_HODOMETRO: string;
  vEND_NOME: string;
  oRSV_DATA_CANC: string;
  oRSV_CPFCNPJ: string;
  oRSV_ID: string;
  oRSV_NUMERO: string;
  oRSV_STATUS: string;
  vEIC_MODELO: string;
  oRSV_VLR_TOTAL: number;
  oRSV_MOTIVO_CANC: string;
  oRSV_NOME: string;
}

export const getOrdemServicos = (unem_id: string) =>
  apiGet<OrdemServico[]>(`/getOrdemServicos?unem_id=${encodeURIComponent(unem_id)}`);

// Cofres (configuração PIX dos bancos)
export interface Cofre {
  COFR_NOME?: string;
  COFR_API_KEY?: string;
  COFR_CLIENT_ID?: string;
  COFR_CLIENT_SECRET?: string;
  COFR_CHAVE_PIX?: string;
  COFR_URL_API?: string;
  COFR_URL_TOKEN?: string;
  COFR_AMBIENTE_PIX?: string;
  COFR_TIPO_CHAVE?: string;
  [key: string]: string | undefined;
}

export const getCofres = () => apiGet<Cofre[]>('/getCofres');

// Gerar token OAuth para banco (ex: Itaú com certificado no servidor)
export const getGerarToken = (cofrNome: string) =>
  proxyFetchRaw(`/getGerarToken?cofr_nome=${encodeURIComponent(cofrNome)}`);