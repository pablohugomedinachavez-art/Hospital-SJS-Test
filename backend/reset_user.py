from werkzeug.security import generate_password_hash

# Try importing from app_2 first, then fall back to app
try:
    from app_2 import app, db_query
except ImportError:
    from app import app, db_query

USERNAME = "admin"
NEW_PASSWORD = "Admin123!"

with app.app_context():
    # 1. Hash the new password
    hashed_password = generate_password_hash(NEW_PASSWORD)

    # 2. Get or create a default tenant
    tenant = db_query('SELECT id FROM tenants LIMIT 1', fetchone=True)
    if not tenant:
        db_query('INSERT INTO tenants (name) VALUES (%s)', ('Tenant Principal',))
        tenant = db_query('SELECT id FROM tenants LIMIT 1', fetchone=True)
    
    tenant_id = tenant['id'] if isinstance(tenant, dict) else tenant[0]

    # 3. Check if target user exists
    existing_user = db_query('SELECT id FROM users WHERE username = %s', (USERNAME,), fetchone=True)

    if existing_user:
        # Detect whether table uses 'password_hash' or 'password' column name
        try:
            db_query('UPDATE users SET password_hash = %s, tenant_id = %s WHERE username = %s', 
                     (hashed_password, tenant_id, USERNAME))
        except Exception:
            db_query('UPDATE users SET password = %s, tenant_id = %s WHERE username = %s', 
                     (hashed_password, tenant_id, USERNAME))

        print(f"[OK] Password and tenant updated for user '{USERNAME}'.")
    else:
        # Get admin role_id if present
        role_res = db_query("SELECT id FROM roles WHERE name = 'admin' LIMIT 1", fetchone=True)
        role_id = (role_res['id'] if isinstance(role_res, dict) else role_res[0]) if role_res else 1

        # Insert user with support for both password field standard names
        try:
            db_query(
                'INSERT INTO users (username, password_hash, role_id, tenant_id) VALUES (%s, %s, %s, %s)', 
                (USERNAME, hashed_password, role_id, tenant_id)
            )
        except Exception:
            db_query(
                'INSERT INTO users (username, password, role, tenant_id) VALUES (%s, %s, %s, %s)', 
                (USERNAME, hashed_password, 'admin', tenant_id)
            )

        print(f"[OK] User '{USERNAME}' successfully created with tenant_id={tenant_id}.")