#!/usr/bin/env bash
# Aplica las migraciones sobre un PostgreSQL local con un stub de Supabase y ejecuta las pruebas de RLS.
# Uso: npm run test:db   (requiere psql y un servidor accesible vía PG* o el socket local)
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${TEST_DB:-mygym_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -c "create extension if not exists pgcrypto"
"${PSQL[@]}" -d "$DB" -f supabase/tests/supabase-stub.sql
for f in supabase/migrations/*.sql; do
  echo "→ $f"
  "${PSQL[@]}" -d "$DB" -f "$f"
done
if [ -f supabase/seed.sql ]; then echo "→ supabase/seed.sql"; "${PSQL[@]}" -d "$DB" -f supabase/seed.sql; fi
echo "→ supabase/tests/rls.test.sql"
"${PSQL[@]}" -d "$DB" -f supabase/tests/rls.test.sql
