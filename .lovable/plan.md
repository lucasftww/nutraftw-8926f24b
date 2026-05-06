
## Escopo da auditoria

Vou cobrir 4 frentes em uma única passada:

### 1. Rebranding final → Royal Vita
Achei resquícios de "G Imports" ainda no código:
- `src/pages/Install.tsx` (título da página + H1) — trocar para Royal Vita.
- `src/assets/logo-gimports.svg` — deletar (não é mais referenciado).
- Varredura final por `gimports/g imports` para garantir zero ocorrência.

### 2. Logo + tipografia "Royal Vita"
A logo SVG atual (monograma RV navy + swoosh ciano) está bonita e legível em 32px no header. Em vez de redesenhar, vou **refinar**:
- Ajustar pesos/curvas do "R" e "V" (atualmente o "R" tem stroke-linejoin que deixa o pé reto cortado).
- Adicionar uma **versão horizontal** (monograma + nome "ROYAL VITA" em letras espacadas) para usar no admin e no rodapé — dá mais autoridade que só o ícone.
- Trocar a fonte do nome no header de **Plus Jakarta Sans semibold** para **Cormorant Garamond / Fraunces** (display serif elegante) ou manter Jakarta com `tracking-[0.18em]` em uppercase. Vou usar **Fraunces** (serif moderna, free no Google Fonts) com pequeno tracking — combina com "Royal" sem virar joalheria datada.

### 3. Polish do admin (foco no Funil)
Funil atual é funcional mas monocromático (tudo em primary/40 a primary/100). Redesenho:
- **KPIs no topo**: cada card ganha cor própria (visitantes=primary, pedidos=brand-cyan, receita=success, conversão=secondary com gradient). Ícone grande, número em font-display.
- **Etapas do funil**: troca as barras retangulares por **funil real** (cada etapa mais estreita que a anterior, gradiente do ciano para o verde), com badge de % conversão flutuante.
- **Drop-off**: highlight em card âmbar separado quando a perda é > 30%, com sugestão acionável ("Veja produtos com baixa conversão abaixo").
- **Tabela "onde mais perdemos vendas"**: linhas zebradas + mini-barra inline mostrando ratio view→cart→paid.

Polish geral do admin:
- Banner de boas-vindas no Dashboard com saudação por horário.
- Cards do dashboard com ícones coloridos consistentes (cada métrica = uma cor da paleta).
- Espaçamento mais generoso entre seções e títulos com underline ciano sutil.
- Garantir que todas as referências internas digam "Royal Vita" (já estavam OK, mas confirmo).

### 4. Auditoria de bugs/falhas

Encontrei estes pontos para corrigir:

| # | Arquivo | Problema |
|---|---------|----------|
| 1 | `src/pages/Install.tsx` | "G Imports" no título e H1 |
| 2 | `src/components/admin/AdminPromotions.tsx` | `Promise.all` no `saveOrder` faz N updates paralelos — ineficiente e sem rollback. Trocar por upsert em lote. |
| 3 | `src/hooks/useAuth.tsx` | Quando `roleLoading` está true e `loading=false`, o RequireAuth de rotas comuns não trava — OK, mas falta tratamento para sessão expirada (sem refresh automático mostra "carregando…" infinito). Adicionar timeout de 5s. |
| 4 | `src/components/admin/AdminFunnel.tsx` | `lowVtc` e `lowCtp` não tratam div/0 explicitamente em produtos sem views. Já está safe via `ratio()` mas a condição `views >= 10` evita falsos positivos — manter. |
| 5 | `src/lib/cart-store.ts` (suspeita) | Verificar se carrinho persiste após logout sem leakar entre usuários. |
| 6 | Logo SVG | Path do "R" tem stroke aberto que pode renderizar inconsistente em alguns browsers. Refazer com path fechado. |

Vou ler `cart-store.ts` durante a implementação para confirmar o item 5 antes de mexer.

### O que NÃO vou fazer agora
- **Não vou** mudar a paleta global (azul royal + laranja CTA + verde PIX já testada para conversão).
- **Não vou** redesenhar páginas da loja (catálogo, produto, checkout) — você só pediu admin + logo + bugs.
- **Não vou** adicionar features novas além das listadas (sem dashboard novo, sem export, etc.).

### Entregáveis
- Logo SVG refinada + variante horizontal para admin/footer.
- Funil redesenhado com cores e funil visual real.
- Dashboard admin com banner e cards coloridos.
- Todas as ocorrências "G Imports" → "Royal Vita".
- Bugs 1, 2, 3, 6 corrigidos. Item 5 verificado (e corrigido se necessário).

## Detalhes técnicos
- Logo: novo `src/assets/logo-royalvita.svg` (refinado) + novo `src/assets/logo-royalvita-horizontal.svg`.
- Fonte: adicionar Fraunces ao import do Google Fonts em `index.css`, criar token `font-brand` no Tailwind config, aplicar no `<span>Royal Vita</span>` do Header e ProductFooter.
- Funil: reescrever `AdminFunnel.tsx` mantendo as RPCs (`funnel_summary`, `funnel_by_product`) — só muda renderização.
- Promoções: trocar `Promise.all(map(update))` por uma única chamada com `.upsert([...])`.
- Auth: `setTimeout` em `roleLoading` que força `setRoleLoading(false)` após 5s para evitar tela travada.
