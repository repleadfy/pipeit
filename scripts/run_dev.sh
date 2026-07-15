#!/usr/bin/env bash
# Local dev runner: Postgres (docker) + server (:3001) + web (:5173).
# Usage: ./scripts/run_dev.sh   — Ctrl-C stops server/web (Postgres keeps running).
set -euo pipefail
cd "$(dirname "$0")/.."

# Usuário de dev semeado automaticamente (login email/senha)
SEED_EMAIL="admin@email.com"
SEED_PASSWORD="admin"
SEED_NAME="Admin"

echo "▶ Subindo Postgres (docker)…"
yarn workspace @pipeit/server run dev:db

# Probe da porta NO HOST (é o que o server usa). Um container leftover pode subir
# sem publicar 5432 — nesse caso forçamos a recriação aplicando o mapeamento.
host_pg_up() { (exec 3<>/dev/tcp/127.0.0.1/5432) 2>/dev/null && exec 3>&- && return 0 || return 1; }

echo "▶ Aguardando Postgres aceitar conexões no host (127.0.0.1:5432)…"
for i in $(seq 1 15); do host_pg_up && break || sleep 1; done
if ! host_pg_up; then
  echo "⚠ Porta 5432 não publicada — recriando o container…"
  docker compose -f docker/docker-compose.yml up -d --force-recreate postgres
  for i in $(seq 1 15); do host_pg_up && break || sleep 1; done
fi
host_pg_up && echo "✓ Postgres pronto" || { echo "✗ Postgres inacessível em 127.0.0.1:5432"; exit 1; }

# Garante que server e web morram juntos no Ctrl-C
cleanup() { echo; echo "▶ Encerrando server/web…"; kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "▶ Server  → http://localhost:3001"
# Carrega o .env no ambiente do shell (tsx watch não repassa --env-file de forma confiável)
( cd packages/server && set -a && . ./.env && set +a && yarn exec tsx watch src/index.ts ) &

echo "▶ Web     → http://localhost:5173"
yarn dev:web &

# Semeia o usuário de dev assim que o server responder, e imprime as credenciais.
seed_user() {
  until curl -sf http://localhost:3001/health >/dev/null 2>&1; do sleep 1; done
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/auth/email/signup \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${SEED_EMAIL}\",\"password\":\"${SEED_PASSWORD}\",\"name\":\"${SEED_NAME}\"}") || true
  echo
  echo "────────────────────────────────────────────"
  case "$code" in
    200|201) echo "✓ Usuário de dev criado" ;;
    409)     echo "ℹ Usuário de dev já existe (ok)" ;;
    *)       echo "⚠ Não consegui semear o usuário (HTTP ${code:-?}) — crie pela tela de login" ;;
  esac
  echo "  Login:  http://localhost:5173/login"
  echo "  Email:  ${SEED_EMAIL}"
  echo "  Senha:  ${SEED_PASSWORD}"
  echo "────────────────────────────────────────────"
}
seed_user &

wait
