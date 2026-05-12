import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getLogo, getUnidadesEmpresariais, type UnidadeEmpresarial } from '@/lib/api';

export interface EmpresaHeaderData {
  logo: string | null; // data URL
  unidade: any; // merged with extra fields from getUnidadesEmpresariais
}

export function useEmpresaHeader(): EmpresaHeaderData {
  const { auth } = useAuth();
  const [logo, setLogo] = useState<string | null>(null);
  const [unidadeFull, setUnidadeFull] = useState<any>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const l = await getLogo();
        if (!cancel) setLogo(l);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    let cancel = false;
    const emprId = (auth?.unidade as any)?.empr_id || (auth?.unidade as any)?.empr_Id;
    const unemId = (auth?.unidade as any)?.unem_Id || (auth?.unidade as any)?.unem_id;
    if (!emprId) return;
    (async () => {
      try {
        const list = await getUnidadesEmpresariais(String(emprId));
        if (cancel || !Array.isArray(list)) return;
        const found = list.find((u: any) =>
          String(u.unem_Id || u.unem_id) === String(unemId)
        ) || list[0];
        if (found) setUnidadeFull({ ...(auth?.unidade || {}), ...found });
      } catch {
        /* ignore */
      }
    })();
    return () => { cancel = true; };
  }, [auth?.unidade]);

  return {
    logo,
    unidade: unidadeFull || auth?.unidade || {},
  };
}
