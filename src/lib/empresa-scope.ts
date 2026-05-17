// Helper para obter empresa_id (= empr_id) e unem_id do usuário logado
import { useAuth } from "@/contexts/AuthContext";

export function useEmpresaScope() {
  const { auth } = useAuth();
  const empresa_id = auth?.unidade?.empr_id ?? "";
  const unem_id = (auth?.unidade as any)?.unem_id ?? (auth?.unidade as any)?.Unem_Id ?? "";
  const usrs_id = (auth?.user as any)?.usrs_id ?? (auth?.user as any)?.USRS_ID ?? "";
  return { empresa_id, unem_id, usrs_id, isReady: !!empresa_id };
}
