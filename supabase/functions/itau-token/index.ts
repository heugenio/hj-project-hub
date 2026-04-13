const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BASIC_AUTH = 'Basic ' + btoa('hjsystems:11032011');

interface TokenRequest {
  cofrNome: string;
  clientId: string;
  clientSecret: string;
  certificate?: string; // PEM certificate (optional, uses stored one if not provided)
}

// Stored certificate for ITAU GYN (valid until 2027-04-13)
const ITAU_GYN_CERT = `-----BEGIN CERTIFICATE-----
MIIDlDCCAnygAwIBAgITLgAAACb+81zoTyaebQAAAAAAJjANBgkqhkiG9w0BAQsF
ADCBgzELMAkGA1UEBhMCQlIxEjAQBgNVBAgTCVNhbyBQYXVsbzESMBAGA1UEBxMJ
U2FvIFBhdWxvMRswGQYDVQQKExJJdGF1IFVuaWJhbmNvIFMuQS4xGzAZBgNVBAsT
Ekl0YXUgVW5pYmFuY28gUy5BLjESMBAGA1UEAxMJU1RTLVMwNjU0MB4XDTI2MDQx
MzE4MDQxMFoXDTI3MDQxMzE4MDQxMFowgYQxLTArBgNVBAMMJGM4NzViNzc1LTJj
Y2ItNDM4Mi1iNDFhLWY1MDgwZmFkMmJlMTEVMBMGA1UECwwMR1JJRkZFIFBORVVT
MRAwDgYDVQQHDAdHT0lBTklBMQswCQYDVQQIDAJHTzELMAkGA1UEBhMCQlIxEDAO
BgNVBAsMB0NsaWVudGUwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC6
kxOIjJ013o3JYcMNts+bSkCgOg9YAo5s9Pu8yRf7ARNqx6PDjP4IsmTTbQsK03Hx
lVCP4GINefMRU/76PS7IlTFtEinu3J219/mltbiEGhpzQlJmMzwzc4chtqzr1QDC
ZeP0CCtxULoId+aDgN8FagwedZWwRUt1Qbj82sCrRyDWqYyeZbc8GqDORjl+sdO0
D5qgXjHvPl3imBxc/DmqEd00ccrQoklQct8F5RhYvhLMS+f23o+bSio+F8FmFy2v
bll0u/trbsDxt8K8rE3BuIZMs89HRbmB666ohN9nVhD/XtyBk8GrtntUnbe0Xx3v
kuV2YVSE0AIQKLZHfVyxAgMBAAEwDQYJKoZIhvcNAQELBQADggEBACi7h8Jhdipn
mf1N8/vz1ou9FcpVEH9DQaFi+nTjJ66zN+Ymv5UU87oQIDgkMVXfoms1fHkih5eC
JlZfYzp1+aCxeBKZdkeOt9ipvNFxPm03l3KXP+fBVlxp+H6ayciU+GFHIyq1d3A+
OYgPyxs/kyM497QJc/CBQotyO5HRdOFX6E4m2IGc5OVxfZE1PpxIf5KXW/A3XEri
OxJ/zgikZDgh0QymksjO4UmB94qlxCSrSxqJl79IFu0pIhU+Ib1expFBsYjw8sdH
WIpyNNEFpGbQK+TFvFb22r+B1aDTGdzEDIolKjnh4ZHyNoCcFz5O7PZeyHusU8ot
mrGd6Mc96mU=
-----END CERTIFICATE-----`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: TokenRequest = await req.json();
    const { cofrNome, clientId, clientSecret, certificate } = body;

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'clientId e clientSecret são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Fetch private key from legacy API
    const baseUrl = 'http://3.214.255.198:8085';
    const keyResponse = await fetch(`${baseUrl}/getGerarToken?cofr_nome=${encodeURIComponent(cofrNome || 'ITAU GYN')}`, {
      headers: { 'Authorization': BASIC_AUTH },
    });

    if (!keyResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Erro ao buscar chave privada: ${keyResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const privateKey = await keyResponse.text();
    if (!privateKey.includes('PRIVATE KEY')) {
      return new Response(
        JSON.stringify({ error: 'Chave privada inválida retornada pelo servidor' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cert = certificate || ITAU_GYN_CERT;
    console.log(`[itau-token] Private key obtained for ${cofrNome}, creating mTLS client...`);

    // Step 2: Create HTTP client with mTLS
    const httpClient = Deno.createHttpClient({
      certChain: cert,
      privateKey: privateKey.trim(),
    });

    // Step 3: Call Itaú OAuth endpoint with mTLS
    const tokenUrl = 'https://sts.itau.com.br/as/token.oauth2';
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&scope=${encodeURIComponent('pix.read pix.write cob.read cob.write cobv.read cobv.write')}`,
      client: httpClient,
    } as any);

    httpClient.close();

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error(`[itau-token] OAuth error [${tokenResponse.status}]:`, errText);
      return new Response(
        JSON.stringify({ error: `Erro OAuth Itaú [${tokenResponse.status}]: ${errText.substring(0, 500)}` }),
        { status: tokenResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log(`[itau-token] Token gerado com sucesso para ${cofrNome}, expira em ${tokenData.expires_in}s`);

    return new Response(
      JSON.stringify({
        access_token: tokenData.access_token,
        token_type: tokenData.token_type || 'Bearer',
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[itau-token] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
