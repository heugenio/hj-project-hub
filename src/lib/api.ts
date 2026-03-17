const BASIC_AUTH = 'Basic ' + btoa('hjsystems:11032011');

function getBaseUrl(): string {
  return localStorage.getItem('hj_system_url_base') || 'http://hjsystems.dynns.com:8085';
}

async function apiGet<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${endpoint}`, {
    headers: { 'Authorization': BASIC_AUTH },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiGetBlob(endpoint: string): Promise<string> {
  const res = await fetch(`${getBaseUrl()}${endpoint}`, {
    headers: { 'Authorization': BASIC_AUTH },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
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
export const getLogo = () => apiGetBlob('/getLogo');
