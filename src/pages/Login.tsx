import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  getBanner,
  type Corporacao,
  type Empresa,
  type UnidadeEmpresarial,
  type Usuario,
} from "@/lib/api";
import { Loader2, Eye, EyeOff, Settings } from "lucide-react";
import hjSystemsLogo from "@/assets/hj_systems.png";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(true);
  const [corporacoes, setCorporacoes] = useState<Corporacao[]>([]);
  const [selectedCprc, setSelectedCprc] = useState("");
  const [loadingCorp, setLoadingCorp] = useState(false);

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState("");
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);

  const [unidades, setUnidades] = useState<UnidadeEmpresarial[]>([]);
  const [selectedUnidade, setSelectedUnidade] = useState("");
  const [loadingUnidades, setLoadingUnidades] = useState(false);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [selectedUsuario, setSelectedUsuario] = useState("");
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated]);

  useEffect(() => {
    setLogoLoading(true);
    getBanner()
      .then(setLogoUrl)
      .catch(() => {})
      .finally(() => setLogoLoading(false));
    setLoadingCorp(true);
    getCorporacoes()
      .then((data) => {
        setCorporacoes(data);
        if (data.length === 1) setSelectedCprc(data[0].cprc_id);
      })
      .catch(() => toast.error("Erro ao carregar corporações"))
      .finally(() => setLoadingCorp(false));
  }, []);

  useEffect(() => {
    if (!selectedCprc) return;
    setEmpresas([]); setSelectedEmpresa("");
    setUnidades([]); setSelectedUnidade("");
    setUsuarios([]); setSelectedUsuario("");
    setLoadingEmpresas(true);
    getEmpresas(selectedCprc)
      .then(setEmpresas)
      .catch(() => toast.error("Erro ao carregar empresas"))
      .finally(() => setLoadingEmpresas(false));
  }, [selectedCprc]);

  useEffect(() => {
    if (!selectedEmpresa) return;
    setUnidades([]); setSelectedUnidade("");
    setUsuarios([]); setSelectedUsuario("");
    setLoadingUnidades(true);
    getUnidadesEmpresariais(selectedEmpresa)
      .then(setUnidades)
      .catch(() => toast.error("Erro ao carregar unidades"))
      .finally(() => setLoadingUnidades(false));
  }, [selectedEmpresa]);

  useEffect(() => {
    if (!selectedUnidade) return;
    setUsuarios([]); setSelectedUsuario("");
    setLoadingUsuarios(true);
    getUsuarios(selectedUnidade)
      .then(setUsuarios)
      .catch(() => toast.error("Erro ao carregar usuários"))
      .finally(() => setLoadingUsuarios(false));
  }, [selectedUnidade]);

  const handleLogin = () => {
    const user = usuarios.find((u) => u.usrs_ID === selectedUsuario);
    const unidade = unidades.find((u) => u.unem_Id === selectedUnidade);
    if (!user || !unidade) { toast.error("Selecione todos os campos"); return; }
    if (!password) { toast.error("Informe a senha"); return; }
    setLoggingIn(true);
    if (password === user.usrs_Senha) {
      setTimeout(() => {
        login(user, unidade);
        toast.success(`Bem-vindo, ${user.pess_Nome || user.usrs_Nome_Login}!`);
        navigate("/", { replace: true });
      }, 800);
    } else {
      setLoggingIn(false);
      toast.error("Senha incorreta, tente novamente.");
    }
  };

  const canLogin = selectedCprc && selectedEmpresa && selectedUnidade && selectedUsuario && password;

  return (
    <div className="min-h-screen flex">
      {/* Left panel — Logo */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center overflow-hidden" style={{ background: "hsl(var(--sidebar-background))" }}>
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 25% 25%, hsl(var(--sidebar-primary)) 0%, transparent 50%), radial-gradient(circle at 75% 75%, hsl(var(--sidebar-primary)) 0%, transparent 50%)",
        }} />
        <div className="relative z-10 flex flex-col items-center justify-center gap-8 px-12 h-full">
          <div className="flex-1 flex items-center justify-center">
            {logoLoading ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin" style={{ color: "hsl(var(--sidebar-foreground) / 0.4)" }} />
                <p className="text-sm" style={{ color: "hsl(var(--sidebar-foreground) / 0.5)" }}>Carregando...</p>
              </div>
            ) : logoUrl ? (
              <img src={logoUrl} alt="Banner da Empresa" className="max-h-[70vh] max-w-[90%] w-full object-contain drop-shadow-2xl" />
            ) : (
              <div className="w-32 h-32 rounded-2xl flex items-center justify-center text-5xl font-bold" style={{
                background: "hsl(var(--sidebar-primary))",
                color: "hsl(var(--sidebar-primary-foreground))",
                fontFamily: "'Space Grotesk', sans-serif",
              }}>
                HJ
              </div>
            )}
          </div>
          {/* Footer credits */}
          <div className="pb-6 flex flex-col items-center gap-2">
            <img src={hjSystemsLogo} alt="HJ-Systems" className="h-8 object-contain opacity-60" />
            <p className="text-xs" style={{ color: "hsl(var(--sidebar-foreground) / 0.4)" }}>
              Gestão de Negócios
            </p>
          </div>
        </div>
      </div>

      {/* Right panel — Form */}
      <div className="flex-1 flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-md space-y-7">
          {/* Mobile logo */}
          <div className="flex flex-col items-center gap-3 lg:hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-16 object-contain" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                HJ
              </div>
            )}
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>HJ Systems</h1>
          </div>

          <div className="hidden lg:block">
            <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Entrar no sistema
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Selecione sua empresa e informe suas credenciais
            </p>
          </div>

          <div className="space-y-5">
            {/* Corporação */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Corporação</Label>
              <Select value={selectedCprc} onValueChange={setSelectedCprc} disabled={loadingCorp}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={loadingCorp ? "Carregando..." : "Selecione a corporação"} />
                </SelectTrigger>
                <SelectContent>
                  {corporacoes.map((c) => (
                    <SelectItem key={c.cprc_id} value={c.cprc_id}>{c.cprc_Nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Empresa */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa</Label>
              <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa} disabled={!selectedCprc || loadingEmpresas}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={loadingEmpresas ? "Carregando..." : "Selecione a empresa"} />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.empr_id} value={e.empr_id}>{e.empr_Nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Unidade */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unidade Empresarial</Label>
              <Select value={selectedUnidade} onValueChange={setSelectedUnidade} disabled={!selectedEmpresa || loadingUnidades}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={loadingUnidades ? "Carregando..." : "Selecione a unidade"} />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.unem_Id} value={u.unem_Id}>{u.unem_Fantasia}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Usuário */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Usuário</Label>
              <Select value={selectedUsuario} onValueChange={setSelectedUsuario} disabled={!selectedUnidade || loadingUsuarios}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={loadingUsuarios ? "Carregando..." : "Selecione o usuário"} />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((u) => (
                    <SelectItem key={u.usrs_ID} value={u.usrs_ID}>{u.usrs_Nome_Login}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="h-11 pr-10"
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

            <Button onClick={handleLogin} disabled={!canLogin || loggingIn} className="w-full h-11 text-sm font-semibold">
              {loggingIn ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Entrando...</>
              ) : (
                "Entrar"
              )}
            </Button>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => navigate("/configuracoes")}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              Configurações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
