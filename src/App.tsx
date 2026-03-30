import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Estoque from "@/pages/Estoque";
import Produtos from "@/pages/Produtos";
import ConsultaEstoque from "@/pages/ConsultaEstoque";
import Pedidos from "@/pages/Pedidos";
import OrdemServico from "@/pages/OrdemServico";
import SalesDemo from "@/pages/SalesDemo";
import MovementSummary from "@/pages/MovementSummary";
import Configuracoes from "@/pages/Configuracoes";
import Marketing from "@/pages/Marketing";
import ConsultaPix from "@/pages/ConsultaPix";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/estoque" element={<Navigate to="/estoque/filiais" replace />} />
                <Route path="/estoque/produtos" element={<Produtos />} />
                <Route path="/estoque/filiais" element={<Estoque />} />
                <Route path="/estoque/consulta" element={<ConsultaEstoque />} />
                <Route path="/pedidos" element={<Pedidos />} />
                <Route path="/ordem-servico" element={<OrdemServico />} />
                <Route path="/relatorios/vendas" element={<SalesDemo />} />
                <Route path="/relatorios/movimentacao" element={<MovementSummary />} />
                <Route path="/marketing/campanhas" element={<Marketing />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
