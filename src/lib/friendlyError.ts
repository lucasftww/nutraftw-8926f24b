/**
 * Traduz erros do Supabase/PostgREST em mensagens amigáveis em pt-BR
 * sem perder o detalhe técnico (este continua no console via logSupabaseError).
 */
export function friendlyErrorMessage(err: any): string {
  if (!err) return "Erro desconhecido.";
  const code: string = String(err?.code ?? "");
  const msg: string = String(err?.message ?? "");

  if (code === "PGRST301" || /jwt/i.test(msg)) return "Sessão expirou. Entre novamente.";
  if (code === "23505" || /duplicate key/i.test(msg)) return "Registro duplicado (valor já existe).";
  if (code === "23503") return "Operação bloqueada por dados relacionados.";
  if (code === "23502") return "Campo obrigatório não preenchido.";
  if (code === "23514") return "Valor não atende às regras do sistema.";
  if (code === "42501" || /permission denied|forbidden/i.test(msg))
    return "Você não tem permissão para esta ação.";
  if (/Failed to fetch|NetworkError|network/i.test(msg))
    return "Falha de conexão. Verifique a internet e tente novamente.";
  if (/timeout/i.test(msg)) return "A operação demorou demais. Tente novamente.";

  // Fallback: devolve mensagem original (já em pt no caso de RPCs internas).
  return msg || "Não foi possível concluir a operação.";
}