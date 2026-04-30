## Objetivo

Reduzir ruído visual e atrito de decisão. Mais respiro, menos botões competindo, foco em preço + categoria + 1 ação clara. Aplicar em 4 áreas, em ordem de impacto.

---

## 1. Card do produto (Catalog.tsx → ProductCard)

- **Imagem** muda de `aspect-square` para `aspect-[4/3]` (alinha com a memória `catalog-ui`, deixa card mais baixo, cabe mais por scroll).
- **Título** vira 1 linha com `truncate` (não mais 2 linhas com altura mínima).
- **Preço riscado** removido do card. Quando há promoção, o sinal de desconto fica só no badge `-X%` no canto superior direito (já existe).
- **Botão "Comprar" cheio** removido. Substituído por ícone `+` discreto (40px, círculo, fundo `secondary`, ícone branco) absolutamente posicionado no canto inferior direito do card, sobreposto à info.
- **Wishlist (coração)**: no desktop só aparece em `group-hover`; no mobile fica visível mas em cinza claro (não branco com sombra) para não competir com preço.
- **Badge "Novo"**: trocar do preto agressivo para um ponto cinza + texto pequeno discreto (ou remover quando há `-X%`, para nunca empilhar).
- **Resultado**: linha do card vira `Imagem 4:3` → `título 1 linha` → `preço grande` (com `+` flutuante ao lado). Bem mais respirado.

## 2. Catálogo — filtros + cabeçalhos (Catalog.tsx)

- **Chips horizontais de categoria** logo abaixo da busca, com scroll horizontal no mobile (`overflow-x-auto`, `snap`). Itens: `Tudo` · `Promoções` (se houver) · todas as categorias na ordem atual. Chip ativo usa `bg-primary text-primary-foreground`. Substitui o botão "Filtros" como caminho principal.
- **Botão "Filtros"** vira só ícone `SlidersHorizontal` (40×40) ao lado da busca — abre o drawer já existente para multi-seleção avançada e ordenação. O `<select>` de ordenar sai do header (vai pra dentro do drawer onde já não está; adicionar lá).
- **Cabeçalho de cada seção (`<Section>`)**: remover o contador "N itens". Manter só o título grande. Limpa muito a coluna direita.
- **Seção "Promoções"** continua existindo, mas perde o destaque duplicado: quando o usuário clicar no chip "Promoções", o catálogo já mostra só elas — então a seção topo "Promoções" só aparece quando o filtro é "Tudo" (comportamento atual mantido aí).

## 3. Página do produto (ProductDetail.tsx)

- **Um único CTA primário**: "Comprar agora" (mantém o estilo atual, grande, laranja). Em vez do segundo botão grande "Adicionar ao carrinho", deixar um link de texto pequeno e centralizado abaixo: `ou adicionar ao carrinho`.
- **"Você economiza R$X"** sai de baixo do preço e vira uma pílula verde acima do preço grande: `ECONOMIZE R$X (-20%)`. Gatilho mais visível.
- **Selos de confiança** mudam de 2 cards para 3 itens em linha horizontal fina (sem caixa, só ícone + texto): `Envio nacional · 100% original · Suporte WhatsApp`.
- **Sticky CTA mobile**: remover a linha "em 3x sem juros" (duplica o card de preço acima). Fica só preço + botão `Comprar agora`.
- **Wishlist inline**: manter como está (link discreto abaixo do CTA).

## 4. Hero / Vitrine (VitrineHero.tsx)

Quando NÃO há banner ativo (estado padrão), substituir o layout "logo grande + bio + Instagram" por uma vitrine direta:

- Headline curta: `Farmacêuticos importados, originais.`
- Sublinha: `Envio para todo o Brasil. Suporte direto no WhatsApp.`
- Linha de micro-prova (3 itens com ícone fininho): `Procedência verificada · Envio nacional · Pagamento seguro`.
- Sem logo gigante, sem ícone Instagram em destaque. Altura total ~30% menor que hoje.

Quando HOUVER banner ativo, manter exatamente o layout atual (não mexer).

---

## Detalhes técnicos

**Arquivos editados:**
- `src/pages/Catalog.tsx` — `ProductCard`, `Section`, header de filtros, novo bloco de chips horizontais.
- `src/pages/ProductDetail.tsx` — bloco de preço, CTAs, selos, sticky bar.
- `src/components/vitrine/VitrineHero.tsx` — branch sem banner.

**Sem migração**, sem novos componentes externos, sem libs novas. Tudo Tailwind + tokens semânticos existentes (`primary`, `secondary`, `success`, `muted`, `border`).

**Manter intacto:**
- Drawer de filtros (só adicionar o select de ordenação dentro dele).
- Lógica de `useProducts`, `useCategories`, agrupamento `grouped`, busca, prefetch.
- Header, Footer, Carrinho, Checkout.

**Acessibilidade:**
- Chips de categoria viram `<button>` com `aria-pressed`.
- Botão `+` do card mantém `aria-label="Adicionar {nome} ao carrinho"`.
- Link de "adicionar ao carrinho" na página de produto continua sendo `<button>` (não `<a>`), com foco visível.

---

## Fora do escopo deste plano

- Header (já está limpo, sem mudanças).
- Footer (alinhar com `mem://features/contact-support` fica para outro ciclo).
- Notificações de compra, carrinho drawer, checkout — não mexer.

---

Confirma que quero seguir tudo isso?