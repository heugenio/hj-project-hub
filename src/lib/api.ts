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
}

// API calls
export const getCorporacoes = () => apiGet<Corporacao[]>('/getCorporacoes');
export const getEmpresas = (cprcId: string) => apiGet<Empresa[]>(`/getEmpresas?cprc_id=${cprcId}`);
export const getUnidadesEmpresariais = (emprId: string) => apiGet<UnidadeEmpresarial[]>(`/getUnidadesEmpresariais?empr_id=${emprId}`);
export const getUsuarios = (unemId: string) => apiGet<Usuario[]>(`/getUsuario?unem_id=${unemId}`);