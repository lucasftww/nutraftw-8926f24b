# Migrations pendentes

> **Status atual: TODAS as migrations aplicadas via Management API ✅**

Este arquivo é mantido como histórico e procedimento de operação para
quando uma nova migration entrar na pasta `supabase/migrations/` e
precisar ser aplicada no banco remoto.

## Procedimento para aplicar uma migration nova

**Opção A — Dashboard Supabase (manual, 30s):**

1. Abra https://supabase.com/dashboard/project/idutmqfqnoozqbjeqtui/sql/new
2. Cole o SQL da migration
3. Clique em **Run** (Ctrl+Enter)

**Opção B — CLI:**

```bash
supabase db push
```

**Opção C — Management API via token (usado nesta thread quando o CLI
estava com segfault no Windows):**

```bash
cd <projeto>
export SUPABASE_TOKEN="sbp_..."
export PROJECT_REF="idutmqfqnoozqbjeqtui"
node --input-type=module -e '
  const fs = await import("node:fs");
  const sql = fs.readFileSync(process.argv[2], "utf8");
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${process.env.PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.SUPABASE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  console.log("status:", r.status, "body:", await r.text());
' -- supabase/migrations/SUA_MIGRATION.sql
```

---

## Histórico de migrations aplicadas nesta thread

- ✅ `20260510175517_security_fk_fixes.sql` — FK constraints em order_refunds e wishlists
- ✅ `20260510180000_security_hardening.sql` — rate-limit por sessão em product_events + audit trigger
- ✅ `20260511120000_rls_perf_and_security.sql` — RLS initplan fix (auth.uid() em SELECT)
- ✅ `20260520120000_product_view_count_rpc.sql` — RPC `product_view_count_24h` para badge social proof
- ✅ `20260521120000_rate_limit_create_order.sql` — Tabela `rate_limit_events` + função `check_rate_limit`
- ✅ `20260521121500_check_rate_limit_grants.sql` — REVOKE anon de check_rate_limit (tightening)
- ✅ **Inline edit**: plug `PERFORM public.check_rate_limit('create_order', 5, 60)` em ambas
  overloads de `create_order` (17 args + 20 args)

## Validação atual no remote

| Recurso | Status |
|---|---|
| `product_view_count_24h(uuid)` | ✅ Existe, GRANT anon+authenticated |
| `check_rate_limit(text, int, int)` | ✅ Existe, GRANT authenticated only (anon revogado) |
| `rate_limit_events` table | ✅ Existe, RLS habilitada, policy "User sees own rate-limit events" |
| `create_order(...,17 args)` overload | ✅ Plug do check_rate_limit confirmado |
| `create_order(...,20 args)` overload | ✅ Plug do check_rate_limit confirmado |
