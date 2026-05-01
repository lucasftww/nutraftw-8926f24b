## Plano: Fases 2, 3 e 4 do Checkout

Hoje `src/pages/Checkout.tsx` tem 1.682 linhas, mistura form, frete, cupom, signup de convidado, atribuição de afiliado e UI. Vamos quebrar em pedaços, mover lógica sensível pro servidor e polir UX.

---

### Fase 2 — Refatoração (sem mudança visual)

**Novos hooks (`src/hooks/checkout/`)**
- `useCheckoutForm.ts` — estado do formulário (contato + endereço + notas), validação com `zod`, persistência em `sessionStorage` (chave `checkout:form:v1` já existente).
- `useShippingRates.ts` — fetch por UF, cache em memória por estado, retry 400ms (já existe), seleção atual + reset quando UF muda.
- `useCouponValidation.ts` — debounce 350ms, sanitização (já feita), chama `validate_coupon`, expõe `{ status, discount, message }`.
- `useGuestSignup.ts` — encapsula criação de conta para convidado com senha aleatória + sign-in subsequente.
- `useViaCep.ts` — lookup de CEP com warning toast (já feito) e cancelamento se CEP mudar durante request.

**Novos componentes (`src/components/checkout/`)**
- `BuyerSection.tsx` — nome, email, CPF, telefone.
- `AddressSection.tsx` — CEP, rua, número, complemento, bairro, cidade, UF.
- `ShippingSection.tsx` — lista de `shipping_rates` da UF selecionada com radiogroup acessível.
- `PaymentSection.tsx` — PIX/Cartão com `role="radiogroup"` e navegação por setas.
- `CouponBox.tsx` — input + botão aplicar/remover, feedback inline.
- `OrderSummary.tsx` — itens, subtotal, frete, seguro, desconto, PIX 5%, total. Memoizado.
- `Stepper.tsx` — indicador 1→2→3 com `aria-current`.
- `MobileFooterCTA.tsx` — barra fixa mobile com "Continuar" / "Pagar".

**`Checkout.tsx`** vira orquestrador: ~250 linhas, monta hooks e renderiza seções. Sem mudança de layout/estilo.

**Performance**: cada seção memoiza com `React.memo`; digitar em "nome" não re-renderiza `OrderSummary` nem `ShippingSection`.

---

### Fase 3 — Atomicidade no servidor (migração SQL)

Hoje, antes de chamar `create_order`, o cliente faz:
1. `profiles.upsert` (dados de cobrança/endereço)
2. `affiliate_referrals.insert` (atribuição first-touch)

Se o RPC falhar, ficam dados órfãos. Vamos mover ambos pra dentro do `create_order`:

**Nova migração** altera `public.create_order(...)` adicionando parâmetros opcionais:
- `p_save_profile boolean default true` — se `true`, faz `UPDATE public.profiles SET full_name, cpf, phone, address_* WHERE user_id = v_user`.
- `p_affiliate_code text default null` — se informado e o profile ainda não tem `referred_by_code`, grava (respeitando trigger `protect_referred_by_code` que já garante first-touch).
- `p_utm jsonb default null` — opcional: cria/atualiza `affiliate_referrals` para o `referred_user_id = v_user`.

Tudo em uma única transação. Erros retornam `RAISE EXCEPTION` com mensagens já padronizadas em PT-BR. Sem `SQLSTATE` customizado (manter consistência com o resto do projeto).

Frontend: remover os dois `await` que fazem upsert/insert antes do RPC; passar os campos como parâmetros.

---

### Fase 4 — UX avançada

1. **Combobox de UF** — substitui `<select>` por `Command` do shadcn (busca por nome ou sigla, ex.: "São Paulo" → SP). Componente `UFCombobox.tsx`.
2. **Pré-carregamento de fretes** — ao montar o checkout, dispara fetch dos UFs mais comuns (SP, RJ, MG, RS, PR) em background; quando usuário seleciona UF, exibe instantâneo se já cacheado.
3. **Email OTP para convidado** (opcional, atrás de feature flag em `site_settings.checkout_guest_otp = 'true'`):
   - Após preencher email, botão "Enviar código" → `supabase.auth.signInWithOtp({ email })`.
   - Campo de 6 dígitos para validar antes de prosseguir ao pagamento.
   - Se flag desligada, mantém fluxo atual (senha aleatória).
4. **Máscara em tempo real** para CPF (`000.000.000-00`), telefone (`(00) 00000-0000`) e CEP (`00000-000`) usando funções puras (sem libs externas).
5. **Botão "Aplicar" do cupom desabilitado** enquanto vazio + spinner enquanto valida.
6. **Resumo sticky no desktop** (`lg:sticky lg:top-24`) — já existe parcialmente; revisar.

---

### Detalhes técnicos

**Estrutura de arquivos resultante**
```text
src/
  hooks/checkout/
    useCheckoutForm.ts
    useShippingRates.ts
    useCouponValidation.ts
    useGuestSignup.ts
    useViaCep.ts
  components/checkout/
    BuyerSection.tsx
    AddressSection.tsx
    ShippingSection.tsx
    PaymentSection.tsx
    CouponBox.tsx
    OrderSummary.tsx
    Stepper.tsx
    MobileFooterCTA.tsx
    UFCombobox.tsx
  pages/Checkout.tsx  (orquestrador, ~250 linhas)
supabase/migrations/<timestamp>_create_order_atomic.sql
```

**Migração SQL** — `CREATE OR REPLACE FUNCTION public.create_order(...)` com a assinatura nova. Como adicionamos parâmetros com `DEFAULT`, chamadas antigas continuam funcionando enquanto migramos o frontend.

**Validação Zod** centralizada em `src/lib/checkout/schema.ts` (CPF, CEP, telefone, email, UF de 2 letras).

**Riscos e mitigação**
- Refator grande → fazer em commits semânticos por seção; testar fluxo completo (guest + logged + cupom + PIX + cartão) antes de finalizar.
- Mudança de assinatura RPC → manter compatibilidade via `DEFAULT` nos novos params.
- OTP com flag desligada por padrão → zero impacto se não habilitado.

**Checklist final de QA manual**
- [ ] Convidado completa pedido sem perder foco ao digitar
- [ ] Refresh no meio mantém dados (sessionStorage)
- [ ] CEP inválido mostra warning, não trava
- [ ] Mudar UF reseta opção de frete e recarrega taxas
- [ ] Cupom percentual e fixo batem com cálculo do servidor
- [ ] PIX aplica 5% sobre total já com desconto
- [ ] Pedido criado com afiliado correto (first-touch preservado)
- [ ] Mobile (390px): stepper, CTA fixo, seções legíveis
