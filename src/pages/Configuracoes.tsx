import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { toast } from "sonner";
import { getLogo } from "@/lib/api";
import { DEFAULT_API_BASE_URL, getApiBaseUrl, setApiBaseUrl } from "@/lib/base-url";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const N8N_DEFAULT = "https://n8n.srv1576408.hstgr.cloud/webhook-test/webhook-envio-direto";

export default function Configuracoes() {
  const [urlBase, setUrlBase] = useState(() => getApiBaseUrl());
  const [n8nUrl, setN8nUrl] = useState(() => localStorage.getItem("n8n_webhook_url") || N8N_DEFAULT);
  const [darkMode, setDarkMode] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleSave = () => {
    setApiBaseUrl(urlBase);
    localStorage.setItem("n8n_webhook_url", n8nUrl.trim());
    toast.success("Configurações salvas com sucesso!");
  };

  const handleTest = async () => {
    setTesting(true);
    // Temporarily save to test
    const previous = localStorage.getItem("hj_system_url_base");
    setApiBaseUrl(urlBase);
    try {
      await getLogo();
      toast.success("Conexão válida!", { icon: <CheckCircle className="h-4 w-4 text-green-500" /> });
    } catch {
      toast.error("Falha ao conectar. Verifique o endereço.", { icon: <XCircle className="h-4 w-4 text-destructive" /> });
      if (previous) setApiBaseUrl(previous);
      else setApiBaseUrl("");
    } finally {
      setTesting(false);
    }
  };

  const toggleDark = (checked: boolean) => {
    setDarkMode(checked);
    document.documentElement.classList.toggle("dark", checked);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Preferências do sistema</p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Conexão API</CardTitle>
          <CardDescription>Configure a URL base usada em todas as chamadas de API do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">URL Base</Label>
            <Input id="url" value={urlBase} onChange={(e) => setUrlBase(e.target.value)} placeholder="http://..." />
            <p className="text-xs text-muted-foreground">URL atual salva: {localStorage.getItem("hj_system_url_base") || DEFAULT_API_BASE_URL}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testando...</> : "Testar URL"}
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Envio de Mensagens (n8n)</CardTitle>
          <CardDescription>URL do webhook n8n usado para envio direto de mensagens WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="n8n">Webhook n8n</Label>
            <Input id="n8n" value={n8nUrl} onChange={(e) => setN8nUrl(e.target.value)} placeholder="https://..." />
            <p className="text-xs text-muted-foreground">URL atual: {localStorage.getItem("n8n_webhook_url") || N8N_DEFAULT}</p>
          </div>
          <Button onClick={handleSave}>Salvar</Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Aparência</CardTitle>
          <CardDescription>Personalizar aparência do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Modo Escuro</p>
              <p className="text-xs text-muted-foreground">Ativar tema escuro</p>
            </div>
            <Switch checked={darkMode} onCheckedChange={toggleDark} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}