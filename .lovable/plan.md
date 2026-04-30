## Ajustes de espaçamento e hierarquia do catálogo (mobile)

### Diagnóstico
Analisei o catálogo no viewport 390×844 (mobile). Pontos a corrigir:

1. **Cards desalinhados verticalmente**: cards com promoção têm a linha "de R$ X" (strikethrough), cards sem promoção não — isso desloca o preço e o botão para alturas diferentes na mesma linha do grid.
2. **Imagens com tamanhos visuais inconsistentes**: alguns produtos preenchem 95% do quadrado, outros só 60% (pelos próprios assets). `object-cover` corta uns, deixa outros pequenos. Resultado: grid com "ritmo" visual quebrado.
3. **Espaçamentos verticais um pouco apertados/desproporcionais**:
   - Chips de categoria → título da seção: só `py-2` da section, sem respiro claro.
   - Entre seções: `space-y-12` (48px) — exagerado no mobile, gera vazios grandes.
   - Título "Promoções" → grid: `mb-4` ok, mas pode ganhar leve subtítulo de contexto.
4. **Hierarquia interna do card**:
   - Badge "NOVO" e badge "-X%" usam visuais muito diferentes (um é ponto + texto cinza, outro é pill sólida laranja). OK conceitualmente, mas o "NOVO" parece "solto" sem alinhar à mesma altura do espaço onde fica o "-X%" nos outros cards.
   - Linha "3x R$ X" muito apagada (`text-[11px]` cinza) — gatilho de conversão merece um pouco mais de presença.
   - Botão "Comprar" laranja pesa demais em cards pequenos; ícone + texto disputam espaço.
5. **Busca sticky e chips**: o `pt-3` da busca + `mt-3` dos chips funciona, mas no mobile ganha-se mais clareza puxando os chips um pouco mais perto da busca (formam uma "barra de filtros" coesa) e dando mais respiro antes do título "Promoções".

### Mudanças propostas (`src/pages/Catalog.tsx`)

**1. Normalizar a altura da área de preço (alinhar grid)**
- Envolver o bloco de preço em um container com `min-h` fixo que reserva espaço da linha "de R$" mesmo quando não há promoção (linha invisível ou simplesmente `min-h` calculado). Resultado: preço final e botão "Comprar" sempre na mesma altura entre cards vizinhos.

**2. Normalizar imagens**
- Trocar `object-cover` por `object-contain` com `p-3` no container da imagem, mantendo `bg-white`. Isso uniformiza visualmente: todos os produtos respiram dentro do quadrado, sem corte. (Padrão usado em catálogos farmacêuticos/marketplace de qualidade.)

**3. Ritmo vertical entre seções**
- `space-y-12` → `space-y-8 md:space-y-12` (32px mobile, 48px desktop).
- `section py-2` → `section py-3 md:py-4`.
- Entre chips de categoria e a primeira seção: aumentar de `mt-3` para `mt-4 md:mt-6` no container de chips, e adicionar `mt-2` no container das sections.

**4. Hierarquia do card**
- Reservar slot fixo no topo do conteúdo do card para badges secundárias (linha "NOVO" / "Mais vendido" / vazia), com `min-h-[16px]` — assim o título começa sempre na mesma altura.
- Aumentar a linha de parcelamento de `text-[11px]` para `text-xs font-medium` (ainda discreto, mas legível como gatilho). Cor `text-foreground/70` em vez de `text-muted-foreground`.
- Botão Comprar: manter laranja (cor de marca KA), mas reduzir o ícone `ShoppingCart` (h-3.5) e dar `gap-1` para o texto ganhar protagonismo.

**5. Título de seção com subtítulo opcional**
- Em "Promoções", adicionar um subtítulo curto cinza `Ofertas com até X% off` (calculado do maior desconto da seção). Reforça hierarquia e dá contexto sem poluir.

**6. Padding lateral do card**
- Conteúdo do card: `p-3 sm:p-3.5` → `px-3 pt-3 pb-3 sm:px-3.5 sm:pt-3.5 sm:pb-4` para um respiro maior abaixo do botão.

### O que NÃO muda
- Cores, fontes, paleta — mantidos os tokens do design system (azul marinho + laranja secundário do KA Imports).
- Estrutura HTML, rotas, lógica de filtros, prefetch e infinite-scroll.
- Header, busca sticky e drawer de filtros (já bem resolvidos).

### Resultado esperado
- Grid de produtos com cards perfeitamente alinhados (preço e CTA na mesma linha entre vizinhos).
- Imagens com apresentação uniforme, independente do recorte do asset.
- Ritmo vertical mais suave entre seções no mobile (menos vazios).
- Hierarquia clara dentro do card: badge → título → preço (com parcelamento legível) → CTA.