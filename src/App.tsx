import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Estoque from "@/pages/Estoque";
import Pedidos from "@/pages/Pedidos";
import OrdemServico from "@/pages/OrdemServico";
import SalesDemo from "@/pages/SalesDemo";
import MovementSummary from "@/pages/MovementSummary";
import Configuracoes from "@/pages/Configuracoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/ordem-servico" element={<OrdemServico />} />
            <Route path="/relatorios/vendas" element={<SalesDemo />} />
            <Route path="/relatorios/movimentacao" element={<MovementSummary />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
