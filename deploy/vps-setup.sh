#!/usr/bin/env bash
set -euo pipefail
# Executar na VPS, dentro da pasta do projeto (ex.: /var/www/gimports/ka-imports-app).
# Antes: copiar o código para o servidor e criar/editar .env (não envie .env por e-mail em claro).

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Crie o ficheiro .env (pode copiar de .env.example e preencher)."
  echo "  cp .env.example .env && nano .env"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Instale Node.js 20 LTS ou superior: https://nodejs.org/"
  exit 1
fi

echo "A instalar dependências de produção…"
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

mkdir -p data public/uploads/products

export NODE_ENV="${NODE_ENV:-production}"

if command -v pm2 >/dev/null 2>&1; then
  echo "A arrancar com PM2…"
  pm2 delete gimports 2>/dev/null || true
  pm2 start server.js --name gimports --time
  pm2 save
  echo "PM2: pm2 logs gimports  |  pm2 restart gimports"
else
  echo "PM2 não está instalado. Instale: npm install -g pm2"
  echo "Ou use systemd; por agora pode testar com: NODE_ENV=production node server.js"
fi

echo ""
echo "Próximo passo: Nginx (ou Caddy) como reverse proxy para a porta do PORT no .env (por omissão 3000), com HTTPS."
echo "Defina PUBLIC_BASE_URL=https://seudominio.com e, atrás de proxy, TRUST_PROXY=1 e COOKIE_SECURE=1."
