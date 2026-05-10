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

/**
 * Traduz erros do Supabase Auth (gotrue) — vêm sempre em inglês na resposta.
 * Quando não houver match, devolve uma string genérica em pt-BR (não a inglesa)
 * para não vazar mensagem técnica direto pro usuário final.
 */
export function friendlyAuthError(err: any): string {
  if (!err) return "Erro de autenticação.";
  const msg: string = String(err?.message ?? "");
  const status: number = Number(err?.status ?? 0);

  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  if (/user already registered|already exists|user_already_exists/i.test(msg))
    return "Já existe uma conta com este e-mail. Faça login para continuar.";
  if (/password should be at least.*characters/i.test(msg))
    return "A senha deve ter no mínimo 6 caracteres.";
  if (/unable to validate email address|invalid format/i.test(msg)) return "E-mail inválido.";
  if (/email rate limit exceeded|too many requests|over_email_send_rate_limit/i.test(msg) || status === 429)
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (/signup.*disabled|signups not allowed/i.test(msg))
    return "Cadastro temporariamente indisponível. Tente novamente mais tarde.";
  if (/captcha/i.test(msg)) return "Verificação de segurança falhou. Recarregue a página e tente de novo.";
  if (/expired|invalid token|invalid otp/i.test(msg))
    return "Link expirado ou inválido. Solicite um novo e-mail de recuperação.";
  if (/Failed to fetch|NetworkError|network/i.test(msg))
    return "Falha de conexão. Verifique a internet e tente novamente.";

  // Fallback genérico em pt-BR — evita expor mensagem inglesa não mapeada.
  return "Não foi possível autenticar. Tente novamente.";
}