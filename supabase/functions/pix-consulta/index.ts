const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PixRequest {
  urlToken: string;
  urlApi: string;
  clientId: string;
  clientSecret: string;
  apiKey: string;
  inicio: string;
  fim: string;
}

async function getOAuthToken(urlToken: string, clientId: string, clientSecret: string): Promise<string> {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch(urlToken, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=cob.read cob.write pix.read pix.write',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token error [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

function mapPixResponse(pixArray: any[], banco: string): any[] {
  return (pixArray || []).map((pix: any) => {
    const valor = parseFloat(pix.valor || pix.valor?.original || '0');
    const pagador = pix.pagador || {};
    const recebedor = pix.favorecido || pix.recebedor || {};
    
    return {
      txId: pix.txid || pix.txId || pix.endToEndId || '',
      endToEndId: pix.endToEndId || '',
      valor,
      dataHora: pix.horario || pix.criacao || pix.dataHoraPagamento || '',
      tipo: 'entrada' as const,
      status: mapStatus(pix.status),
      pagadorNome: pagador.nome || pagador.nomeCompleto || 'N/A',
      pagadorDocumento: pagador.cpf || pagador.cnpj || 'N/A',
      recebedorNome: recebedor.nome || 'N/A',
      recebedorDocumento: recebedor.cpf || recebedor.cnpj || 'N/A',
      chavePix: pix.chave || '',
      instituicao: banco,
      rawJson: pix,
    };
  });
}

function mapStatus(status: string): 'confirmado' | 'pendente' | 'cancelado' {
  if (!status) return 'confirmado';
  const s = status.toUpperCase();
  if (s === 'CONCLUIDA' || s === 'ATIVA' || s === 'CONCLUIDO') return 'confirmado';
  if (s === 'REMOVIDA_PELO_USUARIO_RECEBEDOR' || s === 'REMOVIDA_PELO_PSP' || s === 'CANCELADA') return 'cancelado';
  return 'pendente';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PixRequest = await req.json();
    const { urlToken, urlApi, clientId, clientSecret, apiKey, inicio, fim } = body;

    if (!urlApi || !clientId || !clientSecret || !inicio || !fim) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: urlApi, clientId, clientSecret, inicio, fim' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Get OAuth2 token
    let token = apiKey || '';
    if (urlToken) {
      try {
        token = await getOAuthToken(urlToken, clientId, clientSecret);
      } catch (tokenErr) {
        console.error('OAuth token error:', tokenErr);
        return new Response(
          JSON.stringify({ error: `Erro ao obter token OAuth: ${tokenErr.message}` }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Step 2: Query PIX received
    const pixUrl = `${urlApi}/pix?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`;
    
    const pixResponse = await fetch(pixUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!pixResponse.ok) {
      const errText = await pixResponse.text();
      console.error(`PIX API error [${pixResponse.status}]:`, errText);
      return new Response(
        JSON.stringify({ error: `Erro na API PIX [${pixResponse.status}]: ${errText.substring(0, 500)}` }),
        { status: pixResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pixData = await pixResponse.json();
    
    // BACEN standard: response has "pix" array for /pix endpoint
    // or "cobs" array for /cob endpoint
    const pixArray = pixData.pix || pixData.cobs || pixData.cobsv || [];
    const banco = urlApi.includes('bb.com') ? 'Banco do Brasil' 
      : urlApi.includes('itau') ? 'Itaú'
      : urlApi.includes('bradesco') ? 'Bradesco'
      : urlApi.includes('sicoob') ? 'Sicoob'
      : urlApi.includes('nubank') ? 'Nubank'
      : 'Outro';

    const transactions = mapPixResponse(Array.isArray(pixArray) ? pixArray : [pixArray], banco);

    // Also try to get cobranças (cob)
    let cobTransactions: any[] = [];
    try {
      const cobUrl = `${urlApi}/cob?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`;
      const cobResponse = await fetch(cobUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (cobResponse.ok) {
        const cobData = await cobResponse.json();
        const cobArray = cobData.cobs || cobData.cobsVencimento || [];
        cobTransactions = mapPixResponse(Array.isArray(cobArray) ? cobArray : [], banco);
      }
    } catch (cobErr) {
      console.warn('Cob query failed (non-critical):', cobErr);
    }

    const allTransactions = [...transactions, ...cobTransactions];

    return new Response(
      JSON.stringify({ 
        transactions: allTransactions, 
        total: allTransactions.length,
        parametros: { inicio, fim },
        rawResponse: pixData,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('PIX consulta error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
