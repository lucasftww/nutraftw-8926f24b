## Remover Trust Bar do Catálogo

A faixa mobile com "Envio nacional · 100% original · Suporte" está em `src/pages/Catalog.tsx` (linhas 343–351), exibida apenas em mobile logo acima da busca sticky.

### Alteração
- **Arquivo:** `src/pages/Catalog.tsx`
- Remover o bloco `<div className="sm:hidden border-b border-border/40 bg-muted/30"> ... </div>` inteiro (linhas 343–351), incluindo o comentário explicativo acima.
- Limpar imports não mais usados (`Truck`, `ShieldCheck`, `MessageCircle`) caso não sejam referenciados em outro lugar do arquivo — verificar antes de remover para não quebrar build.

### Resultado
- A página de catálogo passa a iniciar direto pela barra de busca sticky no mobile, sem a linha de selos de confiança.
- Nenhuma alteração no Header, Footer ou em outras páginas (a Trust Bar do `ProductFooter`/`Header` é independente e permanece).