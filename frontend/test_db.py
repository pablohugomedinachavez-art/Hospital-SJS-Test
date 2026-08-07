import os
import psycopg2

db_url = os.environ.get('SUPABASE_DB_URL')

if not db_url:
    print("Error: La variable SUPABASE_DB_URL no está configurada.")
    exit(1)

try:
    print("Conectando a Supabase PostgreSQL...")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # Consulta simple para validar conectividad
    cur.execute("SELECT version();")
    db_version = cur.fetchone()
    print("¡Conexión exitosa!")
    print(f"Versión de base de datos: {db_version[0]}")
    
    # Comprobar que las tablas existen
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public';
    """)
    tables = cur.fetchall()
    print("\nTablas encontradas en el esquema público:")
    for table in tables:
        print(f" - {table[0]}")

    cur.close()
    conn.close()

except Exception as e:
    print("\nError al conectar con la base de datos:")
    print(e)