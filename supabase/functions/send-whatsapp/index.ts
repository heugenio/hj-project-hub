const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const NEXUS_BASE = 'https://nexus24.uazapi.com';
const NEXUS_TOKEN = '9a32d5f7-35df-4987-9b96-14afafe3229b';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { number, text, type, mediaType, file, canal } = await req.json();

    if (!number || !text) {
      return new Response(
        JSON.stringify({ error: 'number and text are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean phone number - ensure 55 prefix
    let phone = number.replace(/\D/g, '');
    if (!phone.startsWith('55')) phone = '55' + phone;

    console.log(`Sending ${type || 'text'} to ${phone} via ${canal || 'whatsapp'}`);

    let response: Response;

    if (type === 'media' && file) {
      // Send media (image)
      response = await fetch(`${NEXUS_BASE}/send/media`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'token': NEXUS_TOKEN,
        },
        body: JSON.stringify({
          number: phone,
          type: mediaType || 'image',
          file: file,
          caption: text,
        }),
      });
    } else {
      // Send text
      response = await fetch(`${NEXUS_BASE}/send/text`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'token': NEXUS_TOKEN,
        },
        body: JSON.stringify({
          number: phone,
          text: text,
        }),
      });
    }

    const data = await response.text();
    console.log('Nexus response:', response.status, data);

    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch {
      jsonData = { raw: data };
    }

    return new Response(
      JSON.stringify({ success: response.ok, status: response.status, data: jsonData }),
      { status: response.ok ? 200 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
