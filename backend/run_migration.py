import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

HERE = Path(__file__).resolve().parent
ENV_PATHS = [HERE / '.env', HERE.parent / '.env', Path('.env')]
env_loaded = False
for p in ENV_PATHS:
    if p.exists():
        load_dotenv(dotenv_path=p, override=True)
        print(f"[OK] .env cargado desde: {p}")
        env_loaded = True
        break

if not env_loaded:
    print("[WARN] No se encontró archivo .env; usando variables de entorno del sistema.")

DB_URL = os.getenv('SUPABASE_DB_URL') or os.getenv('DATABASE_URL')
if not DB_URL:
    print("[ERROR] No se encontró SUPABASE_DB_URL ni DATABASE_URL en el entorno.")
    sys.exit(2)

# Allow passing a migration path as first arg; default to the sessions migration
if len(sys.argv) > 1:
    SQL_FILE = Path(sys.argv[1]).resolve()
else:
    SQL_FILE = HERE.parent / 'supabase' / 'migrations' / '20260811120000_add_sessions_and_device_actions.sql'
if not SQL_FILE.exists():
    print(f"[ERROR] Archivo de migración no encontrado: {SQL_FILE}")
    sys.exit(3)

sql_text = SQL_FILE.read_text(encoding='utf-8')

try:
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    with conn.cursor() as cur:
        # Split statements by semicolon and execute safely
        statements = [s.strip() for s in sql_text.split(';')]
        for idx, stmt in enumerate(statements):
            if not stmt.strip():
                continue

            # Skip statements that only contain SQL single-line comments
            lines = [ln.strip() for ln in stmt.splitlines() if ln.strip()]
            non_comment_lines = [ln for ln in lines if not ln.startswith('--')]
            if not non_comment_lines:
                # only comments or blank lines
                continue
            try:
                cur.execute(stmt + (';' if not stmt.strip().endswith(';') else ''))
            except Exception as e:
                print(f"[ERROR] Falló la ejecución de la sentencia #{idx}: {str(e)}")
                snippet = stmt.strip()[:300].replace('\n', ' ')
                print(f"Sentencia #{idx} contenido (truncado): {snippet}")
                raise
        conn.commit()
    print('[OK] Migración ejecutada correctamente.')
except Exception as e:
    print(f"[ERROR] Falló la migración: {e}")
    try:
        conn.rollback()
    except Exception:
        pass
    sys.exit(1)
finally:
    try:
        conn.close()
    except Exception:
        pass
