const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SendRequest {
  provider: 'Nexus' | 'WhatsAppOficial' | 'BrasilAPI' | 'Email' | 'n8n';
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

async function sendN8n(req: SendRequest): Promise<Response> {
  const webhookUrl = req.webhookUrl || 'https://n8n.srv1576408.hstgr.cloud/webhook/webhook-envio-direto';
  let phone = req.number.replace(/\D/g, '');
  if (!phone.startsWith('55')) phone = '55' + phone;

  const payload: any = {
    number: phone,
    text: req.text || '',
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

  console.log(`n8n payload: number=${payload.number}, text len=${payload.text.length}, mediaType=${payload.mediaType || 'none'}, document=${payload.document ? `base64(${payload.document.length} chars)` : 'null'}, image=${payload.image ? `base64(${payload.image.length} chars)` : 'null'}`);

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
        JSON.stringify({ success: response.ok, status: response.status, data: jsonData }),
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
