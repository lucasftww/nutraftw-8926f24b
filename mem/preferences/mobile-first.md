---
name: Mobile-first com intenção de compra
description: Público 100% mobile pronto pra comprar — priorizar conversão e atalhos de checkout
type: preference
---
**Regras obrigatórias para todas as decisões de UI/UX:**

- Priorizar **mobile**. Desktop é secundário (não obrigatório, mas não deve quebrar).
- Usuário entra com **intenção de compra** — minimizar cliques até o checkout.
- CTA principal = "Comprar agora" (cor secondary/laranja, ícone Zap), vai direto ao /checkout.
- CTA secundário = "Adicionar ao carrinho" (outline azul).
- Detalhe do produto: **sticky bottom bar** mobile com preço + botão Comprar (sm:hidden, com safe-area-inset-bottom).
- Padding bottom da página de detalhe: pb-28 mobile / pb-10 sm+ pra não cobrir conteúdo com a sticky.
- Botões com altura mínima 44-48px (toque). Pílulas (rounded-full ou rounded-2xl).
- Mostrar sempre: preço grande, "você economiza R$X", "3x sem juros".
- Nunca esconder o CTA atrás de scroll longo no mobile.
