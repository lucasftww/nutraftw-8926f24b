---
name: Admin Access
description: Login dedicado em /admin/login que valida role admin antes de liberar acesso ao painel
type: feature
---
- Rota `/admin/login` (página `src/pages/AdminLogin.tsx`) é o único caminho de entrada do painel.
- `RequireAuth adminOnly` redireciona para `/admin/login?next=...` tanto quando não há usuário quanto quando há usuário sem role admin (não usa mais `/login` do cliente nem joga para `/`).
- Validação dupla: signIn → SELECT em `user_roles` filtrado por `user_id`. Se não tiver `admin`, faz `signOut` imediato e mostra erro claro com botão "Sair desta conta".
- Sanitiza `?next=` aceitando apenas paths que começam com `/admin`.
- Usa o `AuthProvider` (Context único) — confia em `loading || roleLoading` antes de redirecionar para evitar flash de "negado".
