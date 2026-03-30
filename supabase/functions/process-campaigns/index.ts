import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Fetch active campaigns that are due
    const { data: campaigns, error: fetchErr } = await sb
      .from('campanhas_agendadas')
      .select('*')
      .eq('ativo', true)
      .or(`proxima_execucao.is.null,proxima_execucao.lte.${now.toISOString()}`);

    if (fetchErr) throw fetchErr;
    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ message: 'No campaigns due', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];

    for (const campaign of campaigns) {
      try {
        console.log(`Processing campaign: ${campaign.nome} (${campaign.id})`);

        // Determine which unidades to process
        let unidadeIds: string[] = [];

        if (campaign.todas_unidades) {
          // We need to get all unidades from the external API
          // We'll call api-proxy to fetch them
          const proxyResp = await fetch(`${supabaseUrl}/functions/v1/api-proxy`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
              baseUrl: campaign.base_url || 'http://3.214.255.198:8085',
              endpoint: '/getUnidadesEmpresariais?empr_id=' + (campaign.empr_id || ''),
              method: 'GET',
            }),
          });
          const unidades = await proxyResp.json();
          if (Array.isArray(unidades)) {
            unidadeIds = unidades.map((u: any) => u.unem_Id || u.UNEM_ID || '').filter(Boolean);
          }
        } else if (campaign.filtro_unem_id) {
          unidadeIds = [campaign.filtro_unem_id];
        }

        if (unidadeIds.length === 0) {
          console.log(`No unidades found for campaign ${campaign.nome}`);
          results.push({ id: campaign.id, nome: campaign.nome, status: 'no_unidades' });
          continue;
        }

        let totalEnviados = 0;
        let totalErros = 0;

        for (const unemId of unidadeIds) {
          // 1. Fetch provider params for this unidade
          const fetchParam = async (nome: string): Promise<string> => {
            try {
              const resp = await fetch(`${supabaseUrl}/functions/v1/api-proxy`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${anonKey}`,
                },
                body: JSON.stringify({
                  baseUrl: campaign.base_url || 'http://3.214.255.198:8085',
                  endpoint: `/getParametros?UNEM_ID=${unemId}&nome=${encodeURIComponent(nome)}`,
                  method: 'GET',
                }),
              });
              const data = await resp.json();
              if (Array.isArray(data) && data.length > 0) return (data[0].PRMT_VALOR || '').trim();
              return '';
            } catch { return ''; }
          };

          const [servidor, token, device, phoneId] = await Promise.all([
            fetchParam('SERVIDORWHATS'),
            fetchParam('TOKENWHATS'),
            fetchParam('DEVICEWHATS'),
            fetchParam('PHONENUMBERID'),
          ]);

          const provider = servidor.trim();
          if (!provider || !token) {
            console.log(`Unidade ${unemId}: sem provedor configurado, pulando`);
            continue;
          }

          // 2. Fetch contacts for this campaign type + unidade
          const params = new URLSearchParams();
          params.set('MSWA_TIPO', campaign.tipo);
          params.set('UNEM_ID', unemId);
          if (campaign.filtro_grupo) params.set('Grupo', campaign.filtro_grupo);
          if (campaign.filtro_produto) params.set('Produto', campaign.filtro_produto);

          // Calculate date range based on recurrence
          const hoje = new Date();
          const fim = new Date(hoje);
          const ini = new Date(hoje);
          if (campaign.recorrencia === 'semanal') {
            ini.setDate(ini.getDate() - 7);
          } else {
            ini.setDate(ini.getDate() - 1);
          }
          const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          params.set('DATAINI', fmtDate(ini));
          params.set('DATAFIM', fmtDate(fim));

          const contatosResp = await fetch(`${supabaseUrl}/functions/v1/api-proxy`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
              baseUrl: campaign.base_url || 'http://3.214.255.198:8085',
              endpoint: `/getContatosMsg?${params.toString()}`,
              method: 'GET',
            }),
          });
          const contatosData = await contatosResp.json();
          const contatos = Array.isArray(contatosData) ? contatosData : [];

          console.log(`Unidade ${unemId}: ${contatos.length} contatos encontrados`);

          // 3. Send messages
          for (const contato of contatos) {
            const num = (contato.TELE_NUMERO || '').replace(/\D/g, '');
            if (num.length < 8) continue;
            // Validate mobile
            const firstDigit = parseInt(num.charAt(0), 10);
            if (isNaN(firstDigit) || firstDigit <= 6) continue;

            const ddd = (contato.TELE_DDD || '').replace(/\D/g, '');
            const phone = ddd + num;

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

            // Check if already sent today
            const nowDate = new Date();
            const dataBr = `${String(nowDate.getDate()).padStart(2,'0')}/${String(nowDate.getMonth()+1).padStart(2,'0')}/${nowDate.getFullYear()}`;
            const foneFull = phone.startsWith('55') ? phone : '55' + phone;

            try {
              const checkResp = await fetch(`${supabaseUrl}/functions/v1/api-proxy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
                body: JSON.stringify({
                  baseUrl: campaign.base_url || 'http://3.214.255.198:8085',
                  endpoint: `/getMsgWths?MSWE_TIPO=${campaign.tipo}&MSWE_FONE=${foneFull}&MSWE_DATA=${dataBr}`,
                  method: 'GET',
                }),
              });
              const checkData = await checkResp.json();
              const jaEnviada = Array.isArray(checkData)
                ? checkData.some((r: any) => (r.MSWE_ENVIADA || '').trim().toLowerCase() === 'sim')
                : false;
              if (jaEnviada) continue;
            } catch {}

            // Send
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
              await fetch(`${supabaseUrl}/functions/v1/api-proxy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
                body: JSON.stringify({
                  baseUrl: campaign.base_url || 'http://3.214.255.198:8085',
                  endpoint: '/setMsgWths',
                  method: 'POST',
                  body: {
                    MSWE_ID: '', MSWE_MENSAGEM: texto, MSWE_TIPO: campaign.tipo,
                    MSWE_FONE: foneFull, MSWE_DATA: dataEnvio, MSWE_ENVIADA: enviada, UNEM_ID: unemId,
                  },
                }),
              });

              // Small delay between sends
              await new Promise(r => setTimeout(r, 1000));
            } catch (err) {
              console.error(`Erro envio para ${phone}:`, err);
              totalErros++;
            }
          }
        }

        // Calculate next execution
        const nextExec = new Date(now);
        if (campaign.recorrencia === 'semanal') {
          nextExec.setDate(nextExec.getDate() + 7);
        } else {
          nextExec.setDate(nextExec.getDate() + 1);
        }
        // Set to configured time
        if (campaign.horario) {
          const [h, m] = campaign.horario.split(':');
          nextExec.setHours(parseInt(h), parseInt(m), 0, 0);
        }

        await sb.from('campanhas_agendadas').update({
          ultima_execucao: now.toISOString(),
          proxima_execucao: nextExec.toISOString(),
          total_enviados: (campaign.total_enviados || 0) + totalEnviados,
          total_erros: (campaign.total_erros || 0) + totalErros,
          updated_at: now.toISOString(),
        }).eq('id', campaign.id);

        results.push({ id: campaign.id, nome: campaign.nome, enviados: totalEnviados, erros: totalErros });
      } catch (err: any) {
        console.error(`Erro na campanha ${campaign.nome}:`, err);
        results.push({ id: campaign.id, nome: campaign.nome, error: err.message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Process campaigns error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
