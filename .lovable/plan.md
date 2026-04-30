
# Refatoração mobile-first com foco em conversão

Análise feita lendo `ProductDetail.tsx` (455L), `Catalog.tsx` (881L), `Checkout.tsx` (1257L), `Admin.tsx` (1209L) e `Header.tsx` (261L). O projeto **já está bem estruturado** — nada começa do zero. As mudanças abaixo são cirúrgicas, focadas em remover fricção e aumentar confiança no mobile (390px).

## Diagnóstico rápido do que JÁ existe (não precisa mexer)

- Produto: CTA grande, selos de confiança, calculadora de frete, ficha técnica, relacionados, breadcrumbs, JSON-LD, badge de estoque baixo.
- Catálogo: busca com debounce, chips horizontais de categoria, drawer de filtros com contadores, prefetch de imagem hi-res, `content-visibility:auto`.
- Header: drawer mobile com focus trap, ícones limpos, badge de carrinho.
- Checkout: validação inline campo a campo, máscaras BR, cupom, frete por UF, PIX 5%, seguro 10%.

O problema **não é falta de feature** — é que tudo está empilhado em páginas longas no mobile e algumas alavancas de conversão clássicas estão ausentes ou escondidas.

---

## Etapa 1 — Página de Produto (maior impacto)

**Sticky buy bar mobile**
Barra fixa no rodapé (apenas <lg) com miniatura, preço final + “3x” e botão **Comprar agora**. Aparece só após o usuário rolar além do CTA principal (IntersectionObserver). Já tem `pb-28 sm:pb-10` no container, então o espaço já está reservado.

**Bloco PIX em destaque**
Dentro do price card, adicionar linha “**No PIX: R$ X,XX** (5% off)” logo abaixo do preço. Hoje só aparece no checkout — antecipar para a página de produto reduz fricção.

**FAQ inline (4 perguntas)**
Após a ficha técnica, accordion nativo `<details>` (sem dependência) com:
- “É original?” → garantia + selo
- “Quanto tempo demora?” → prazo médio + link calculadora
- “Como pago?” → PIX/cartão/parcelamento
- “Posso devolver?” → política

**Reordenação mobile**
Ordem ideal no celular: imagem → nome → preço+PIX → CTA → selos → estoque baixo → frete → descrição → ficha → FAQ → relacionados.

---

## Etapa 2 — Catálogo (descoberta)

**Header de valor**
Faixa fina (h-7) acima do header, fundo `bg-primary/5`, texto pequeno: “🚚 Envio nacional · 🔒 100% original · 💬 Suporte WhatsApp”. Sumível ao scrollar.

**Cards mais informativos**
Hoje o card mostra nome + preço. Adicionar:
- Badge “MAIS VENDIDO” nos top 3 por views (já temos `trackEvent('view')`).
- Linha “3x R$ X” abaixo do preço (sem juros).
- Em promoções, manter o `-X%` que já existe.

**Busca persistente mobile**
Hoje a busca está fixa no topo da página. Tornar **sticky** abaixo do header (top-12) para que continue acessível ao rolar — reduz volta ao topo.

---

## Etapa 3 — Checkout em 3 passos (wizard)

Hoje é uma página única de 1257 linhas. No mobile vira uma rolagem cansativa. Quebrar em 3 passos visuais (sem mudar a lógica de submit, só esconder/mostrar seções):

```text
[ 1 Identificação ] → [ 2 Entrega ] → [ 3 Pagamento ]
   nome, email, cpf,    cep, endereço,    PIX/cartão,
   telefone             frete, seguro     cupom, finalizar
```

- Stepper no topo (3 bolinhas com check verde quando completo — reusa `derivedSteps` que já existe na linha 322).
- Botão “Continuar” no final de cada passo (desabilitado se inválido).
- Resumo do pedido vira **drawer “Ver resumo (R$ X)”** no mobile, sticky no rodapé.
- Desktop mantém layout atual (2 colunas).

Ganho: cada tela cabe em 1 viewport, percepção de progresso, abandono cai.

---

## Etapa 4 — Admin agrupado

13 abas em scroll horizontal hoje. Agrupar em **5 categorias** com submenu:

```text
Visão geral  → Dashboard, Funil, Relatórios
Catálogo     → Produtos, Categorias
Vendas       → Pedidos, Cupons, Fretes
Pessoas      → Usuários, Reenvios
Sistema      → Configurações, Diagnóstico, Histórico
```

- Mobile: menu vira **drawer lateral** (substitui scroll horizontal).
- Manter `?tab=` na URL e `Ctrl+K` (já existe).
- Nenhuma mudança na lógica de cada aba — só na navegação.

Cadastro de produtos (`AdminProducts`) e gestão de pedidos (`AdminOrders`) ficam para uma etapa futura — mexer agora explodiria o escopo.

---

## Detalhes técnicos

| Mudança | Arquivos | Risco |
|---|---|---|
| Sticky buy bar + PIX + FAQ | `src/pages/ProductDetail.tsx` | Baixo |
| Header de valor + cards + busca sticky | `src/pages/Catalog.tsx`, `src/components/layout/Header.tsx` | Baixo |
| Wizard 3 passos + resumo drawer | `src/pages/Checkout.tsx` | **Médio** (arquivo grande, mas só reorganiza JSX) |
| Agrupamento de abas | `src/pages/Admin.tsx` | Baixo |

Tudo usa o que já existe: Tailwind, `position:sticky`, `<details>` nativo, IntersectionObserver. **Zero novas dependências.**

---

## Ordem de execução sugerida

Começar pela **Etapa 1 (Produto)** — é o maior gerador de conversão e o menor risco. Depois você valida no preview e seguimos para Catálogo → Checkout → Admin.

Posso fazer tudo em sequência num único ciclo, ou parar a cada etapa para você revisar. **Confirma para começar pela Etapa 1?**
