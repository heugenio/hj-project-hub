import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { toast } from "sonner";
import { getLogo } from "@/lib/api";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function Configuracoes() {
  const [urlBase, setUrlBase] = useState(() => localStorage.getItem("hj_system_url_base") || "http://3.214.255.198:8085");
  const [darkMode, setDarkMode] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleSave = () => {
    localStorage.setItem("hj_system_url_base", urlBase);
    toast.success("URL salva com sucesso! Será usada em todas as chamadas de API.");
  };

  const handleTest = async () => {
    setTesting(true);
    // Temporarily save to test
    const previous = localStorage.getItem("hj_system_url_base");
    localStorage.setItem("hj_system_url_base", urlBase);
    try {
      await getLogo();
      toast.success("Conexão válida!", { icon: <CheckCircle className="h-4 w-4 text-green-500" /> });
    } catch {
      toast.error("Falha ao conectar. Verifique o endereço.", { icon: <XCircle className="h-4 w-4 text-destructive" /> });
      if (previous) localStorage.setItem("hj_system_url_base", previous);
      else localStorage.removeItem("hj_system_url_base");
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
            <p className="text-xs text-muted-foreground">URL atual salva: {localStorage.getItem("hj_system_url_base") || "nenhuma"}</p>
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