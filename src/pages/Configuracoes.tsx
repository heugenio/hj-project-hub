import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { toast } from "sonner";

export default function Configuracoes() {
  const [urlBase, setUrlBase] = useState(() => localStorage.getItem("hj_system_url_base") || "http://hjsystems.dynns.com:8085");
  const [darkMode, setDarkMode] = useState(false);

  const handleSave = () => {
    localStorage.setItem("hj_system_url_base", urlBase);
    toast.success("Configurações salvas com sucesso!");
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
          <CardDescription>Configure a URL base da API do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">URL Base</Label>
            <Input id="url" value={urlBase} onChange={(e) => setUrlBase(e.target.value)} placeholder="http://..." />
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

      <Button onClick={handleSave} className="w-full sm:w-auto">
        Salvar Configurações
      </Button>
    </div>
  );
}
