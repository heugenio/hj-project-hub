import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_SENDS_PER_RUN = 3;
const SEND_DELAY_MS = 500;

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
      .limit(1);

    if (fetchErr) throw fetchErr;
    if (!campaigns || campaigns.length === 0) {
      return jsonResp({ message: 'No campaigns due', processed: 0 });
    }

    const campaign = campaigns[0];
    console.log(`Processing campaign: ${campaign.nome} (${campaign.id}), tipo: ${campaign.tipo}`);

    const baseUrl = campaign.base_url || 'http://3.214.255.198:8085';

    // ── Proxy call identical to Marketing/Campanhas frontend ──
    const proxyCall = async (endpoint: string, method = 'GET', body?: any): Promise<any> => {
      console.log(`proxyCall: ${method} ${endpoint}`);
      const resp = await fetch(`${supabaseUrl}/functions/v1/api-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ baseUrl, endpoint, method, ...(body ? { body } : {}) }),
      });
      const raw = await resp.text();
      try {
        return JSON.parse(raw);
      } catch {
        console.log('proxyCall non-JSON response:', raw.substring(0, 200));
        return null;
      }
    };

    // ── fetchParametro – same logic as Marketing.tsx fetchParametro() ──
    const fetchParametro = async (unemId: string, nome: string): Promise<string> => {
      try {
        const data = await proxyCall(`/getParametros?UNEM_ID=${unemId}&nome=${encodeURIComponent(nome)}`);
        if (!data) return '';
        let result = data;
        if (typeof data === 'string') { try { result = JSON.parse(data); } catch { return ''; } }
        if (Array.isArray(result) && result.length > 0) return (result[0].PRMT_VALOR || '').trim();
        if (result && result.PRMT_VALOR) return (result.PRMT_VALOR || '').trim();
        return '';
      } catch { return ''; }
    };

    const VALID_PROVIDERS = ['Nexus', 'WhatsAppOficial', 'BrasilAPI'];
    const sanitizeProvider = (v: string) => {
      const trimmed = v.trim();
      return VALID_PROVIDERS.find(p => p.toLowerCase() === trimmed.toLowerCase()) || '';
    };

    // ── Get unidades ──
    let unidadeIds: string[] = [];
    if (campaign.todas_unidades && campaign.empr_id) {
      const unidades = await proxyCall(`/getUnidadesEmpresariais?empr_id=${campaign.empr_id}`);
      if (Array.isArray(unidades)) {
        unidadeIds = unidades.map((u: any) => u.unem_Id || u.UNEM_ID || '').filter(Boolean);
      }
      console.log(`Todas unidades: ${unidadeIds.length} encontradas`);
    } else if (campaign.filtro_unem_id) {
      unidadeIds = [campaign.filtro_unem_id];
    }

    if (unidadeIds.length === 0) {
      await reschedule(sb, campaign, now);
      return jsonResp({ id: campaign.id, status: 'no_unidades' });
    }

    let totalEnviados = 0;
    let totalErros = 0;
    let sendCount = 0;

    for (const unemId of unidadeIds) {
      if (sendCount >= MAX_SENDS_PER_RUN) break;

      // ── Fetch WhatsApp params in parallel – same as Marketing ──
      const [servidorRaw, token, device, phoneId] = await Promise.all([
        fetchParametro(unemId, 'SERVIDORWHATS'),
        fetchParametro(unemId, 'TOKENWHATS'),
        fetchParametro(unemId, 'DEVICEWHATS'),
        fetchParametro(unemId, 'PHONENUMBERID'),
      ]);

      const provider = sanitizeProvider(servidorRaw);
      if (!provider || !token) {
        console.log(`Unidade ${unemId}: provider="${servidorRaw}" token=${token ? 'OK' : 'VAZIO'} – pulando`);
        continue;
      }
      console.log(`Unidade ${unemId}: provider=${provider}, token=OK`);

      // ── Date range – same calculation as Marketing ──
      const hoje = new Date();
      const ini = new Date(hoje);
      ini.setDate(ini.getDate() - (campaign.recorrencia === 'semanal' ? 7 : 1));
      const fmtDate = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      // ── getContatosMsg – identical to Marketing.tsx gerarLista() ──
      const params = new URLSearchParams({
        MSWA_TIPO: campaign.tipo,
        UNEM_ID: unemId,
        DATAINI: fmtDate(ini),
        DATAFIM: fmtDate(hoje),
      });
      if (campaign.filtro_grupo) params.set('Grupo', campaign.filtro_grupo);
      if (campaign.filtro_produto) params.set('Produto', campaign.filtro_produto);

      const contatosRaw = await proxyCall(`/getContatosMsg?${params.toString()}`);

      let contatos: any[] = [];
      if (typeof contatosRaw === 'string') {
        try { contatos = JSON.parse(contatosRaw); } catch { contatos = []; }
      } else if (Array.isArray(contatosRaw)) {
        contatos = contatosRaw;
      }

      // ── Filter valid mobile numbers – same as Marketing ──
      contatos = contatos.filter((r: any) => {
        const num = (r.TELE_NUMERO || '').replace(/\D/g, '');
        if (num.length < 8) return false;
        const firstDigit = parseInt(num.charAt(0), 10);
        return !isNaN(firstDigit) && firstDigit > 6;
      });

      console.log(`Unidade ${unemId}: ${contatos.length} contatos válidos`);

      for (const contato of contatos) {
        if (sendCount >= MAX_SENDS_PER_RUN) break;

        const num = (contato.TELE_NUMERO || '').replace(/\D/g, '');
        const ddd = (contato.TELE_DDD || '').replace(/\D/g, '');
        const phone = ddd + num;
        const foneFull = phone.startsWith('55') ? phone : '55' + phone;

        // ── Check already sent – same as Marketing checkJaEnviada() ──
        const nowDate = new Date();
        const dataBr = `${String(nowDate.getDate()).padStart(2, '0')}/${String(nowDate.getMonth() + 1).padStart(2, '0')}/${nowDate.getFullYear()}`;
        try {
          const checkParams = new URLSearchParams({
            MSWE_TIPO: campaign.tipo,
            MSWE_FONE: foneFull,
            MSWE_DATA: dataBr,
          });
          const checkData = await proxyCall(`/getMsgWths?${checkParams.toString()}`);
          if (Array.isArray(checkData) && checkData.some((r: any) => (r.MSWE_ENVIADA || '').trim().toLowerCase() === 'sim')) {
            console.log(`${foneFull}: já enviada hoje, pulando`);
            continue;
          }
        } catch {}

        // ── Build message – same as Marketing ──
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

        // ── Send via send-message – same payload as Marketing ──
        const payload: any = {
          provider,
          token,
          number: phone,
          text: texto,
          type: campaign.imagem_url ? 'media' : 'text',
        };
        if (campaign.imagem_url) {
          payload.mediaType = 'image';
          payload.file = campaign.imagem_url;
        }
        if (provider === 'BrasilAPI') payload.device = device;
        if (provider === 'WhatsAppOficial') payload.phoneNumberId = phoneId;

        try {
          console.log(`Enviando para ${foneFull} via ${provider}...`);
          const sendResp = await fetch(`${supabaseUrl}/functions/v1/send-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
            body: JSON.stringify(payload),
          });
          const sendData = await sendResp.json();
          const enviada = sendData.success ? 'Sim' : 'Nao';
          console.log(`Resultado ${foneFull}: ${enviada}`, sendData.success ? '' : JSON.stringify(sendData).substring(0, 200));

          if (sendData.success) totalEnviados++; else totalErros++;

          // ── Register in API – same as Marketing registrarEnvio() ──
          const regNow = new Date();
          const dataEnvio = `${regNow.getFullYear()}/${String(regNow.getMonth() + 1).padStart(2, '0')}/${String(regNow.getDate()).padStart(2, '0')} ${String(regNow.getHours()).padStart(2, '0')}:${String(regNow.getMinutes()).padStart(2, '0')}:${String(regNow.getSeconds()).padStart(2, '0')}`;
          await proxyCall('/setMsgWths', 'POST', {
            MSWE_ID: '',
            MSWE_MENSAGEM: texto,
            MSWE_TIPO: campaign.tipo,
            MSWE_FONE: foneFull,
            MSWE_DATA: dataEnvio,
            MSWE_ENVIADA: enviada,
            UNEM_ID: unemId,
          });

          sendCount++;
          await new Promise(r => setTimeout(r, SEND_DELAY_MS));
        } catch (err) {
          console.error(`Erro envio ${foneFull}:`, err);
          totalErros++;
          sendCount++;
        }
      }
    }

    // ── Reschedule ──
    await reschedule(sb, campaign, now, totalEnviados, totalErros);
    console.log(`Campaign ${campaign.nome} done: enviados=${totalEnviados}, erros=${totalErros}, sendCount=${sendCount}`);

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
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
