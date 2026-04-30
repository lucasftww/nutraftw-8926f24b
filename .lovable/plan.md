
# Reformulação mobile-first para conversão

Análise do que está hoje + plano prático de mudanças, página por página. Foco: cliente comprando 100% pelo celular, faixa 25–50 anos, compra de farmacêuticos importados (decisão exige confiança).

---

## 1. Diagnóstico do que atrapalha hoje

**Catálogo**
- Header tem só logo + 2 ícones (perfil e carrinho). Sem busca visível, sem chamada do que a loja vende. Cliente novo cai e não entende em 1 segundo.
- Não há "barra de confiança" no topo (envio, garantia, original). Em farma isso é decisivo.
- Promoções e categorias aparecem como blocos longos sem hierarquia. Mobile rola muito até achar produto.
- Sem prova social no catálogo (avaliações, "X compraram hoje").

**Página de produto**
- Bloco de preço grande, mas a CTA "Comprar agora" some na rolagem. Não existe **barra fixa de compra** no rodapé mobile — fricção #1 em e-commerce mobile.
- Selos de confiança são uma linha fina cinza, sem peso visual.
- "Sobre o produto" e "Ficha técnica" empilhados — em farma o usuário quer ver Princípio Ativo logo, depois decidir.
- Não há FAQ inline ("É original?", "Em quanto tempo chega?", "Como pago?") — gera dúvida que não vira venda.
- Sem garantia explícita ("compra protegida", "devolução em 7 dias").

**Carrinho / checkout**
- Carrinho OK, mas o checkout tem 1257 linhas em uma única página — formulário muito longo no mobile (nome, e-mail, CPF, telefone, CEP, endereço, complemento, frete, cupom, pagamento, observação tudo junto). Sem etapas. Abandono alto.
- PIX tem 5% de desconto na função SQL mas não está bem destacado no checkout como o gatilho que é.
- Parcelamento 3x sem juros aparece no produto/carrinho mas não há reforço de "compra segura, dados criptografados" perto do botão final.

**Admin**
- Painel tem 14 abas (`dashboard, funnel, reports, products, categories, orders, coupons, shipping, users, resends, settings, diagnostics, audit`). Pelo celular é praticamente inutilizável.
- Cadastro de produto e edição de pedidos provavelmente em modais grandes — precisa virar fluxo mobile-friendly.

---

## 2. Plano de mudanças (em ordem de impacto na venda)

### Etapa 1 — Página de produto mobile (MAIOR IMPACTO)

1. **Sticky buy bar fixa no rodapé mobile**
   - Sempre visível enquanto rola: imagem mini + preço + botão "Comprar agora" laranja.
   - Faz a CTA acompanhar o scroll → conversão sobe forte em mobile.

2. **Bloco de confiança reformulado**
   - Acima do preço, 3 pílulas em linha: "✓ 100% Original" · "✓ Envio Brasil" · "✓ PIX 5% off".
   - Abaixo do CTA, faixa "Compra protegida · Dados criptografados · Suporte WhatsApp" com cadeado.

3. **Reordenar conteúdo**
   - Ordem nova: Imagem → Categoria + Nome → Preço/economia/PIX → CTA → Pílulas confiança → Estoque baixo → Calculadora frete → Princípio ativo (destacado em card) → Composição → Sobre o produto → FAQ → Relacionados.

4. **Mini FAQ inline (4 perguntas)**
   - "É original?" / "Quanto tempo demora?" / "Como funciona o PIX 5%?" / "E se não chegar?"
   - Acordeão simples, dispara dúvida e responde no mesmo lugar.

5. **Reforçar gatilho PIX**
   - Pílula verde "PIX -5%" ao lado do preço, com preço PIX calculado embaixo: "À vista no PIX por R$ 949,05".

6. **Galeria preparada para múltiplas imagens** (estrutura — produto hoje só tem 1 imagem; deixar pronto para quando o admin subir mais).

### Etapa 2 — Catálogo mobile

1. **Header com proposta de valor**
   - Linha fina sob o logo: "Farmacêuticos importados · Originais · Envio Brasil"
   - Barra de busca **sempre visível** colada no header (e não só após scroll), porque hoje o input está no corpo da página.

2. **Faixa de confiança (trust bar)**
   - Embaixo do header, 1 linha discreta com 3 ícones+texto: "100% Originais · Envio Nacional · PIX -5%". Sumiu na rolagem.

3. **Card mais "comercial"**
   - Já temos o card novo (imagem quadrada + strikethrough + botão laranja). Adicionar:
     - Badge "Mais vendido" / "Novo" / "Últimas unidades" quando aplicável.
     - Linha pequena "PIX R$ 949" abaixo do preço.

4. **Filtros mais simples no mobile**
   - Botão "Filtros" hoje é icon-only. Trocar por pill com texto "Filtros" + badge de contagem ativa — fica mais óbvio.

5. **Empty state e seções**
   - Topo: "🔥 Promoções da semana" com badge animado sutil.
   - Tirar contadores que poluem.

### Etapa 3 — Checkout em etapas (mobile)

Quebrar o checkout monolítico em **3 passos** visíveis com indicador no topo:

```
[1 Identificação] → [2 Entrega] → [3 Pagamento]
```

- **Passo 1**: nome, e-mail, CPF, telefone (4 campos, 1 botão "Continuar").
- **Passo 2**: CEP (autocompleta), número, complemento opcional → mostra opções de frete.
- **Passo 3**: PIX em destaque com selo "-5%" + cartão como alternativa secundária. Cupom em link "Tem cupom?" colapsável.

Outras mudanças no checkout:
- Resumo do pedido **fixo** no topo (mobile) ou lateral (desktop), sempre visível.
- Botão final "Pagar agora R$ XX,XX" sempre mostra o valor.
- Reforço de segurança: cadeado + "Pagamento seguro · Dados criptografados" abaixo do botão.

### Etapa 4 — Admin mais usável

1. **Reduzir abas de 14 para 6 grupos lógicos no menu lateral**:
   - Visão geral (dashboard + funil + relatórios em sub-abas)
   - Catálogo (produtos + categorias)
   - Vendas (pedidos + cupons + fretes + reenvios)
   - Pessoas (usuários)
   - Sistema (configurações + diagnóstico + auditoria)

2. **Mobile admin**: hoje quase não funciona no celular. Adicionar:
   - Menu lateral vira drawer no mobile.
   - Tabela de pedidos vira lista de cards no mobile (cada pedido = 1 card tocável).
   - Cadastro de produto: form em uma coluna no mobile, com preview da imagem grande.

3. **Quick actions na lista de pedidos**: swipe ou botões diretos para "Marcar como pago", "Enviado".

### Etapa 5 — Microcopy de conversão (em todo lugar)

- Botões: "Comprar agora" (não "Adicionar"), "Finalizar pedido seguro", "Pagar com PIX e economizar 5%".
- Vazios: "Seu carrinho está vazio — comece pelas promoções da semana →".
- Erros: humanos, não técnicos ("CEP não encontrado, digite o endereço manualmente").

---

## 3. Detalhes técnicos

**Arquivos a editar (sem criar dependências novas)**:
- `src/pages/ProductDetail.tsx` — sticky buy bar, FAQ, reordenação, PIX em destaque
- `src/pages/Catalog.tsx` — header proposta + trust bar + badges contextuais nos cards
- `src/components/layout/Header.tsx` — busca sempre visível no mobile
- `src/pages/Checkout.tsx` — refatorar em wizard de 3 passos com indicador de progresso (estado local, sem mudança de rotas)
- `src/pages/Admin.tsx` + `CommandPalette.tsx` — reagrupar abas em 5 grupos
- `src/components/admin/AdminDashboard.tsx`, `OrderDetailModal.tsx` — versão mobile-cards para tabelas

**Sem mudanças de banco**. Toda a lógica nova (PIX 5%, parcelamento, frete) já existe.

**Sem novas dependências**. Acordeão de FAQ implementado com `<details>` nativo + Tailwind.

**Performance**: sticky bars usam `position: sticky` + `bottom: 0` com `env(safe-area-inset-bottom)` para iPhone com notch.

---

## 4. Como vou entregar

Sugiro implementar nesta ordem (cada etapa traz ganho imediato visível):

1. **Página de produto** com sticky buy bar + FAQ + PIX destaque  ← maior conversão imediata
2. **Catálogo** com header proposta + trust bar + badges
3. **Checkout em 3 passos**
4. **Admin reagrupado + mobile-friendly**
5. **Microcopy** revisado em tudo

Posso fazer tudo em um único commit grande, ou ir por etapas — você prefere ver o resultado da Etapa 1 antes ou faço tudo de uma vez?
