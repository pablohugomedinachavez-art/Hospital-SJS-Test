from app import app, db, User, Tenant
from werkzeug.security import generate_password_hash

USERNAME = "admin"
NEW_PASSWORD = "Admin123!"

with app.app_context():
    # 1. Asegurar un Tenant por defecto con SQLAlchemy
    tenant = Tenant.query.first()
    if not tenant:
        tenant = Tenant(name="Tenant Principal")
        db.session.add(tenant)
        db.session.commit()
        print(f"[OK] Tenant creado con ID: {tenant.id}")

    # 2. Buscar o crear el usuario admin mediante el ORM
    user = User.query.filter_by(username=USERNAME).first()

    hashed_pw = generate_password_hash(NEW_PASSWORD)

    if user:
        user.password = hashed_pw
        user.tenant_id = tenant.id
        user.role = "admin"
        print(f"[OK] Contraseña del usuario '{USERNAME}' actualizada correctamente.")
    else:
        user = User(
            username=USERNAME,
            password=hashed_pw,
            role="admin",
            tenant_id=tenant.id
        )
        db.session.add(user)
        print(f"[OK] Usuario '{USERNAME}' creado exitosamente.")

    db.session.commit()