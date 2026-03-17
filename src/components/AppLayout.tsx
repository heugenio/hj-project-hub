import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Wrench,
  TrendingUp,
  ArrowLeftRight,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronDown,
  BarChart3,
  LogOut,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Pedidos", url: "/pedidos", icon: ShoppingCart },
  { title: "Ordem de Serviço", url: "/ordem-servico", icon: Wrench },
];

const estoqueItems = [
  { title: "Produtos", url: "/estoque/produtos", icon: Package },
  { title: "Consulta Estoque Filiais", url: "/estoque/filiais", icon: Package },
  { title: "Consulta Estoque", url: "/estoque/consulta", icon: Package },
];

const reportItems = [
  { title: "Demonstrativo de Vendas", url: "/relatorios/vendas", icon: TrendingUp },
  { title: "Resumo de Movimentação", url: "/relatorios/movimentacao", icon: ArrowLeftRight },
];

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [estoqueOpen, setEstoqueOpen] = useState(true);
  const [reportsOpen, setReportsOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { auth, logout } = useAuth();
  const isActive = (path: string) => location.pathname === path;
  const isEstoqueActive = estoqueItems.some((i) => isActive(i.url));
  const isReportActive = reportItems.some((r) => isActive(r.url));

  const NavLink = ({
    item,
    mobile,
    indent = false,
  }: {
    item: { title: string; url: string; icon: React.ElementType };
    mobile: boolean;
    indent?: boolean;
  }) => (
    <Link
      to={item.url}
      onClick={() => mobile && setMobileOpen(false)}
      title={collapsed && !mobile ? item.title : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg text-sm transition-all duration-200 group relative",
        collapsed && !mobile ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
        indent && (!collapsed || mobile) && "pl-9",
        isActive(item.url)
          ? "bg-sidebar-primary/15 text-sidebar-primary font-medium"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
      )}
    >
      {isActive(item.url) && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />
      )}
      <item.icon className={cn("shrink-0", collapsed && !mobile ? "h-5 w-5" : "h-[18px] w-[18px]")} />
      {(!collapsed || mobile) && <span className="whitespace-nowrap">{item.title}</span>}
      {collapsed && !mobile && (
        <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-foreground text-background text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
          {item.title}
        </span>
      )}
    </Link>
  );

  const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("flex items-center border-b border-sidebar-border shrink-0", collapsed && !mobile ? "justify-center px-2 h-14" : "gap-2.5 px-4 h-14")}>
        <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-base shrink-0">
          HJ
        </div>
        {(!collapsed || mobile) && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-sidebar-foreground tracking-tight whitespace-nowrap" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>HJ Systems</p>
            <p className="text-[10px] text-sidebar-foreground/50 whitespace-nowrap">Gestão Empresarial</p>
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        <p className={cn("text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 mb-2", collapsed && !mobile ? "text-center" : "px-2")}>
          {collapsed && !mobile ? "•" : "Principal"}
        </p>
        {mainItems.map((item) => (
          <NavLink key={item.url} item={item} mobile={mobile} />
        ))}

        {/* Relatórios group */}
        <div className="mt-3">
          {collapsed && !mobile ? (
            // When collapsed, show just the icon with tooltip
            <div className="relative group">
              <button
                className={cn(
                  "flex items-center justify-center w-full px-2 py-2.5 rounded-lg text-sm transition-all duration-200",
                  isReportActive
                    ? "bg-sidebar-primary/15 text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                )}
                onClick={() => setReportsOpen(!reportsOpen)}
              >
                <BarChart3 className="h-5 w-5 shrink-0" />
              </button>
              <div className="absolute left-full ml-2 top-0 bg-sidebar border border-sidebar-border rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 py-1 min-w-[200px]">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">Relatórios</p>
                {reportItems.map((item) => (
                  <Link
                    key={item.url}
                    to={item.url}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                      isActive(item.url)
                        ? "text-sidebar-primary font-medium bg-sidebar-primary/10"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            // Expanded: show collapsible group
            <>
              <button
                onClick={() => setReportsOpen(!reportsOpen)}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                  isReportActive
                    ? "text-sidebar-primary font-medium"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                )}
              >
                <BarChart3 className="h-[18px] w-[18px] shrink-0" />
                <span className="whitespace-nowrap flex-1 text-left">Relatórios</span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", reportsOpen && "rotate-180")} />
              </button>
              {reportsOpen && (
                <div className="space-y-0.5 mt-0.5">
                  {reportItems.map((item) => (
                    <NavLink key={item.url} item={item} mobile={mobile} indent />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-2 py-3 space-y-0.5">
        <NavLink item={{ title: "Configurações", url: "/configuracoes", icon: Settings }} mobile={mobile} />

        <button
          onClick={() => { logout(); navigate("/login"); }}
          className={cn(
            "flex items-center gap-3 rounded-lg text-sm text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all duration-200 w-full",
            collapsed && !mobile ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
          )}
          title={collapsed && !mobile ? "Sair" : undefined}
        >
          <LogOut className={cn("shrink-0", collapsed && !mobile ? "h-5 w-5" : "h-[18px] w-[18px]")} />
          {(!collapsed || mobile) && <span>Sair</span>}
        </button>

        {!mobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center gap-3 rounded-lg text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-all duration-200 w-full px-3 py-2.5"
          >
            <ChevronLeft className={cn("h-[18px] w-[18px] shrink-0 transition-transform duration-300", collapsed && "rotate-180")} />
            {!collapsed && <span>Recolher</span>}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border shrink-0 transition-all duration-300 sticky top-0 h-screen",
          collapsed ? "w-[68px]" : "w-[240px]"
        )}
      >
        <NavContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] bg-sidebar shadow-2xl animate-in slide-in-from-left duration-300">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
            >
              <X className="h-5 w-5" />
            </button>
            <NavContent mobile />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 h-14 flex items-center gap-3 border-b border-border bg-card/90 backdrop-blur px-4 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-md text-muted-foreground hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Store info */}
          <div className="flex items-center gap-2 min-w-0">
            <Store className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">
              {auth?.unidade?.unem_Fantasia || '—'}
            </span>
            {auth?.unidade?.unem_CNPJ && (
              <span className="text-xs text-muted-foreground hidden md:inline">
                CNPJ: {auth.unidade.unem_CNPJ}
              </span>
            )}
          </div>

          <div className="flex-1" />

          {/* User info */}
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-foreground leading-tight">{auth?.user?.pess_Nome || auth?.user?.usrs_Nome_Login}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{auth?.user?.usrs_Nome_Login}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
              {(auth?.user?.pess_Nome || auth?.user?.usrs_Nome_Login || "U").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>

        <footer className="border-t border-border bg-card py-3">
          <p className="text-center text-[11px] text-muted-foreground">© 2026 HJ Systems — Gestão Empresarial</p>
        </footer>
      </div>
    </div>
  );
}
