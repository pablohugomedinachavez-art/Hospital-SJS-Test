from app import app, db_query
from werkzeug.security import generate_password_hash

USERNAME = "admin"
NEW_PASSWORD = "Admin123!"

with app.app_context():
    # 1. Cifrar la contraseña
    hashed_password = generate_password_hash(NEW_PASSWORD)

    # 2. Obtener o crear un tenant de prueba
    tenant = db_query('SELECT id FROM tenants LIMIT 1', fetchone=True)
    if not tenant:
        db_query('INSERT INTO tenants (name) VALUES (%s)', ('Tenant Principal',))
        tenant = db_query('SELECT id FROM tenants LIMIT 1', fetchone=True)
    
    tenant_id = tenant['id'] if isinstance(tenant, dict) else tenant[0]

    # 3. Verificar si el usuario admin ya existe
    existing_user = db_query('SELECT id FROM users WHERE username = %s', (USERNAME,), fetchone=True)

    if existing_user:
        # Actualizar la contraseña del usuario existente
        db_query('UPDATE users SET password = %s, tenant_id = %s WHERE username = %s', (hashed_password, tenant_id, USERNAME))
        print(f"[OK] Contraseña y tenant del usuario '{USERNAME}' actualizados correctamente.")
    else:
        # Insertar el nuevo usuario con su tenant_id obligatorio
        db_query('INSERT INTO users (username, password, role, tenant_id) VALUES (%s, %s, %s, %s)', 
                 (USERNAME, hashed_password, 'admin', tenant_id))
        print(f"[OK] Usuario '{USERNAME}' creado exitosamente con tenant_id={tenant_id}.")