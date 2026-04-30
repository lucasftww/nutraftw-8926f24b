import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import { AdminModal } from "./AdminModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

type Variant = "default" | "destructive";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  /** Quando definido, mostra um campo de texto e devolve o valor preenchido em vez de boolean. */
  prompt?: { label: string; placeholder?: string; required?: boolean };
}

type Resolver = (value: boolean | string | null) => void;

const ConfirmCtx = createContext<{
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  promptText: (opts: ConfirmOptions & { prompt: NonNullable<ConfirmOptions["prompt"]> }) => Promise<string | null>;
} | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [text, setText] = useState("");
  const resolverRef = useRef<Resolver | null>(null);

  const close = useCallback((value: boolean | string | null) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpts(null);
    setText("");
  }, []);

  const confirm = useCallback((o: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = (v) => resolve(v === true);
      setText("");
      setOpts(o);
    });
  }, []);

  const promptText = useCallback((o: ConfirmOptions & { prompt: NonNullable<ConfirmOptions["prompt"]> }) => {
    return new Promise<string | null>((resolve) => {
      resolverRef.current = (v) => resolve(typeof v === "string" ? v : null);
      setText("");
      setOpts(o);
    });
  }, []);

  const isPrompt = !!opts?.prompt;
  const variant = opts?.variant ?? "default";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!opts) return;
    if (isPrompt) {
      if (opts.prompt?.required && !text.trim()) return;
      close(text.trim());
    } else {
      close(true);
    }
  }

  return (
    <ConfirmCtx.Provider value={{ confirm, promptText }}>
      {children}
      <AdminModal
        open={!!opts}
        onClose={() => close(isPrompt ? null : false)}
        title={opts?.title || "Confirmar"}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            {variant === "destructive" && (
              <span className="shrink-0 h-10 w-10 rounded-full bg-destructive/10 text-destructive inline-flex items-center justify-center">
                <AlertTriangle className="h-5 w-5" />
              </span>
            )}
            <div className="flex-1 min-w-0">
              {opts?.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{opts.description}</p>
              )}
              {isPrompt && opts?.prompt && (
                <div className="mt-3 space-y-2">
                  <Label>{opts.prompt.label}</Label>
                  <Input
                    autoFocus
                    value={text}
                    placeholder={opts.prompt.placeholder}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => close(isPrompt ? null : false)}>
              {opts?.cancelLabel || "Cancelar"}
            </Button>
            <Button
              type="submit"
              className={variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {opts?.confirmLabel || (variant === "destructive" ? "Remover" : "Confirmar")}
            </Button>
          </div>
        </form>
      </AdminModal>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm() precisa de <ConfirmProvider> acima na árvore.");
  return ctx;
}