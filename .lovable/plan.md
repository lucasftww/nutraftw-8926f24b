## Análise profunda — bugs encontrados

Após varrer rotas, hooks, RPCs (`create_order`, `handle_new_user`, `protect_referred_by_code`), realtime, RequireAuth e fluxo de afiliados, encontrei **6 problemas reais** que devem ser corrigidos.

---

### 🐛 Bug #1 — Atribuição de afiliado em **last-click** no front, mas **first-touch** no banco (inconsistência grave)

- `src/lib/affiliateRef.ts` e `useCaptureAffiliateRef.ts`: comentários dizem "last-click wins" e o código sobrescreve o localStorage a cada `?ref=`.
- `protect_referred_by_code` no Postgres: **first-touch wins** (preserva o `OLD.referred_by_code`).
- `Login.tsx` no signup: usa o último ref do localStorage para gravar `referred_by_code` e inserir em `affiliate_referrals`.

**Resultado**: o afiliado que aparece em `affiliate_referrals` pode ser diferente do que fica em `profiles.referred_by_code` (o trigger só protege em UPDATE; no signup ainda é o "último click"). Comissões podem ser pagas para o afiliado errado em casos de visitas múltiplas.

**Fix**: padronizar em **first-touch** no front: `setAffiliateRef` só grava se ainda não houver código não-expirado salvo. Atualizar comentários.

---

### 🐛 Bug #2 — Checkout guest **NUNCA** registra atribuição de afiliado

`Checkout.tsx` (linhas 524-578): cria conta via `supabase.auth.signUp` para guests, mas **não** lê `getAffiliateRefData()` nem grava `referred_by_code` / insere em `affiliate_referrals`. Só o `Login.tsx` faz isso. Resultado: todo cliente que compra como guest pelo link de afiliado **não gera comissão**.

**Fix**: replicar no `Checkout.tsx` o mesmo bloco de atribuição usado no `Login.tsx` (resolver `affiliate_code` → escrever `referred_by_code` + insert em `affiliate_referrals` com status `inactive`, respeitando first-touch).

---

### 🐛 Bug #3 — `create_order` não decrementa estoque quando `stock IS NULL`

No final do RPC (linhas 125-128): `update products set stock = greatest(0, pr.stock - qty)`. Se `stock IS NULL`, `pr.stock - qty` retorna NULL e `greatest(0, NULL) = NULL` — fica "estoque infinito" silenciosamente. Pior: a verificação `if v_product.stock is not null and v_product.stock < v_qty` permite a venda mesmo com NULL, mas depois nem decrementa. Inconsistência.

**Fix**: na cláusula UPDATE, ignorar produtos com `stock IS NULL` (ou tratar NULL como "não controla estoque" explicitamente). Migration:

```sql
update public.products pr
   set stock = greatest(0, pr.stock - (it->>'qty')::int)
  from jsonb_array_elements(p_items) as it
 where pr.id = (it->>'product_id')::uuid
   and pr.stock is not null;
```

---

### 🐛 Bug #4 — `create_order` aceita `payment_method = 'boleto'` mas tabela `orders` não tem esse enum garantido + checkout não oferece

O RPC permite `boleto` no `if p_payment_method not in ('pix','credit_card','boleto')`, mas o cast `p_payment_method::payment_method` falhará se `boleto` não estiver no enum. Front só envia `pix`/`credit_card`. Manter `boleto` permitido cria erro confuso (`invalid input value for enum`) caso alguém chame o RPC direto.

**Fix**: remover `'boleto'` do whitelist no RPC para alinhar com o enum/UI atuais (até que boleto seja realmente implementado).

---

### 🐛 Bug #5 — `RequireAuth` redireciona admin legítimo durante `roleLoading`

`RequireAuth.tsx` (linha 32): se `adminOnly && !isAdmin` → redirect imediato para `/admin/login`. Mas no primeiro render após login, `role` ainda é `null` enquanto `roleLoading=true`. Resultado: admin que clica em `/admin` direto após login é jogado de volta para `/admin/login` por 1-2 frames; em conexões lentas pode redirecionar de fato e nunca entrar.

`useAuth` já expõe `roleLoading`. Basta mostrar o skeleton enquanto carrega.

**Fix**:
```tsx
const { user, loading, isAdmin, roleLoading } = useAuth();
...
if (adminOnly) {
  if (roleLoading) return <>{loadingNode}</>;
  if (!isAdmin) return <Navigate to={`/admin/login?next=${next}`} replace />;
}
```

---

### 🐛 Bug #6 — `useNewOrdersNotifier` notifica admin de **TODOS** os pedidos antigos ao primeiro carregamento se `lastSeen` estiver vazio

Na linha 51: `if (lastSeen && o.created_at && o.created_at <= lastSeen) return;` — se `lastSeen` é null (primeira sessão do navegador), o filtro é ignorado e qualquer INSERT realtime recebido entre a inscrição e a navegação dispara toast (ok), mas se o canal entregar eventos antigos durante reconexão também dispara. Mais importante: ao montar pela primeira vez, **`lastSeen` deveria ser inicializado com `now()`** para não criar a possibilidade de re-toast em reconnects.

**Fix menor**: na montagem, se `!lastSeen`, gravar `new Date().toISOString()` como baseline; e considerar `o.created_at` apenas estritamente maior.

---

## Arquivos a editar

- `src/lib/affiliateRef.ts` — política first-touch + comentários
- `src/hooks/useCaptureAffiliateRef.ts` — comentário
- `src/pages/Checkout.tsx` — bloco de atribuição de afiliado para guests
- `src/components/auth/RequireAuth.tsx` — esperar `roleLoading`
- `src/hooks/useNewOrdersNotifier.ts` — baseline de `lastSeen` + comparação estrita
- **Migration** — atualizar RPC `create_order`: filtrar `stock IS NULL` no decremento e remover `boleto` do whitelist

## Itens verificados e ok

- RLS de `products`, `orders`, `order_items`, `cart_items`, `wishlists`, `profiles`, `user_roles` — todas corretas
- `has_role` SECURITY DEFINER ✓
- View `affiliate_referrals_masked` em uso ✓
- `useAuth` com cache de role + revalidação assíncrona ✓
- Sem `service_role` no front ✓
- `.maybeSingle()` em todas as queries ✓
- Realtime de `orders` habilitado ✓
- Senha aleatória cripto-forte para guest ✓

Posso aplicar?
