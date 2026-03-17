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
      const user = localStorage.getItem("hj_user");
      const unidade = localStorage.getItem("hj_unidade");
      if (user && unidade) return { user: JSON.parse(user), unidade: JSON.parse(unidade) };
    } catch {}
    return null;
  });

  const login = (user: Usuario, unidade: UnidadeEmpresarial) => {
    localStorage.setItem("hj_user", JSON.stringify(user));
    localStorage.setItem("hj_unidade", JSON.stringify(unidade));
    localStorage.setItem("hj_logged", "true");
    setAuth({ user, unidade });
  };

  const logout = () => {
    localStorage.removeItem("hj_user");
    localStorage.removeItem("hj_unidade");
    localStorage.removeItem("hj_logged");
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
