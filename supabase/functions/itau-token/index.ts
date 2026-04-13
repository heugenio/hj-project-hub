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

async function fetchPrivateKey(cofrNome: string): Promise<string> {
  const resp = await fetch(
    `${LEGACY_BASE}/getGerarToken?cofr_nome=${encodeURIComponent(cofrNome)}`,
    { headers: { 'Authorization': BASIC_AUTH } },
  );
  const text = await resp.text();
  if (text.includes('PRIVATE KEY')) return text.trim();

  // Legacy API may return HTML "200 OK" – fetch key via getCofres fallback
  // or the key may already be stored locally. Throw so caller knows.
  throw new Error('Legacy API did not return a private key');
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
    let privKey = privateKeyPem || '';
    if (!privKey) {
      try {
        privKey = await fetchPrivateKey(cofrNome || 'ITAU GYN');
      } catch {
        // Legacy didn't return key – we'll still try via curl but it will fail
        // if there's no key at all
        return new Response(
          JSON.stringify({ error: 'Chave privada não disponível. A API legada não retornou a chave.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Write cert and key to temp files for curl
    const certPath = '/tmp/itau_cert.pem';
    const keyPath = '/tmp/itau_key.pem';
    await Deno.writeTextFile(certPath, cert.trim() + '\n');
    await Deno.writeTextFile(keyPath, privKey.trim() + '\n');

    const postData = `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&scope=${encodeURIComponent('pix.read pix.write cob.read cob.write cobv.read cobv.write')}`;

    console.log(`[itau-token] Calling Itaú OAuth via curl mTLS for ${cofrKey}...`);

    const cmd = new Deno.Command('curl', {
      args: [
        '-s',
        '--cert', certPath,
        '--key', keyPath,
        '-X', 'POST',
        'https://sts.itau.com.br/as/token.oauth2',
        '-H', 'Content-Type: application/x-www-form-urlencoded',
        '-d', postData,
        '-w', '\n__HTTP_STATUS__:%{http_code}',
        '--max-time', '15',
      ],
      stdout: 'piped',
      stderr: 'piped',
    });

    const output = await cmd.output();
    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    if (!output.success) {
      console.error('[itau-token] curl failed:', stderr);
      return new Response(
        JSON.stringify({ error: `curl falhou: ${stderr.substring(0, 300)}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse HTTP status from curl output
    const statusMatch = stdout.match(/__HTTP_STATUS__:(\d+)/);
    const httpStatus = statusMatch ? parseInt(statusMatch[1]) : 0;
    const body = stdout.replace(/\n__HTTP_STATUS__:\d+$/, '').trim();

    console.log(`[itau-token] Itaú response status: ${httpStatus}`);

    if (httpStatus !== 200) {
      return new Response(
        JSON.stringify({ error: `Erro OAuth Itaú [${httpStatus}]: ${body.substring(0, 500)}` }),
        { status: httpStatus || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tokenData = JSON.parse(body);
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
