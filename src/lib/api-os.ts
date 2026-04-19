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

export const getClientes = (params: { id?: string; nome?: string; cpfcnpj?: string }) => {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return proxyGet<Cliente[]>(`/getClientes?${query}`);
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

export const setItensOrdemServicos = (itens: Partial<ItemOS>[]) =>
  proxyPost<unknown>('/setItensOrdemServicos', itens);

export const setOrdemServico = (os: Partial<OrdemServicoFull>) =>
  proxyPost<OrdemServicoFull>('/setOrdemServicos', os);

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
