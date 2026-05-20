-- Migration: check_rate_limit_grants
--
-- Tightening: a função check_rate_limit é chamada APENAS internamente
-- por create_order (PERFORM). Não deve ser callable por anon via REST.
--
-- Sem este REVOKE explicito, o GRANT default do schema `public` deixava
-- a função aparecer em /rest/v1/rpc/check_rate_limit para qualquer
-- visitante anônimo — sem causar dano direto (a função RAISE se
-- auth.uid() é null), mas inflando a superfície de ataque + permitindo
-- bots medirem latência da resposta.

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO authenticated;
