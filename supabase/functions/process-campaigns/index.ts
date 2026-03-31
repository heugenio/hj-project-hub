import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_SENDS_PER_RUN = 3;
const SEND_DELAY_MS = 500;

let proxyCall: (endpoint: string, method?: string, body?: any) => Promise<any>;
let fetchParametro: (unemId: string, nome: string) => Promise<string>;
let sanitizeProvider: (v: string) => string;

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

    // ── Proxy call ──
    proxyCall = async (endpoint: string, method = 'GET', body?: any): Promise<any> => {
      console.log(`proxyCall: ${method} ${endpoint}`);
      const resp = await fetch(`${supabaseUrl}/functions/v1/api-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ baseUrl, endpoint, method, ...(body ? { body } : {}) }),
      });
      const raw = await resp.text();
      try { return JSON.parse(raw); } catch { return null; }
    };

    // ── fetchParametro ──
    fetchParametro = async (unemId: string, nome: string): Promise<string> => {
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
    sanitizeProvider = (v: string) => {
      const trimmed = v.trim();
      return VALID_PROVIDERS.find(p => p.toLowerCase() === trimmed.toLowerCase()) || '';
    };

    // ── Date range ──
    const hoje = new Date();
    const fmtDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dataFim = fmtDate(hoje);
    let dataIni = dataFim; // diaria: DATAINI = DATAFIM
    if (campaign.recorrencia === 'semanal') {
      const ini = new Date(hoje);
      ini.setDate(ini.getDate() - 7);
      dataIni = fmtDate(ini);
    }

    let totalEnviados = 0;
    let totalErros = 0;
    let sendCount = 0;

    // Helper to send a single contact – returns 'sent' | 'skipped' | 'error'
    const sendOne = async (
      contato: any, campaign: any,
      provider: string, token: string, device: string, phoneId: string,
      unemId: string
    ): Promise<'sent' | 'skipped' | 'error'> => {
      const num = (contato.TELE_NUMERO || '').replace(/\D/g, '');
      const ddd = (contato.TELE_DDD || '').replace(/\D/g, '');
      const phone = ddd + num;
      const foneFull = phone.startsWith('55') ? phone : '55' + phone;

      // Check already sent today
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
          return 'skipped';
        }
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

      const payload: any = {
        provider, token, number: phone, text: texto,
        type: campaign.imagem_url ? 'media' : 'text',
      };
      if (campaign.imagem_url) { payload.mediaType = 'image'; payload.file = campaign.imagem_url; }
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
        const success = !!sendData.success;
        const enviada = success ? 'Sim' : 'Nao';
        console.log(`Resultado ${foneFull}: ${enviada}`);

        // Register
        const regNow = new Date();
        const dataEnvio = `${regNow.getFullYear()}/${String(regNow.getMonth() + 1).padStart(2, '0')}/${String(regNow.getDate()).padStart(2, '0')} ${String(regNow.getHours()).padStart(2, '0')}:${String(regNow.getMinutes()).padStart(2, '0')}:${String(regNow.getSeconds()).padStart(2, '0')}`;
        await proxyCall('/setMsgWths', 'POST', {
          MSWE_ID: '', MSWE_MENSAGEM: texto, MSWE_TIPO: campaign.tipo,
          MSWE_FONE: foneFull, MSWE_DATA: dataEnvio, MSWE_ENVIADA: enviada, UNEM_ID: unemId,
        });

        return success ? 'sent' : 'error';
      } catch (err) {
        console.error(`Erro envio ${foneFull}:`, err);
        return 'error';
      }
    };

    // Helper to fetch and filter contacts
    const fetchContatos = async (unemId: string): Promise<any[]> => {
      const params = new URLSearchParams({
        MSWA_TIPO: campaign.tipo,
        UNEM_ID: unemId,
        DATAINI: dataIni,
        DATAFIM: dataFim,
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
      return contatos.filter((r: any) => {
        const num = (r.TELE_NUMERO || '').replace(/\D/g, '');
        if (num.length < 8) return false;
        const firstDigit = parseInt(num.charAt(0), 10);
        return !isNaN(firstDigit) && firstDigit > 6;
      });
    };

    // Helper to get provider params for a unit
    const getProviderParams = async (unemId: string) => {
      const [servidorRaw, token, device, phoneId] = await Promise.all([
        fetchParametro(unemId, 'SERVIDORWHATS'),
        fetchParametro(unemId, 'TOKENWHATS'),
        fetchParametro(unemId, 'DEVICEWHATS'),
        fetchParametro(unemId, 'PHONENUMBERID'),
      ]);
      return { provider: sanitizeProvider(servidorRaw), token, device, phoneId };
    };

    // Helper to process a list of contacts
    const processContatos = async (
      contatos: any[], provider: string, token: string, device: string, phoneId: string, unemId: string
    ) => {
      for (const contato of contatos) {
        if (sendCount >= MAX_SENDS_PER_RUN) break;
        const result = await sendOne(contato, campaign, provider, token, device, phoneId, unemId);
        if (result === 'skipped') continue; // don't count skipped against quota
        if (result === 'sent') totalEnviados++;
        else totalErros++;
        sendCount++;
        await new Promise(r => setTimeout(r, SEND_DELAY_MS));
      }
    };

    if (campaign.todas_unidades && campaign.empr_id) {
      // ── Todas unidades: use first 8 chars of empr_id as UNEM_ID ──
      const unemIdBase = campaign.empr_id.substring(0, 8);
      console.log(`Todas unidades: UNEM_ID base=${unemIdBase}, DATAINI=${dataIni}, DATAFIM=${dataFim}`);

      const allContatos = await fetchContatos(unemIdBase);
      console.log(`Todas unidades: ${allContatos.length} contatos válidos`);

      // Group by UNEM_ID from contacts to fetch params per unit
      const contatosByUnem: Record<string, any[]> = {};
      for (const c of allContatos) {
        const uid = c.UNEM_ID || c.unem_Id || unemIdBase;
        if (!contatosByUnem[uid]) contatosByUnem[uid] = [];
        contatosByUnem[uid].push(c);
      }

      const paramsCache: Record<string, { provider: string; token: string; device: string; phoneId: string }> = {};

      for (const [unemId, contatos] of Object.entries(contatosByUnem)) {
        if (sendCount >= MAX_SENDS_PER_RUN) break;

        if (!paramsCache[unemId]) {
          paramsCache[unemId] = await getProviderParams(unemId);
        }
        const { provider, token, device, phoneId } = paramsCache[unemId];
        if (!provider || !token) {
          console.log(`Unidade ${unemId}: provider ou token vazio – pulando`);
          continue;
        }
        console.log(`Unidade ${unemId}: provider=${provider}, ${contatos.length} contatos`);
        await processContatos(contatos, provider, token, device, phoneId, unemId);
      }
    } else if (campaign.filtro_unem_id) {
      // ── Single unit ──
      const unemId = campaign.filtro_unem_id;
      const { provider, token, device, phoneId } = await getProviderParams(unemId);

      if (!provider || !token) {
        console.log(`Unidade ${unemId}: provider ou token vazio – pulando`);
        await reschedule(sb, campaign, now);
        return jsonResp({ id: campaign.id, status: 'no_provider' });
      }
      console.log(`Unidade ${unemId}: provider=${provider}, token=OK`);

      const contatos = await fetchContatos(unemId);
      console.log(`Unidade ${unemId}: ${contatos.length} contatos válidos`);
      await processContatos(contatos, provider, token, device, phoneId, unemId);
    } else {
      await reschedule(sb, campaign, now);
      return jsonResp({ id: campaign.id, status: 'no_unidades' });
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
