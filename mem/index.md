# Project Memory

## Core
Marca: Royal Vitta (antes GIMPORTS). Logo SVG em src/assets/logo-royalvita.svg, monograma RV navy + swoosh cyan.
Clone inspirado em KA Imports. Catálogo farmacêutico. Use dados oficiais reais (39 produtos), sem placeholders.
Visual: azul royal (#0B1F6B / --primary), accent cyan (--brand-cyan), CTA laranja (--secondary) e PIX/sucesso verde — manter para conversão.
Sistemas separados: /admin (com login próprio) e área de cliente em /login.
**Mobile-first**: 100% do público vem do celular com intenção de compra. Priorize mobile e atalhos de checkout sempre.

## Memories
- [Catalog UI](mem://features/catalog-ui) — Grid 5-col, filtros em sidebar, cards compactos aspect-[4/3]
- [Product Detail](mem://features/product-detail) — Layout 2 colunas, fichas técnicas detalhadas (Princípio ativo, Composição)
- [Admin Access](mem://features/admin-access) — Design da tela de login do painel administrativo
- [Contact Support](mem://features/contact-support) — Botão WhatsApp e estrutura do rodapé em 3 colunas
- [Purchase Notifications](mem://features/purchase-notifications) — Popups de compras recentes no canto inferior esquerdo
- [Cart System](mem://features/cart-system) — Carrinho drawer com controle de qtd e contador no header
- [Checkout Flow](mem://features/checkout-flow) — Frete R$ 80, seguro 10%, PIX/Cartão, CPF/CEP
- [Customer Area](mem://features/customer-area) — UI de autenticação e rotas de cliente (/seller, /kyc, /rifas)
- [Mobile-first](mem://preferences/mobile-first) — CTA "Comprar agora" + sticky bar no detalhe, atalhos diretos ao checkout