## Análise de cores do site (foco em conversão)

Auditei o `index.css` (design tokens), botões, badges, CTAs em **Catálogo, Detalhe do Produto, Carrinho, Checkout, Header, Wishlist e Admin**.

---

### 1. Paleta atual (resumo)

| Token | Cor | Uso |
|---|---|---|
| `--primary` | Azul marinho `222 65% 20%` | Marca, links, header, ícones, preço no catálogo |
| `--secondary` | Laranja `18 95% 54%` | CTA "Comprar agora", "Comprar", badges de desconto |
| `--success` | Verde `145 75% 38%` | PIX, "economize", botão final do checkout, frete grátis |
| `--accent` | Ciano `199 89% 48%` | Não usado (morto) |
| `--destructive` | Vermelho `0 78% 55%` | Erros, "última unidade" |

**Veredito geral:** A paleta é **boa e adequada para farma/saúde** — azul marinho passa confiança (estilo KA Imports / farmácia), laranja é o padrão Amazon/ML para conversão, verde reforça PIX/economia. **Não precisa trocar a paleta base.**

---

### 2. Pontos fortes ✅

- **Hierarquia clara de CTAs:** azul (marca) ≠ laranja (comprar) ≠ verde (finalizar/PIX). O olho sabe pra onde ir.
- **Botão "Comprar agora" laranja** com `shadow-secondary/30` + `h-14` — alta conversão, segue padrão de marketplace.
- **Badge "Economize -X%"** verde sobre o preço — gatilho psicológico forte, bem posicionado.
- **Pílula "No PIX 5% off"** em verde no card de preço — antecipa benefício antes do checkout (excelente).
- **Botão final do checkout em verde** (`bg-success`) — separa visualmente do "comprar" laranja, sinaliza "ação concluída".

---

### 3. Problemas que prejudicam conversão ⚠️

#### 3.1 Inconsistência: dois "verdes" diferentes para PIX
- `bg-success/8` no detalhe do produto (linha 251 de `ProductDetail.tsx`) — `/8` é uma opacidade não-padrão do Tailwind, pode renderizar inconsistente. Trocar por `bg-success/10`.

#### 3.2 Cupom usa `bg-secondary/10` em vez de `bg-success/10` (Checkout linha 1411)
- Quando o cupom é **válido**, o feedback aparece em **laranja**, não verde. Isso quebra a convenção mental "verde = sucesso" que o resto do site usa. **Trocar para success.**

#### 3.3 Texto "até X% off" no catálogo em laranja sobre fundo claro (linha 660)
- `text-secondary` (laranja `54% lightness`) sobre branco tem contraste **WCAG ~3.1:1** — abaixo do AA (4.5:1). Difícil de ler para alguns usuários, especialmente no celular sob luz.
- Solução: usar `text-secondary` com `font-extrabold` já ajuda, mas idealmente trocar por uma versão mais escura (`hsl(18 95% 44%)`) ou usar `text-success` (combina com "economia").

#### 3.4 Badge laranja "-X% OFF" no detalhe muito grande (px-3 py-1, text-sm)
- OK, mas quando combinado com o badge verde "Economize..." logo abaixo, há **duas vezes a mesma mensagem em duas cores diferentes**. Isso polui. Manter apenas o verde "Economize" (que é mais informativo) e deixar o laranja apenas no card do catálogo.

#### 3.5 `--accent` (ciano) está definido mas nunca usado
- Token morto. Pode-se remover ou aproveitar para destacar o link "Ver tudo →" e breadcrumbs (atualmente usam `text-primary`, que se mistura com tudo).

#### 3.6 Botão "Adicionar ao carrinho" no detalhe é só texto cinza sublinhado
- `text-muted-foreground` (cinza) é muito apagado. Quem prefere o carrinho (para juntar mais itens) pode não ver o link. Sugestão: deixar como **outline azul** (`btn-outline` style), mantendo o laranja "Comprar agora" como dominante.

#### 3.7 Selo "Esgotado" no catálogo usa `bg-foreground/85`
- Funciona, mas um cinza neutro (`bg-muted-foreground`) ou vermelho sutil seria mais convencional para "indisponível".

---

### 4. Mudanças propostas (curtas, alta prioridade)

| # | Arquivo | Mudança | Impacto |
|---|---|---|---|
| 1 | `Checkout.tsx:1411-1415` | Cupom válido: `bg-secondary/10` → `bg-success/10`, ícone `text-secondary` → `text-success` | Consistência verde=sucesso |
| 2 | `ProductDetail.tsx:251` | `bg-success/8` → `bg-success/10` | Opacidade Tailwind padrão |
| 3 | `ProductDetail.tsx:285-299` | "ou adicionar ao carrinho" vira botão outline azul `border-2 border-primary/30 text-primary` | CTA secundário visível |
| 4 | `ProductDetail.tsx:201-205` | Remover badge laranja "-X% OFF" da imagem **OU** remover o "Economize" verde de cima do preço — manter apenas um | Reduz redundância visual |
| 5 | `Catalog.tsx:660` | `text-secondary` → `text-success font-extrabold` no "até X% off" | Melhor contraste + reforça economia |
| 6 | `Catalog.tsx:790` | Selo "Esgotado": `bg-foreground/85` → `bg-muted-foreground/90` | Visual mais convencional |
| 7 | `index.css` | `--accent` ciano → reaproveitar para links secundários OU remover | Limpeza do design system |

---

### 5. O que **NÃO** mudar

- ❌ Não trocar laranja do CTA principal — é o padrão de conversão de e-commerce no Brasil.
- ❌ Não trocar verde do botão final do checkout — separação visual correta entre "comprar" e "finalizar pagamento".
- ❌ Não mexer no azul marinho — é a identidade da marca farmacêutica.
- ❌ Não adicionar mais cores — 3 cores (azul/laranja/verde) já é o limite ideal pra não dispersar atenção.

---

### Próximo passo

Confirma que faço as **7 mudanças acima**? Ou prefere selecionar só algumas (ex.: só as de consistência — itens 1, 2, 5 — e deixar os ajustes de hierarquia para depois)?
