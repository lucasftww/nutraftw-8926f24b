import { AlertCircle } from "lucide-react";
import type { FieldStatus } from "./types";

/** Mensagem inline de validação — verde "ok" / vermelho "erro" / nada quando idle.
 *  `id` permite vincular ao input via aria-describedby (acessibilidade). */
export function FieldHint({ status, message, id }: { status: FieldStatus; message?: string; id?: string }) {
  // Visual clean: ocultamos o "Tudo certo" — só mostramos mensagens de erro.
  if (status !== "invalid") return null;
  return (
    <p id={id} role="alert" className="field-hint field-hint-error">
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
