import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", url: "/" },
  { title: "Estoque", url: "/estoque" },
  { title: "Pedidos", url: "/pedidos" },
  { title: "Ordem de Serviço", url: "/ordem-servico" },
  { title: "Vendas", url: "/relatorios/vendas" },
  { title: "Movimentação", url: "/relatorios/movimentacao" },
  { title: "Configurações", url: "/configuracoes" },
];

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-card border-b border-border backdrop-blur supports-[backdrop-filter]:bg-card/90">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              HJ
            </div>
            <span className="font-bold text-foreground tracking-tight hidden sm:inline" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              HJ Systems
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.url}
                to={item.url}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  isActive(item.url)
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {item.title}
              </Link>
            ))}
          </nav>

          {/* User + Mobile toggle */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
              U
            </div>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-md text-muted-foreground hover:bg-muted"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className="lg:hidden border-t border-border bg-card px-4 py-2 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.url}
                to={item.url}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-3 py-2 text-sm rounded-md transition-colors",
                  isActive(item.url)
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-4">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          © 2026 HJ Systems — Gestão Empresarial
        </div>
      </footer>
    </div>
  );
}
