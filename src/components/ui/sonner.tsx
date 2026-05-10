import { Toaster as Sonner } from "sonner";

/**
 * Posição `top-center` no mobile evita conflito com CTAs fixos no rodapé
 * (sticky "Comprar"/"Finalizar"). Em desktop também não atrapalha porque
 * o cabeçalho é fino. `richColors` força bordas/fundos coloridos para
 * sucesso/erro/aviso — ajuda usuários daltônicos e leitura rápida.
 */
export const Toaster = (props: React.ComponentProps<typeof Sonner>) => (
  <Sonner
    className="toaster group"
    position="top-center"
    richColors
    closeButton
    duration={4000}
    toastOptions={{
      classNames: {
        toast:
          "group toast rounded-2xl group-[.toaster]:shadow-elegant group-[.toaster]:border-border",
        description: "group-[.toast]:text-muted-foreground",
        actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
      },
    }}
    {...props}
  />
);
