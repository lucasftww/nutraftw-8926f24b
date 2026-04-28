import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CurrentProduct = {
  name: string;
  slug: string;
  price?: number;
};

type Ctx = {
  current: CurrentProduct | null;
  setCurrent: (p: CurrentProduct | null) => void;
};

const CurrentProductContext = createContext<Ctx | undefined>(undefined);

export function CurrentProductProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<CurrentProduct | null>(null);
  return (
    <CurrentProductContext.Provider value={{ current, setCurrent }}>
      {children}
    </CurrentProductContext.Provider>
  );
}

export function useCurrentProduct() {
  const ctx = useContext(CurrentProductContext);
  if (!ctx) return { current: null, setCurrent: () => {} } as Ctx;
  return ctx;
}

/**
 * Hook utilitário: registra o produto atual enquanto o componente estiver montado
 * e limpa automaticamente ao desmontar (ex.: sair da página de detalhe).
 */
export function useRegisterCurrentProduct(p: CurrentProduct | null) {
  const { setCurrent } = useCurrentProduct();
  useEffect(() => {
    setCurrent(p);
    return () => setCurrent(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.slug, p?.name, p?.price]);
}