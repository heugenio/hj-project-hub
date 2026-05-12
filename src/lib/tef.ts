// TEF (Transferência Eletrônica de Fundos) — abstração de provedores
// Arquitetura preparada para PayGo, TEF ID, Cappta, CliSiTef, Software Express.
// Esta camada simula a transação. Em produção, cada provider deve implementar
// `iniciarTransacao` chamando o SDK/serviço local correspondente.

export type TefProvider = 'paygo' | 'tef-id' | 'cappta' | 'clisitef' | 'sw-express' | 'simulado';

export type TipoCartao = 'credito' | 'debito';

export interface TefRequest {
  provider: TefProvider;
  tipo: TipoCartao;
  valor: number;
  parcelas: number;
}

export interface TefResultado {
  ok: boolean;
  cancelado?: boolean;
  mensagem?: string;
  nsu?: string;
  autorizacao?: string;
  bandeira?: string;
  adquirente?: string;
  parcelas?: number;
  valor?: number;
  comprovanteCliente?: string;
  comprovanteEstabelecimento?: string;
}

const TEF_PROVIDER_KEY = 'tef_provider';

export function getTefProvider(): TefProvider {
  return (localStorage.getItem(TEF_PROVIDER_KEY) as TefProvider) || 'simulado';
}

export function setTefProvider(p: TefProvider) {
  localStorage.setItem(TEF_PROVIDER_KEY, p);
}

// Simulação — substituir por integração real conforme o provider.
async function iniciarSimulado(req: TefRequest): Promise<TefResultado> {
  await new Promise((r) => setTimeout(r, 1200));
  // Simula 95% de aprovação
  if (Math.random() < 0.05) {
    return { ok: false, cancelado: true, mensagem: 'Transação cancelada pelo operador' };
  }
  const nsu = String(Math.floor(Math.random() * 9_000_000) + 1_000_000);
  const aut = String(Math.floor(Math.random() * 900_000) + 100_000);
  return {
    ok: true,
    nsu,
    autorizacao: aut,
    bandeira: 'VISA',
    adquirente: 'STONE',
    parcelas: req.parcelas,
    valor: req.valor,
    comprovanteCliente: `COMPROVANTE TEF (SIMULADO)\nNSU ${nsu} • AUT ${aut}\nValor R$ ${req.valor.toFixed(2)} • ${req.parcelas}x`,
  };
}

export async function iniciarTransacaoTef(req: TefRequest): Promise<TefResultado> {
  // Roteamento por provider — todas atualmente apontam para a simulação.
  // Implementar provedores reais aqui.
  switch (req.provider) {
    case 'paygo':
    case 'tef-id':
    case 'cappta':
    case 'clisitef':
    case 'sw-express':
    case 'simulado':
    default:
      return iniciarSimulado(req);
  }
}
