## Auditoria visual do /admin

Analisei `Admin.tsx`, `AdminDashboard`, `WeeklyReport`, `AdminAuditLog`, `AdminFunnel`, `AdminWishlist`, `AdminPromotions`, `CommandPalette`, `AdminShipping/Coupons/Affiliates` e os tokens em `index.css`.

O painel já tem boa base (sidebar agrupada, dark "Luminous Editorial", tipografia Sora+Inter, breadcrumb, ⌘K). Os problemas são pontuais e nascem de **inconsistência de paleta** (mistura tons claros `bg-emerald-50`/`text-blue-700` num tema dark), **emojis ✓/⚠** soltos, e **glow/sombras desigualmente aplicados**.

### Problemas encontrados

1. **Cores claras quebrando o tema dark** — vários componentes ainda usam paleta clara (visível porque `.dark` envolve todo `/admin`):
   - `AdminAuditLog.tsx` linhas 44–50: `bg-blue-50 text-blue-700`, `bg-amber-50 text-amber-700`, `bg-emerald-50 text-emerald-700` → ficam manchas brancas no dark.
   - `AdminFunnel.tsx` linha 447: `iconBg: bg-emerald-100`, `chipBg: bg-emerald-50` → idem.
   - `WeeklyReport.tsx` linhas 488, 760, 827: deltas e badge "✓ Tudo bate" com `bg-emerald-50`/`bg-amber-50`.
   - `AdminDashboard.tsx` linhas 310–312: `text-emerald-600`/`text-amber-600` (tons de tema claro).

2. **Emojis textuais como status** — `✓`, `⚠`, `🛡️`, `⚠️` em `AdminAuditLog` e `WeeklyReport` quebram a estética. Existem ícones Lucide equivalentes (`CheckCircle2`, `AlertTriangle`, `ShieldAlert`).

3. **Welcome banner do Dashboard usa gradiente CTA-like** muito vibrante (primary→primary-glow→brand-cyan) mais "marketing" que "painel". Vale tornar mais sóbrio (gradiente discreto + textura sutil), preservando o bloco de receita.

4. **Inconsistência de cantos/sombras**: cards usam misturas de `rounded-2xl`, `rounded-xl`, `shadow-sm`, `shadow-soft`, `shadow-pop`. Padronizar como `rounded-2xl` + `shadow-soft` em containers, `rounded-xl` em chips/inputs.

5. **Botões "pill" custom espalhados** (toolbar do Reports, filtros) — h-9 px-3 reescritos várias vezes. Há margem para uma utility `.admin-chip` no `index.css`.

6. **Hover/focus no menu lateral**: o indicador esquerdo `box-shadow: 0 0 12px primary/0.6` em cada item é forte para "lista comprida"; reduzir para 6–8px e remover do hover (manter só no item ativo).

7. **Avatar do usuário (sidebar inferior)** mostra duas letras do email — podemos exibir um dot verde de "online" e melhorar contraste do email (atualmente `text-muted-foreground/0.55` mistura com o fundo).

8. **Top bar** — botão de busca tem hover com glow primário; bom. Falta um divisor/sombra sutil ao rolar (já é `sticky` mas funde com o conteúdo). Adicionar `shadow-[0_1px_0_hsl(var(--border))]` quando rolar.

9. **AdminDashboard "WelcomeBanner"** — bolhas brancas (`bg-white/10`) somem no dark (ok), mas o gradiente é o mesmo do botão CTA. Trocar para gradient `from-primary/15 via-card to-card` com borda fina + glow do primary atrás do título.

10. **AdminFunnel passos**: ícone com gradiente `text-white` em fundo escuro é ok, mas as cards do passo usam `bg-emerald-50` no chip → quebra. Padronizar pra `/15 + ring`.

11. **Tabs/navegação mobile**: drawer ok; falta micro-animação de entrada (slide-in-right já existe no tailwind config — usar).

12. **Chips de status de pedidos** (`Admin.tsx` 1262–1266) já estão bem (escala emerald/amber/cyan). Replicar o padrão em **toda** a UI (audit, funil, dashboard, wishlist).

### O que vou implementar

1. **Padronizar paleta de status no dark** (criar pequeno helper `STATUS_TONE` em `src/components/admin/statusTone.ts`):
   ```ts
   ok:    "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25"
   warn:  "bg-amber-500/15  text-amber-400  ring-1 ring-amber-500/25"
   info:  "bg-primary/15    text-primary    ring-1 ring-primary/25"
   error: "bg-destructive/15 text-destructive ring-1 ring-destructive/30"
   muted: "bg-muted text-muted-foreground ring-1 ring-border"
   ```
   Aplicar em `AdminAuditLog`, `AdminFunnel`, `AdminDashboard`, `WeeklyReport`.

2. **Trocar emojis por ícones Lucide** em audit log e validação financeira (`CheckCircle2`/`AlertTriangle`/`ShieldAlert`).

3. **Refinar WelcomeBanner**: gradient sóbrio (`from-card via-card to-primary/5`), borda primary/15, halo do primary atrás do título com `blur-2xl`, manter chip "Painel Royal Vita" e tipografia atual.

4. **Acertar `AdminDashboard` Last24h** — chips emerald/amber com tons /400 (não /600).

5. **Refinar sidebar**: reduzir glow do indicador ativo (6px), aumentar contraste do email do user (`text-foreground/70`), adicionar dot online (success).

6. **Top bar com sombra ao rolar** via `useState` + scroll listener (ou border-b já existe — apenas garantir contraste suficiente).

7. **Adicionar utilities em `index.css`** (sem mudar tokens):
   - `.admin-chip` — pill h-9 px-3 rounded-full border bg-background hover:bg-accent text-xs font-semibold.
   - `.admin-card` — `bg-card rounded-2xl border border-border shadow-soft`.
   - `.admin-section-title` — `text-sm font-semibold tracking-tight flex items-center gap-2`.
   Não vou refatorar todo lugar de uma vez — só onde vou tocar.

8. **AdminFunnel**: trocar `iconBg: bg-emerald-100` etc. por `bg-primary/15 ring-primary/25`. Manter gradiente do número de passo.

9. **AdminWishlist**: chips de estoque já usam `/500/15` — deixar.

### Fora de escopo (peço confirmação se quiser)

- Refazer paleta de cores do tema dark inteiro (alterar tokens `--primary`, `--background`).
- Reorganizar a IA das abas (já agrupadas em 5 grupos).
- Trocar a fonte (Sora/Inter já carregadas).
- Adicionar dark/light toggle no admin (hoje é forçado dark).

### Arquivos que serão editados

- `src/components/admin/statusTone.ts` (novo, ~25 linhas)
- `src/components/admin/AdminAuditLog.tsx`
- `src/components/admin/AdminDashboard.tsx`
- `src/components/admin/AdminFunnel.tsx`
- `src/components/admin/WeeklyReport.tsx`
- `src/pages/Admin.tsx` (sidebar refinements)
- `src/index.css` (3 utilities admin-*)

Sem migrações, sem alteração de comportamento, apenas visual. Aprova?
