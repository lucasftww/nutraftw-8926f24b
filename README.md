# Royal Vitta Store

Frontend da loja/admin construído com React + Vite e backend em Supabase.

## Requisitos

- Node.js 20+
- npm 10+

## Configuração

1. Copie `.env.example` para `.env.local`
2. Preencha:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Instale dependências:

```bash
npm install
```

## Scripts

- `npm run dev` inicia ambiente local
- `npm run build` gera build de produção
- `npm run preview` sobe preview do build
- `npm run lint` roda lint
- `npm run test` roda testes unitários

## Fluxos críticos para validar após mudanças

- Login/logout e redirecionamento pós-login
- Wishlist com usuário deslogado/logado
- Checkout completo (cupom, frete, pagamento)
- Painel admin (troca de abas e pedidos)
