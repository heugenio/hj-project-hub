const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BASIC_AUTH = 'Basic ' + btoa('hjsystems:11032011');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { baseUrl, endpoint, method } = await req.json();

    if (!baseUrl || !endpoint || !endpoint.startsWith('/')) {
      return new Response(
        JSON.stringify({ error: 'Invalid request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = `${baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: method || 'GET',
      headers: { 'Authorization': BASIC_AUTH },
    });

    const contentType = response.headers.get('content-type') || '';
    const isImage = contentType.startsWith('image/');

    if (isImage) {
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const chunkSize = 8192;
      let binary = '';
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        for (let j = 0; j < chunk.length; j++) {
          binary += String.fromCharCode(chunk[j]);
        }
      }
      const base64 = btoa(binary);
      const mimeType = contentType.split(';')[0].trim();
      return new Response(
        JSON.stringify({ base64, mimeType }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType || 'text/plain',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});