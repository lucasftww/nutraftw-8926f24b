# Migrations pendentes (aplicar manualmente)

Lista de migrations que precisam ser aplicadas ao banco remoto da Supabase
mas **não puderam ser aplicadas via CLI** no ambiente de desenvolvimento
atual (Supabase CLI com segfault em algumas builds Windows / faltando
senha do postgres).

O frontend já está preparado para todas essas migrations — funciona com
graceful degradation enquanto a RPC não existir.

## Como aplicar

**Opção A — Dashboard Supabase (mais rápido, 30s):**

1. Abra https://supabase.com/dashboard/project/idutmqfqnoozqbjeqtui/sql/new
2. Cole o SQL da migration que está pendente (veja abaixo)
3. Clique em **Run** (Ctrl+Enter)
4. Marque o item como aplicado nesta lista

**Opção B — CLI (se você tem `supabase` instalado e configurado):**

```bash
cd <projeto>
supabase db push
```

---

## Pendentes

### ⏳ `20260520120000_product_view_count_rpc.sql`

**O que faz:** Cria a função SECURITY DEFINER `product_view_count_24h`
que retorna a contagem de DISTINCT session_id que viram um produto nas
últimas 24h. Usada pelo badge "X pessoas viram nas últimas 24h" no
ProductDetail (`SocialProofViewCount.tsx`).

**Sem aplicar:** o componente falha silenciosamente — nada quebra, apenas
o badge não aparece.

**SQL para colar:**

```sql
CREATE OR REPLACE FUNCTION public.product_view_count_24h(p_product_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(DISTINCT session_id)::int, 0)
  FROM public.product_events
  WHERE product_id = p_product_id
    AND event_type = 'view'
    AND session_id IS NOT NULL
    AND created_at >= NOW() - INTERVAL '24 hours';
$$;

GRANT EXECUTE ON FUNCTION public.product_view_count_24h(uuid) TO anon, authenticated;
```

**Como validar que aplicou:**

```sql
SELECT proname, pronamespace::regnamespace
FROM pg_proc
WHERE proname = 'product_view_count_24h';
-- Deve retornar 1 linha
```

---

## Histórico de aplicadas nesta thread

- ✅ `20260510175517_security_fk_fixes.sql` (FK constraints)
- ✅ `20260510180000_security_hardening.sql` (rate-limit + audit trigger)
- ✅ `20260511120000_rls_perf_and_security.sql` (RLS initplan fix)
- ⏳ `20260520120000_product_view_count_rpc.sql` ← **pendente**
