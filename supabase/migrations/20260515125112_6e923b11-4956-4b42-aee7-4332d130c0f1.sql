UPDATE public.campanhas_agendadas
SET n8n_webhook_url = 'https://n8n.srv1576408.hstgr.cloud/webhook-test/webhook-envio-direto',
    updated_at = now()
WHERE n8n_webhook_url IS NULL OR n8n_webhook_url = '';