import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCorporacoes,
  getEmpresas,
  getUnidadesEmpresariais,
  getUsuarios,
  getLogo,
  type Corporacao,
  type Empresa,
  type UnidadeEmpresarial,
  type Usuario,
} from "@/lib/api";
import { Loader2, Eye, EyeOff, Settings } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  // Logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Corporações
  const [corporacoes, setCorporacoes] = useState<Corporacao[]>([]);
  const [selectedCprc, setSelectedCprc] = useState<string>("");
  const [loadingCorp, setLoadingCorp] = useState(false);

  // Empresas
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("");
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);

  // Unidades
  const [unidades, setUnidades] = useState<UnidadeEmpresarial[]>([]);
  const [selectedUnidade, setSelectedUnidade] = useState<string>("");
  const [loadingUnidades, setLoadingUnidades] = useState(false);

  // Usuarios
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [selectedUsuario, setSelectedUsuario] = useState<string>("");
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);

  // Password
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated]);

  // Load logo + corporações on mount
  useEffect(() => {
    getLogo().then(setLogoUrl).catch(() => {});
    setLoadingCorp(true);
    getCorporacoes()
      .then((data) => {
        setCorporacoes(data);
        // Auto-select if only one
        if (data.length === 1) {
          setSelectedCprc(data[0].cprc_id);
        }
      })
      .catch(() => toast.error("Erro ao carregar corporações"))
      .finally(() => setLoadingCorp(false));
  }, []);

  // When corporação selected → load empresas
  useEffect(() => {
    if (!selectedCprc) return;
    setEmpresas([]);
    setSelectedEmpresa("");
    setUnidades([]);
    setSelectedUnidade("");
    setUsuarios([]);
    setSelectedUsuario("");
    setLoadingEmpresas(true);
    getEmpresas(selectedCprc)
      .then(setEmpresas)
      .catch(() => toast.error("Erro ao carregar empresas"))
      .finally(() => setLoadingEmpresas(false));
  }, [selectedCprc]);

  // When empresa selected → load unidades
  useEffect(() => {
    if (!selectedEmpresa) return;
    setUnidades([]);
    setSelectedUnidade("");
    setUsuarios([]);
    setSelectedUsuario("");
    setLoadingUnidades(true);
    getUnidadesEmpresariais(selectedEmpresa)
      .then(setUnidades)
      .catch(() => toast.error("Erro ao carregar unidades empresariais"))
      .finally(() => setLoadingUnidades(false));
  }, [selectedEmpresa]);

  // When unidade selected → load usuarios
  useEffect(() => {
    if (!selectedUnidade) return;
    setUsuarios([]);
    setSelectedUsuario("");
    setLoadingUsuarios(true);
    getUsuarios(selectedUnidade)
      .then(setUsuarios)
      .catch(() => toast.error("Erro ao carregar usuários"))
      .finally(() => setLoadingUsuarios(false));
  }, [selectedUnidade]);

  const handleLogin = () => {
    const user = usuarios.find((u) => u.usrs_ID === selectedUsuario);
    const unidade = unidades.find((u) => u.unem_Id === selectedUnidade);
    if (!user || !unidade) {
      toast.error("Selecione todos os campos");
      return;
    }
    if (!password) {
      toast.error("Informe a senha");
      return;
    }
    setLoggingIn(true);
    // Validate password
    if (password === user.usrs_Senha) {
      setTimeout(() => {
        login(user, unidade);
        toast.success(`Bem-vindo, ${user.pess_Nome || user.usrs_Nome_Login}!`);
        navigate("/", { replace: true });
      }, 800);
    } else {
      setLoggingIn(false);
      toast.error("A senha informada está incorreta, por favor, tente novamente.");
    }
  };

  const canLogin = selectedCprc && selectedEmpresa && selectedUnidade && selectedUsuario && password;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardContent className="pt-8 pb-6 px-6 space-y-6">
          {/* Logo */}
          <div className="flex justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-20 object-contain" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                HJ
              </div>
            )}
          </div>

          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              HJ Systems
            </h1>
            <p className="text-sm text-muted-foreground">Gestão Empresarial</p>
          </div>

          {/* Corporação */}
          <div className="space-y-2">
            <Label>Corporação</Label>
            <Select value={selectedCprc} onValueChange={setSelectedCprc} disabled={loadingCorp}>
              <SelectTrigger>
                <SelectValue placeholder={loadingCorp ? "Carregando..." : "Selecione a corporação"} />
              </SelectTrigger>
              <SelectContent>
                {corporacoes.map((c) => (
                  <SelectItem key={c.cprc_id} value={c.cprc_id}>
                    {c.cprc_Nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Empresa */}
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa} disabled={!selectedCprc || loadingEmpresas}>
              <SelectTrigger>
                <SelectValue placeholder={loadingEmpresas ? "Carregando..." : "Selecione a empresa"} />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.empr_id} value={e.empr_id}>
                    {e.empr_Nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unidade Empresarial */}
          <div className="space-y-2">
            <Label>Unidade Empresarial</Label>
            <Select value={selectedUnidade} onValueChange={setSelectedUnidade} disabled={!selectedEmpresa || loadingUnidades}>
              <SelectTrigger>
                <SelectValue placeholder={loadingUnidades ? "Carregando..." : "Selecione a unidade"} />
              </SelectTrigger>
              <SelectContent>
                {unidades.map((u) => (
                  <SelectItem key={u.unem_Id} value={u.unem_Id}>
                    {u.unem_Fantasia}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Usuário */}
          <div className="space-y-2">
            <Label>Usuário</Label>
            <Select value={selectedUsuario} onValueChange={setSelectedUsuario} disabled={!selectedUnidade || loadingUsuarios}>
              <SelectTrigger>
                <SelectValue placeholder={loadingUsuarios ? "Carregando..." : "Selecione o usuário"} />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map((u) => (
                  <SelectItem key={u.usrs_ID} value={u.usrs_ID}>
                    {u.usrs_Nome_Login}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Senha */}
          <div className="space-y-2">
            <Label>Senha</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                onKeyDown={(e) => e.key === "Enter" && canLogin && handleLogin()}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <Button onClick={handleLogin} disabled={!canLogin || loggingIn} className="w-full">
            {loggingIn ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </Button>

          {/* Settings link */}
          <div className="flex justify-end">
            <button
              onClick={() => navigate("/configuracoes")}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              Configurações
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
