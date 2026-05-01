# Correções visuais no Checkout

Análise feita no preview em mobile (390x844) e desktop (1536x864), com adição de produto real ao carrinho. Encontrei 5 problemas visuais reais.

## Bugs encontrados

### 1. Stepper marca "Pagamento" como concluído antes da hora (CRÍTICO)
Logo ao abrir o checkout, o chip do passo 3 ("Pagamento") já aparece verde com check, mesmo sem o usuário ter preenchido nada. Causa: `paymentDone = !!form.payment_method && método_habilitado`. Como o PIX vem pré-selecionado, sempre dá `true`. Visualmente passa a ideia errada de que dois passos faltam mas o último já está pronto.

### 2. Resumo mostra preço duplicado quando qty = 1 (MÉDIO)
No card "Resumo", o nome do produto vem com:
- linha pequena cinza: `R$ 999,00` (preço unitário)
- linha grande à direita: `R$ 999,00` (subtotal)

Quando qty=1 os dois valores são idênticos e ficam empilhados, dando impressão de promoção (preço "de/por") sem haver desconto. Quando qty=1 só o subtotal precisa aparecer.

### 3. Footer é coberto pela sticky bar no mobile (MÉDIO)
A barra fixa "TOTAL R$ X / Continuar" tem ~76px de altura; o container do form tem `pb-24`, mas o footer está fora desse container e fica parcialmente atrás da sticky.

### 4. Labels do stepper truncadas no mobile (BAIXO)
Em viewport de 390px, "Seus dados" vira "Seus dad..." e "Pagamento" vira "Pagamen...". Texto truncado fica feio. Em mobile devemos mostrar só o número do passo (sem o label) ou só o passo ativo expandido.

### 5. Dois CTAs simultâneos no mobile (BAIXO)
Quando o usuário rola até o resumo no mobile, vê o botão "Pagar com PIX" do resumo E a sticky bar "Continuar" embaixo, lado a lado. São dois CTAs concorrentes para a mesma ação. Ideal: ocultar o botão "Pagar com PIX" do resumo no mobile (deixar só a sticky), ou ocultar a sticky quando o botão real estiver visível.

## Correções propostas

**Arquivo único: `src/pages/Checkout.tsx`**

1. **Stepper** — recalcular `paymentDone` exigindo que `buyerDone`, `addressDone` e `shippingDone` sejam verdadeiros antes de dar o check no passo 3.

2. **Resumo (preço duplicado)** — esconder a linha pequena de preço unitário quando `l.qty === 1`. Manter só quando `qty > 1`, mostrando `R$ X · un` como já faz hoje.

3. **Footer coberto** — aumentar `pb-24` para `pb-32` no container do checkout no mobile, OU adicionar margin-bottom equivalente ao Footer global quando estamos em rota com sticky bar. Vou pelo `pb-32` (96 → 128px) que é simples e localizado.

4. **Stepper truncado** — no mobile mostrar apenas o número do passo dentro do círculo + texto "Etapa X de 3" ou esconder o label nos passos não ativos (`hidden sm:inline` no `<span>` do label, e mostrar inline só no passo atual).

5. **Dois CTAs no mobile** — ocultar a sticky bar quando o botão "Pagar com PIX" do resumo estiver dentro do viewport (via IntersectionObserver), OU mais simples: deixar a sticky sempre visível e mudar o botão do resumo no mobile pra um secundário (variante outline) para não competir. Vou pelo IntersectionObserver — comportamento padrão de e-commerce.

## Não vou alterar
- Layout geral do grid (form + aside).
- Ordem das seções.
- Cores/tema (já está alinhado com a identidade azul/verde).

## Resultado esperado
- Stepper só fica verde quando o passo realmente está OK.
- Resumo mais limpo (sem ilusão de desconto).
- Footer visível em mobile (sem ser coberto).
- Stepper legível em telas pequenas.
- Um único CTA primário visível por vez no mobile.
