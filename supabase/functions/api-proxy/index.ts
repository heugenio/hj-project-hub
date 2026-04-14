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
    const { baseUrl, endpoint, method, body } = await req.json();

    if (!baseUrl || !endpoint || !endpoint.startsWith('/')) {
      return new Response(
        JSON.stringify({ error: 'Invalid request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = `${baseUrl}${endpoint}`;
    const fetchOptions: RequestInit = {
      method: method || 'GET',
      headers: {
        'Authorization': BASIC_AUTH,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    };

    const response = await fetch(url, fetchOptions);

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
    
    // If the response looks like HTML (not JSON), check if it's a success response
    const trimmed = text.trim();
    
    // Log raw response for debugging (especially for token endpoints)
    if (endpoint.includes('getGerarToken') || endpoint.includes('Token')) {
      console.log(`[api-proxy] Raw response for ${endpoint} (${trimmed.length} chars):`, trimmed.substring(0, 500));
    }
    
    if (trimmed.startsWith('<') && !trimmed.startsWith('[') && !trimmed.startsWith('{')) {
      // Try to extract JSON or token from HTML wrapper
      const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log(`[api-proxy] Extracted JSON from HTML:`, jsonMatch[0].substring(0, 300));
        return new Response(jsonMatch[0], {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (trimmed.includes('200 OK') || (response.status >= 200 && response.status < 300)) {
        return new Response(
          JSON.stringify({ success: true, message: '200 OK', rawHtml: trimmed.substring(0, 1000) }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: `Backend returned HTML instead of JSON: ${trimmed.substring(0, 200)}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to ensure valid JSON response
    let jsonText = trimmed;
    if (trimmed && !trimmed.startsWith('[') && !trimmed.startsWith('{')) {
      // Non-JSON text response — wrap it
      if (response.status >= 200 && response.status < 300) {
        jsonText = JSON.stringify({ success: true, message: trimmed || '200 OK' });
      } else {
        jsonText = JSON.stringify({ error: trimmed });
      }
    }
    
    return new Response(jsonText || JSON.stringify({ success: true }), {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
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
