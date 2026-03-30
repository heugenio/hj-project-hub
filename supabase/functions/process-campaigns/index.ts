import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_SENDS_PER_RUN = 5; // limit per invocation to avoid timeout
const SEND_DELAY_MS = 800;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const now = new Date();

    const { data: campaigns, error: fetchErr } = await sb
      .from('campanhas_agendadas')
      .select('*')
      .eq('ativo', true)
      .lte('proxima_execucao', now.toISOString())
      .limit(1); // process one campaign per run

    if (fetchErr) throw fetchErr;
    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ message: 'No campaigns due', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const campaign = campaigns[0];
    console.log(`Processing campaign: ${campaign.nome} (${campaign.id})`);

    const baseUrl = campaign.base_url || 'http://3.214.255.198:8085';

    const proxyCall = async (endpoint: string, method = 'GET', body?: any) => {
      const resp = await fetch(`${supabaseUrl}/functions/v1/api-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ baseUrl, endpoint, method, ...(body ? { body } : {}) }),
      });
      return resp.json();
    };

    const fetchParam = async (unemId: string, nome: string): Promise<string> => {
      try {
        const data = await proxyCall(`/getParametros?UNEM_ID=${unemId}&nome=${encodeURIComponent(nome)}`);
        if (Array.isArray(data) && data.length > 0) return (data[0].PRMT_VALOR || '').trim();
        return '';
      } catch { return ''; }
    };

    // Get unidades
    let unidadeIds: string[] = [];
    if (campaign.todas_unidades && campaign.empr_id) {
      const unidades = await proxyCall(`/getUnidadesEmpresariais?empr_id=${campaign.empr_id}`);
      if (Array.isArray(unidades)) {
        unidadeIds = unidades.map((u: any) => u.unem_Id || u.UNEM_ID || '').filter(Boolean);
      }
    } else if (campaign.filtro_unem_id) {
      unidadeIds = [campaign.filtro_unem_id];
    }

    if (unidadeIds.length === 0) {
      // No unidades, skip and reschedule
      await reschedule(sb, campaign, now);
      return jsonResp({ id: campaign.id, status: 'no_unidades' });
    }

    let totalEnviados = 0;
    let totalErros = 0;
    let sendCount = 0;

    for (const unemId of unidadeIds) {
      if (sendCount >= MAX_SENDS_PER_RUN) break;

      const [servidor, token, device, phoneId] = await Promise.all([
        fetchParam(unemId, 'SERVIDORWHATS'),
        fetchParam(unemId, 'TOKENWHATS'),
        fetchParam(unemId, 'DEVICEWHATS'),
        fetchParam(unemId, 'PHONENUMBERID'),
      ]);

      const provider = servidor.trim();
      if (!provider || !token) {
        console.log(`Unidade ${unemId}: sem provedor, pulando`);
        continue;
      }

      // Date range
      const hoje = new Date();
      const ini = new Date(hoje);
      ini.setDate(ini.getDate() - (campaign.recorrencia === 'semanal' ? 7 : 1));
      const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

      const params = new URLSearchParams({
        MSWA_TIPO: campaign.tipo,
        UNEM_ID: unemId,
        DATAINI: fmtDate(ini),
        DATAFIM: fmtDate(hoje),
      });
      if (campaign.filtro_grupo) params.set('Grupo', campaign.filtro_grupo);
      if (campaign.filtro_produto) params.set('Produto', campaign.filtro_produto);

      const contatos = await proxyCall(`/getContatosMsg?${params.toString()}`);
      if (!Array.isArray(contatos)) continue;

      console.log(`Unidade ${unemId}: ${contatos.length} contatos`);

      for (const contato of contatos) {
        if (sendCount >= MAX_SENDS_PER_RUN) break;

        const num = (contato.TELE_NUMERO || '').replace(/\D/g, '');
        if (num.length < 8) continue;
        const firstDigit = parseInt(num.charAt(0), 10);
        if (isNaN(firstDigit) || firstDigit <= 6) continue;

        const ddd = (contato.TELE_DDD || '').replace(/\D/g, '');
        const phone = ddd + num;
        const foneFull = phone.startsWith('55') ? phone : '55' + phone;

        // Check already sent
        const nowDate = new Date();
        const dataBr = `${String(nowDate.getDate()).padStart(2,'0')}/${String(nowDate.getMonth()+1).padStart(2,'0')}/${nowDate.getFullYear()}`;
        try {
          const checkData = await proxyCall(`/getMsgWths?MSWE_TIPO=${campaign.tipo}&MSWE_FONE=${foneFull}&MSWE_DATA=${dataBr}`);
          if (Array.isArray(checkData) && checkData.some((r: any) => (r.MSWE_ENVIADA || '').trim().toLowerCase() === 'sim')) continue;
        } catch {}

        // Build message
        const isFisica = (contato.PESS_FISICO_JURIDICO || '').toUpperCase().includes('FISIC');
        const sexo = (contato.PESS_SEXO || '').toUpperCase();
        const tratamento = isFisica ? (sexo === 'F' ? 'Sra' : 'Sr') : '';
        const nomeCliente = tratamento ? `${tratamento} ${contato.PESS_NOME || ''}` : (contato.PESS_NOME || '');

        const texto = campaign.mensagem
          .replace('{NOME_CLIENTE}', nomeCliente)
          .replace('{DATA_ULTIMA_COMPRA}', (contato.DCFS_DATA_NOTA || '').split(' ')[0])
          .replace('{EMPR}', contato.UNEM_FANTASIA || '')
          .replace('{NOME_LOJA}', contato.UNEM_FANTASIA || '')
          .replace('{URL_LOJA}', contato.UNEM_MSG_ASSINATURA || '')
          .replace('{ENDLOJA}', contato.UNEM_ENDERECO || '')
          .replace(/\\n/g, '\n');

        // Send
        const payload: any = { provider, token, number: phone, text: texto, type: campaign.imagem_url ? 'media' : 'text' };
        if (campaign.imagem_url) { payload.mediaType = 'image'; payload.file = campaign.imagem_url; }
        if (provider === 'BrasilAPI') payload.device = device;
        if (provider === 'WhatsAppOficial') payload.phoneNumberId = phoneId;

        try {
          const sendResp = await fetch(`${supabaseUrl}/functions/v1/send-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
            body: JSON.stringify(payload),
          });
          const sendData = await sendResp.json();
          const enviada = sendData.success ? 'Sim' : 'Nao';
          if (sendData.success) totalEnviados++; else totalErros++;

          // Register
          const regNow = new Date();
          const dataEnvio = `${regNow.getFullYear()}/${String(regNow.getMonth()+1).padStart(2,'0')}/${String(regNow.getDate()).padStart(2,'0')} ${String(regNow.getHours()).padStart(2,'0')}:${String(regNow.getMinutes()).padStart(2,'0')}:${String(regNow.getSeconds()).padStart(2,'0')}`;
          await proxyCall('/setMsgWths', 'POST', {
            MSWE_ID: '', MSWE_MENSAGEM: texto, MSWE_TIPO: campaign.tipo,
            MSWE_FONE: foneFull, MSWE_DATA: dataEnvio, MSWE_ENVIADA: enviada, UNEM_ID: unemId,
          });
          sendCount++;
          await new Promise(r => setTimeout(r, SEND_DELAY_MS));
        } catch (err) {
          console.error(`Erro envio ${phone}:`, err);
          totalErros++;
          sendCount++;
        }
      }
    }

    // Reschedule
    await reschedule(sb, campaign, now, totalEnviados, totalErros);

    return jsonResp({ id: campaign.id, nome: campaign.nome, enviados: totalEnviados, erros: totalErros });
  } catch (err: any) {
    console.error('Process campaigns error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function reschedule(sb: any, campaign: any, now: Date, enviados = 0, erros = 0) {
  const next = new Date(now);
  if (campaign.recorrencia === 'semanal') next.setDate(next.getDate() + 7);
  else next.setDate(next.getDate() + 1);
  if (campaign.horario) {
    const [h, m] = campaign.horario.split(':');
    next.setHours(parseInt(h), parseInt(m), 0, 0);
  }
  await sb.from('campanhas_agendadas').update({
    ultima_execucao: now.toISOString(),
    proxima_execucao: next.toISOString(),
    total_enviados: (campaign.total_enviados || 0) + enviados,
    total_erros: (campaign.total_erros || 0) + erros,
    updated_at: now.toISOString(),
  }).eq('id', campaign.id);
}

function jsonResp(data: any) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Content-Type': 'application/json',
    },
  });
}
