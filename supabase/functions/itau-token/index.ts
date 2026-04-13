const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BASIC_AUTH = 'Basic ' + btoa('hjsystems:11032011');
const LEGACY_BASE = 'http://3.214.255.198:8085';

// Certificates keyed by cofre name (uppercase)
const CERTIFICATES: Record<string, string> = {
  'ITAU GYN': `-----BEGIN CERTIFICATE-----
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
-----END CERTIFICATE-----`,
};

// Private keys keyed by cofre name (uppercase)
const PRIVATE_KEYS: Record<string, string> = {
  'ITAU GYN': `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC6kxOIjJ013o3J
YcMNts+bSkCgOg9YAo5s9Pu8yRf7ARNqx6PDjP4IsmTTbQsK03HxlVCP4GINefMR
U/76PS7IlTFtEinu3J219/mltbiEGhpzQlJmMzwzc4chtqzr1QDCZeP0CCtxULoI
d+aDgN8FagwedZWwRUt1Qbj82sCrRyDWqYyeZbc8GqDORjl+sdO0D5qgXjHvPl3i
mBxc/DmqEd00ccrQoklQct8F5RhYvhLMS+f23o+bSio+F8FmFy2vbll0u/trbsDx
t8K8rE3BuIZMs89HRbmB666ohN9nVhD/XtyBk8GrtntUnbe0Xx3vkuV2YVSE0AIQ
KLZHfVyxAgMBAAECggEAR1eeDITYSJUFWpALad8Rm6vU8m/BFkJD+93htNqgVNag
eiBEuq3bJbAxZbc4lbcsxtf1qk5+r/CFxYZ85WsnzINgFvjvF+s8UyyzRW4rVDg3
DQO7RmEpD/OJJJcZoEQeujcD53iIRBg+SqauenJ41TUr1SnZR0H4DKpI9kcfjV5J
5VtnpIHWXxirKDcnm4NGV8JXfCxpIGFWnXrleEQgG7TmLoYoEMW6fJtJOaNyrHm3
EgmrIIoSVZB1R9XQNq+2C5aNtyMB4KepRHyXbllfvzocoTxOOkfsPSrde72ayiIW
ajw8qrqKniw7IIAhRI+D6pGo2DL81NgSrHpeXNUJEQKBgQDp9hp7avTeYcyV+kuA
+fUW1hDQgZgtkDisSTHyMLcWGgO5YWM+EbiB3lekTpYmu68vi+sRU7GJqdwrrwUn
qtA4SoyCx2TZ/6DNbDvk+5guz1TnJq06gCS/zk3EpA8X/RoBdWWLDn7Lzc2HWui6
I5ipaB7cUiDunxARoWtXG0sYrwKBgQDMJkGKuag5+NapXQG1wOW+gvKpSEpQkhMQ
3EZNm9kDsS8YoliQre/qez3Ho7ARxcskrIhCH2JHHyAqCHEdGPlvnohBg4f9thNl
mz6IhuyBF08xMhx9F6VNK+H2iRD80v7igX0HAnl3jijEHl4kDOfgGOfYK4bVXtr0
L63bJ+l4nwKBgFQjprh16aRERcA2KIs02Xih+aASyzivokILfMPd0ypGpso3hOpg
kxtZa+lyPbumScVuq1Yq5DFe/ghTxCXU31cvMEMkFFf1/82AvDWIad2DwMP0e94L
EaxNNFigq7Dz3DNkFeWhi+YdmGmyPvoaLR/Xiymu+5r1Z2D/zUuhTCuPAoGBAKMJ
jmBu4wXhT/YUPBBeTFy4kXlWLVtpPWbCtDa41ziWoYkn5lktQCRgZjdw52VaNGFG
lM9R5xfrqLFI6qUVU+erkR/ZHpsldRo5QFiigHCcH/enEI9qee5GtIBCeNmg3EQi
q6oUdNNhKfduVTqvP+N9oHLIWDdBONW42jzjBBb7AoGBAJZcb2xpAe/LuGI8sktm
6UsGNAwF53OV6zxYoNlMQxaumcI/kUsEiFMLYUZ0dHcwWtjsYzZDk1n4PHa3kbyh
wl7/93CyL+wQfjiEdg9iKpYnVCZp7vmSvcZwv9kC9at8MbXu48Pis82gEiQ9upu+
BNbp/xz3+K1kArFRhBHjrsv8
-----END PRIVATE KEY-----`,
};

function getPrivateKey(cofrNome: string, supplied?: string): string {
  if (supplied) return supplied;
  const key = PRIVATE_KEYS[cofrNome.toUpperCase()];
  if (key) return key;
  throw new Error(`Chave privada não encontrada para cofre: ${cofrNome}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cofrNome, clientId, clientSecret, certificate, privateKeyPem } = await req.json();

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'clientId e clientSecret são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const cofrKey = (cofrNome || 'ITAU GYN').toUpperCase();
    const cert = certificate || CERTIFICATES[cofrKey];
    if (!cert) {
      return new Response(
        JSON.stringify({ error: `Certificado não encontrado para cofre: ${cofrKey}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get private key: supplied in body, or fetched from legacy API
    let privKey: string;
    try {
      privKey = getPrivateKey(cofrKey, privateKeyPem);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: e.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const postData = `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&scope=${encodeURIComponent('pix.read pix.write cob.read cob.write cobv.read cobv.write')}`;

    console.log(`[itau-token] Calling Itaú OAuth via mTLS for ${cofrKey}...`);

    // Use Deno.createHttpClient for mTLS
    let httpClient: Deno.HttpClient;
    try {
      httpClient = Deno.createHttpClient({
        certChain: cert.trim(),
        privateKey: privKey.trim(),
      });
    } catch (e) {
      console.error('[itau-token] Failed to create HttpClient:', e);
      return new Response(
        JSON.stringify({ error: `Erro ao criar cliente mTLS: ${e.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tokenResponse = await fetch('https://sts.itau.com.br/as/token.oauth2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postData,
      // @ts-ignore - Deno-specific option for mTLS
      client: httpClient,
    });

    const responseText = await tokenResponse.text();

    try {
      httpClient.close();
    } catch {
      // ignore close errors
    }

    console.log(`[itau-token] Itaú response status: ${tokenResponse.status}`);

    if (tokenResponse.status !== 200) {
      return new Response(
        JSON.stringify({ error: `Erro OAuth Itaú [${tokenResponse.status}]: ${responseText.substring(0, 500)}` }),
        { status: tokenResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tokenData = JSON.parse(responseText);
    console.log(`[itau-token] Token OK, expires_in: ${tokenData.expires_in}s`);

    return new Response(
      JSON.stringify({
        access_token: tokenData.access_token,
        token_type: tokenData.token_type || 'Bearer',
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[itau-token] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
