import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Usuario, UnidadeEmpresarial } from "@/lib/api";

interface AuthState {
  user: Usuario;
  unidade: UnidadeEmpresarial;
}

interface AuthContextType {
  auth: AuthState | null;
  login: (user: Usuario, unidade: UnidadeEmpresarial) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(() => {
    try {
      // Sessão por aba: usa sessionStorage para permitir empresas/usuários diferentes em cada aba
      const user = sessionStorage.getItem("hj_user");
      const unidade = sessionStorage.getItem("hj_unidade");
      if (user && unidade) return { user: JSON.parse(user), unidade: JSON.parse(unidade) };
    } catch {}
    return null;
  });

  const login = (user: Usuario, unidade: UnidadeEmpresarial) => {
    sessionStorage.setItem("hj_user", JSON.stringify(user));
    sessionStorage.setItem("hj_unidade", JSON.stringify(unidade));
    sessionStorage.setItem("hj_logged", "true");
    // Limpa qualquer resquício de localStorage (versões antigas)
    try {
      localStorage.removeItem("hj_user");
      localStorage.removeItem("hj_unidade");
      localStorage.removeItem("hj_logged");
    } catch {}
    setAuth({ user, unidade });
  };

  const logout = () => {
    sessionStorage.removeItem("hj_user");
    sessionStorage.removeItem("hj_unidade");
    sessionStorage.removeItem("hj_logged");
    setAuth(null);
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout, isAuthenticated: !!auth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
