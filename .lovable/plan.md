## Análise do Checkout — pontos de melhoria

`src/pages/Checkout.tsx` tem **1.552 linhas** e concentra 100% da lógica (form, frete, cupom, pagamento, render, sticky bar, prefill, ViaCEP, criação de conta para guest, atribuição de afiliado, RPC). Funciona, mas está difícil de manter, tem alguns smells de UX e oportunidades reais de robustez. Os bugs críticos já foram corrigidos nos últimos turnos — esta é a **próxima camada**.

---

### 1. Quebrar o arquivo em peças coesas

Sem mudar nada visual, dividir em:

```text
src/pages/Checkout.tsx           (orquestrador, ~300 linhas)
src/checkout/
  ├── useCheckoutForm.ts         (state + validação + máscaras)
  ├── useShippingRates.ts        (fetch por UF + cache)
  ├── useCouponValidation.ts     (apply/revalidate/recheck)
  ├── useGuestSignup.ts          (auto-signUp + login + atribuição afiliado)
  ├── checkoutTotals.ts          (cálculo puro: subtotal/frete/seguro/cupom/pix)
  ├── BuyerSection.tsx
  ├── AddressSection.tsx
  ├── ShippingSection.tsx
  ├── PaymentSection.tsx
  ├── OrderSummary.tsx
  └── MobileStickyCta.tsx
```

Benefício real: hoje qualquer keystroke num campo re-renderiza tudo; com componentes separados + memo, custo cai. Também fica testável.

### 2. Confiabilidade e UX

- **Persistir o form em `sessionStorage`**: hoje, se o usuário recarrega a página por engano, perde tudo. Salvar `form` (sem senha/dados sensíveis em plaintext seria só endereço/contato) e restaurar no mount.
- **`autoComplete` faltando** em vários campos (`street`, `number`, `district`, `city`, `state`). Isso bloqueia o autofill nativo do browser/Google Pay → atrito alto no mobile.
- **CEP inválido** no ViaCEP hoje cai silencioso (`if (d.erro) return`). Mostrar toast leve "CEP não encontrado, preencha manualmente".
- **Sem retry no fetch de `shipping_rates`**: se a primeira chamada falha (offline momentâneo), a seção fica vazia até o usuário trocar UF e voltar. Adicionar 1 retry com backoff curto.
- **Botão "Continuar" da sticky bar** scrolla até a primeira seção incompleta — bom — mas não destaca visualmente o erro (ex.: shake leve ou ring vermelho no campo). Adicionar feedback.
- **Cupom**: o input não tem máscara/uppercase real no estado, só no display. Submeter "abc" e exibir "ABC" pode confundir colagem. Normalizar no `onChange`.
- **Loading do submit é só um spinner no botão**: bloquear visualmente o card de pagamento (overlay leve) para evitar cliques em "trocar PIX/Cartão" durante o RPC, o que muda preço a meio da transação.
- **Erro do RPC**: hoje strings são casadas com regex (`/cupom inválido/i`). Frágil se a mensagem mudar. Padronizar com SQLSTATE custom no servidor (ex.: `P0001` + hint estruturado) e ler `err.code/err.hint` no cliente.

### 3. Performance

- **`crypto.getRandomValues` + 24 bytes só para senha de guest**: ok, mas roda em todo submit guest. Mover para função utilitária pura.
- **`summaryItems` memoizado por `[groupedLines]`** — bom. Mas `groupedLines` recria array a cada render porque `lines` é referência nova vinda do hook a cada update do contexto. Conferir se `useCart` retorna `lines` estável (provavelmente não); senão, memoizar com hash de `id+qty`.
- **ViaCEP debounce 350ms** + **shipping fetch sem debounce**: usuário que troca de UF rápido dispara N requests cancelados. Adicionar pequeno debounce (~150ms) na UF.
- **Preload do `shipping_rates` mais comuns** (SP, RJ, MG) no mount em background → primeira interação parece instantânea.

### 4. Acessibilidade

- **Stepper sem `aria-current="step"`** no passo ativo.
- **Erros do form aparecem via toast**, mas não há `aria-describedby` ligando o input à mensagem `FieldHint`. Leitor de tela não anuncia o erro ao focar o campo.
- **`<select>` de UF** funciona, mas para lista de 27 estados, um combobox com busca (digite "sa" → SP, SC) é mais rápido. Manter `<select>` como fallback.
- **Botões de pagamento** usam `role="radio"` mas não estão dentro de um `role="radiogroup"` com gerenciamento de teclado (setas ↑↓ entre opções).
- **Botão "Continuar" da sticky bar** não anuncia para qual campo vai pular. Adicionar `aria-label` dinâmico ("Continuar — preencher dados de entrega").

### 5. Segurança e dados

- **Email de guest é gravado em `auth.users` sem confirmação**: se alguém digita um e-mail alheio, cria-se uma conta zumbi vinculada a esse e-mail. O signUp dispara e-mail de confirmação (bom), mas se o owner do e-mail não confirma, ele recebe um pedido feito por outra pessoa. Mitigação: enviar OTP por e-mail antes de criar o pedido para guests, ou pelo menos exigir confirmação de telefone (CPF não basta).
- **`profiles.upsert` server-side via cliente**: hoje o cliente faz upsert direto em `profiles` (linha ~700). RLS permite, mas significa que qualquer dado do form vai para `profiles` mesmo se o RPC falhar depois — endereço fantasma. Mover o upsert para dentro do RPC `create_order` (transacional).
- **Atribuição de afiliado para guest** roda 4 chamadas seriais (select profile, select existing, update, insert). Pode virar 1 RPC `attach_affiliate_for_user` server-side.

### 6. Pequenos polimentos visuais

- O botão "+ Adicionar complemento" some depois de aberto, sem opção de fechar/cancelar.
- Quando `shippingOptions.length === 0` para uma UF, a CTA de WhatsApp (mencionada na mensagem) não é um link clicável — só texto.
- Total no cartão mostra "12x de R$ X" mesmo se o método selecionado é PIX, no card do cartão. Ok intencional (comparativo), mas o "12x" some quando o cartão fica selecionado e a parcela vai para o total grande — a parcela some/aparece em dois lugares. Centralizar a regra.

---

### Sugestão de execução em fases

| Fase | Conteúdo | Risco |
|---|---|---|
| **1** | Acessibilidade (aria-current, aria-describedby, autoComplete) + máscara real do cupom + persistência em sessionStorage | baixo |
| **2** | Quebrar em componentes/hooks (sem mudar visual nem comportamento) | médio |
| **3** | Mover `profiles.upsert` e atribuição de afiliado para dentro do RPC; padronizar erros do RPC com SQLSTATE | médio |
| **4** | OTP de e-mail para guest + combobox de UF + preload de shipping_rates | maior, opcional |

Posso começar pela **Fase 1** (ganho imediato, baixo risco, sem mudança visual) — me diga "ok fase 1" ou escolha outra.