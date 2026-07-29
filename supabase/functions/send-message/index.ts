const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SendRequest {
  provider: 'Nexus' | 'WhatsAppOficial' | 'BrasilAPI' | 'Email' | 'n8n' | 'Bitrix';
  token: string;
  device?: string; // BrasilAPI DeviceToken
  phoneNumberId?: string; // WhatsApp Oficial
  number: string;
  text: string;
  type?: 'text' | 'media';
  mediaType?: string;
  file?: string;
  fileName?: string;
  // Email fields
  emailTo?: string;
  emailSubject?: string;
  emailFrom?: string;
  smtpServer?: string;
  smtpPort?: string;
  smtpSsl?: string;
  smtpPassword?: string;
  // Nexus URL override
  nexusUrl?: string;
  // n8n webhook URL
  webhookUrl?: string;
  // Bitrix (Griffe Disparos) fields
  bitrixLoja?: string;       // nome da loja OU waba_id
  bitrixTemplate?: string;   // nome do template aprovado (default: lembrete_rodizio)
  bitrixLanguage?: string;   // default pt_BR
  bitrixNome?: string;       // valor da variável {{1}}
}

// CNPJ (14 dígitos) → waba_id  |  Nome fantasia (normalizado) → waba_id
const BITRIX_LOJAS: Record<string, { waba_id: string; nome: string }> = {
  '05801944000696': { waba_id: '1471069679719597', nome: 'Anapolis' },
  '10929311000517': { waba_id: '709332895198521',  nome: 'Asa Norte' },
  '10929311000193': { waba_id: '2473492822669100', nome: 'Asa Sul' },
  '05801944000262': { waba_id: '594150304624458',  nome: 'Av 85' },
  '05801944000424': { waba_id: '215140906282003',  nome: 'Av Independencia' },
  '05801944000181': { waba_id: '107158601949509',  nome: 'Flamboyant' },
  '10929311000355': { waba_id: '1986910505563248', nome: 'Sia' },
  '10929311000436': { waba_id: '34179999728310534', nome: 'Tag Norte' },
  '10929311000274': { waba_id: '953251587477663',  nome: 'Tag Sul' },
  '05801944000343': { waba_id: '1150412947247109', nome: 'Tamandare' },
  '05801944000505': { waba_id: '220912148947746',  nome: 'Walter Santos' },
};
const BITRIX_NOME_TO_WABA: Record<string, string> = Object.fromEntries(
  Object.values(BITRIX_LOJAS).map(v => [v.nome.toLowerCase().replace(/[^a-z0-9]/g, ''), v.waba_id])
);

// Aliases de template a partir do tipo da campanha
const BITRIX_TEMPLATE_ALIASES: Record<string, string> = {
  'RODIZIO': 'lembrete_rodizio',
};

const BITRIX_WABA_TO_NOME: Record<string, string> = Object.fromEntries(
  Object.values(BITRIX_LOJAS).map(v => [v.waba_id, v.nome])
);

// UNEM_ID (legacy) → nome oficial Bitrix
const BITRIX_UNEM_TO_NOME: Record<string, string> = {
  '000640010004': 'Flamboyant',
  '000640010005': 'Av 85',
  '000640010007': 'Tamandare',
  '000640010006': 'Av Independencia',
  '000640010003': 'Asa Sul',
  '000640010002': 'Tag Sul',
  '000640010001': 'Sia',
  '000640010008': 'Walter Santos',
  '000640010009': 'Tag Norte',
  '000640010010': 'Asa Norte',
  '000640010011': 'Anapolis',
};

function resolveBitrixLojaNome(input: string): string {
  const raw = (input || '').trim();
  if (!raw) return '';
  // UNEM_ID legacy (12 dígitos começando 000640010) → nome
  if (BITRIX_UNEM_TO_NOME[raw]) return BITRIX_UNEM_TO_NOME[raw];
  const digits = raw.replace(/\D/g, '');
  if (BITRIX_UNEM_TO_NOME[digits]) return BITRIX_UNEM_TO_NOME[digits];
  // CNPJ conhecido → nome
  if (digits.length === 14 && BITRIX_LOJAS[digits]) return BITRIX_LOJAS[digits].nome;
  // waba_id conhecido → nome
  if (/^\d+$/.test(raw) && BITRIX_WABA_TO_NOME[raw]) return BITRIX_WABA_TO_NOME[raw];
  // nome fantasia conhecido (normalizado) → nome oficial
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  const wabaFromNome = BITRIX_NOME_TO_WABA[key];
  if (wabaFromNome && BITRIX_WABA_TO_NOME[wabaFromNome]) return BITRIX_WABA_TO_NOME[wabaFromNome];
  // fallback: usa como nome de loja
  return raw;
}

async function sendBitrix(req: SendRequest): Promise<Response> {
  const baseUrl = Deno.env.get('GRIFFE_DISPAROS_BASE_URL') || 'https://griffe-disparos-bot-griffe.r7obki.easypanel.host';
  const apiKey = Deno.env.get('GRIFFE_DISPAROS_API_KEY') || '';
  const rawTpl = (req.bitrixTemplate || req.token || 'lembrete_rodizio').trim();
  const template = BITRIX_TEMPLATE_ALIASES[rawTpl.toUpperCase()] || rawTpl;
  const lojaIn = (req.bitrixLoja || req.device || '').trim();
  const language = (req.bitrixLanguage || 'pt_BR').trim();
  const nome = (req.bitrixNome || req.text || '').trim();

  let phone = req.number.replace(/\D/g, '');
  if (!phone.startsWith('55')) phone = '55' + phone;

  const loja = resolveBitrixLojaNome(lojaIn);
  const body: Record<string, unknown> = {
    loja,
    template,
    language,
    contatos: [{ numero: phone, nome }],
    msgs_por_bloco: 20,
    intervalo_blocos_seg: 60,
  };

  console.log(`Bitrix payload: lojaIn=${lojaIn} → loja=${loja}, template=${template} (raw=${rawTpl}), numero=${phone}, nome=${nome}`);

  return fetch(`${baseUrl}/api/disparos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(body),
  });
}

async function sendNexus(req: SendRequest): Promise<Response> {
  const baseUrl = req.nexusUrl || 'https://nexus24.uazapi.com';
  let phone = req.number.replace(/\D/g, '');
  if (!phone.startsWith('55')) phone = '55' + phone;

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'token': req.token,
  };

  if (req.type === 'media' && req.file) {
    const mediaType = req.mediaType || 'image';
    const body: Record<string, unknown> = {
      number: phone,
      type: mediaType,
      file: req.file,
      caption: req.text,
    };
    if (mediaType === 'document' && req.fileName) {
      body.docName = req.fileName;
    }
    return fetch(`${baseUrl}/send/media`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  return fetch(`${baseUrl}/send/text`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ number: phone, text: req.text }),
  });
}

async function sendWhatsAppOficial(req: SendRequest): Promise<Response> {
  const phoneNumberId = req.phoneNumberId || '';
  let phone = req.number.replace(/\D/g, '');
  if (!phone.startsWith('55')) phone = '55' + phone;

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  const headers = {
    'Authorization': `Bearer ${req.token}`,
    'Content-Type': 'application/json',
  };

  if (req.type === 'media' && req.file) {
    const mediaType = req.mediaType || 'image';
    if (mediaType === 'document') {
      return fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'document',
          document: {
            link: req.file,
            caption: req.text,
            filename: req.fileName || 'documento.pdf',
          },
        }),
      });
    }
    return fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'image',
        image: {
          link: req.file,
          caption: req.text,
        },
      }),
    });
  }

  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: req.text },
    }),
  });
}

async function sendBrasilAPI(req: SendRequest): Promise<Response> {
  let phone = req.number.replace(/\D/g, '');
  if (!phone.startsWith('55')) phone = '55' + phone;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'DeviceToken': req.device || '',
    'Authorization': `bearer ${req.token}`,
  };

  if (req.type === 'media' && req.file) {
    return fetch('https://gateway.apibrasil.io/api/v2/whatsapp/sendFile', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        number: phone,
        text: req.text,
        path: req.file,
      }),
    });
  }

  return fetch('https://gateway.apibrasil.io/api/v2/whatsapp/sendText', {
    method: 'POST',
    headers,
    body: JSON.stringify({ number: phone, text: req.text }),
  });
}

async function sendEmail(req: SendRequest): Promise<{ ok: boolean; status: number; body: string }> {
  // Use a simple SMTP relay approach via Deno's smtp module or a basic fetch approach
  // Since Deno doesn't have built-in SMTP, we'll use a minimal implementation
  const { smtpServer, smtpPort, smtpSsl, smtpPassword, emailFrom, emailTo, emailSubject, text } = req;

  if (!smtpServer || !emailFrom || !emailTo) {
    return { ok: false, status: 400, body: 'Missing SMTP configuration' };
  }

  try {
    // Connect to SMTP server
    const port = parseInt(smtpPort || '587');
    const useTls = smtpSsl === 'S' || smtpSsl === 'true' || port === 465;

    const conn = useTls
      ? await Deno.connectTls({ hostname: smtpServer, port })
      : await Deno.connect({ hostname: smtpServer, port });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readResponse = async (): Promise<string> => {
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return n ? decoder.decode(buf.subarray(0, n)) : '';
    };

    const sendCommand = async (cmd: string): Promise<string> => {
      await conn.write(encoder.encode(cmd + '\r\n'));
      return await readResponse();
    };

    // SMTP conversation
    await readResponse(); // greeting
    await sendCommand(`EHLO localhost`);

    // STARTTLS if not already TLS and port is 587
    if (!useTls && port === 587) {
      const starttlsResp = await sendCommand('STARTTLS');
      if (starttlsResp.startsWith('220')) {
        // Upgrade connection - note: this is simplified
        // In practice you'd need to upgrade the connection
      }
    }

    // AUTH LOGIN
    if (smtpPassword) {
      await sendCommand('AUTH LOGIN');
      await sendCommand(btoa(emailFrom));
      await sendCommand(btoa(smtpPassword));
    }

    await sendCommand(`MAIL FROM:<${emailFrom}>`);
    await sendCommand(`RCPT TO:<${emailTo}>`);
    await sendCommand('DATA');

    const emailBody = [
      `From: ${emailFrom}`,
      `To: ${emailTo}`,
      `Subject: ${emailSubject || 'Campanha Marketing'}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      '',
      text,
      '.',
    ].join('\r\n');

    const dataResp = await sendCommand(emailBody);
    await sendCommand('QUIT');
    conn.close();

    return { ok: dataResp.startsWith('250'), status: dataResp.startsWith('250') ? 200 : 500, body: dataResp };
  } catch (error: any) {
    return { ok: false, status: 500, body: error.message || 'SMTP error' };
  }
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    // If already a data URL or base64 string, strip prefix and return raw base64
    if (url.startsWith('data:')) {
      const idx = url.indexOf('base64,');
      return idx >= 0 ? url.substring(idx + 7) : null;
    }
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`Falha ao baixar imagem ${url}: ${resp.status}`);
      return null;
    }
    const buf = new Uint8Array(await resp.arrayBuffer());
    // Convert to base64 in chunks to avoid stack overflow on large images
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < buf.length; i += chunkSize) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  } catch (err) {
    console.error('Erro ao converter imagem para base64:', err);
    return null;
  }
}

let lastSendUrl = '';

async function sendN8n(req: SendRequest): Promise<Response> {
  const webhookUrl = req.webhookUrl || 'https://n8n.srv1576408.hstgr.cloud/webhook/webhook-envio-direto';
  lastSendUrl = webhookUrl;
  let phone = req.number.replace(/\D/g, '');
  if (!phone.startsWith('55')) phone = '55' + phone;

  const payload: any = {
    number: phone,
    text: req.text || '',
    token: req.token || '',
    device: req.device || '',
    image: null,
    document: null,
    fileName: null,
    mimeType: null,
    mediaType: null,
  };

  if (req.type === 'media' && req.file) {
    const isDocument = req.mediaType === 'document';
    const base64 = await fetchImageAsBase64(req.file);
    if (base64) {
      if (isDocument) {
        payload.document = base64;
        payload.fileName = req.fileName || 'documento.pdf';
        payload.mimeType = 'application/pdf';
        payload.mediaType = 'document';
      } else {
        payload.image = base64;
        payload.mediaType = req.mediaType || 'image';
        payload.mimeType = 'image/jpeg';
      }
    } else {
      console.warn(`n8n: arquivo não pôde ser convertido, enviando apenas texto. URL=${req.file}`);
    }
  }

  console.log(`n8n payload: number=${payload.number}, text len=${payload.text.length}, token len=${payload.token.length}, device=${payload.device || 'none'}, mediaType=${payload.mediaType || 'none'}, document=${payload.document ? `base64(${payload.document.length} chars)` : 'null'}, image=${payload.image ? `base64(${payload.image.length} chars)` : 'null'}`);

  return fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SendRequest = await req.json();
    const { provider } = body;

    if (!provider) {
      return new Response(
        JSON.stringify({ error: 'provider is required (Nexus, WhatsAppOficial, BrasilAPI, Email)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending via ${provider} to ${body.number || body.emailTo}`);

    let response: Response | { ok: boolean; status: number; body: string };

    switch (provider) {
      case 'Nexus':
        response = await sendNexus(body);
        break;
      case 'WhatsAppOficial':
        response = await sendWhatsAppOficial(body);
        break;
      case 'BrasilAPI':
        response = await sendBrasilAPI(body);
        break;
      case 'Email':
        response = await sendEmail(body);
        break;
      case 'n8n':
        response = await sendN8n(body);
        break;
      case 'Bitrix':
        response = await sendBitrix(body);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown provider: ${provider}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Handle response
    if (response instanceof Response) {
      const data = await response.text();
      console.log(`${provider} response:`, response.status, data);

      let jsonData;
      try { jsonData = JSON.parse(data); } catch { jsonData = { raw: data }; }

      return new Response(
        JSON.stringify({ success: response.ok, status: response.status, data: jsonData, sendUrl: lastSendUrl || response.url }),
        { status: response.ok ? 200 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Email result
      return new Response(
        JSON.stringify({ success: response.ok, status: response.status, data: { message: response.body } }),
        { status: response.ok ? 200 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('Send error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
