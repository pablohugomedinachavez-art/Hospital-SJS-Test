import os
import sqlite3
import datetime
from functools import wraps

from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS
import jwt
from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.environ.get('DB_PATH') or os.path.join(BASE_DIR, 'hospital.db')
SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key')
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'frontend'))
ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
]
DEMO_DATA_ENABLED = os.environ.get('DEMO_DATA_ENABLED', 'true').lower() in {'1', 'true', 'yes', 'on'}

app = Flask(__name__)
app.config['SECRET_KEY'] = SECRET_KEY
app.config['JSON_SORT_KEYS'] = False
CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})


def now_utc():
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()


def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA foreign_keys = ON')
    return g.db


@app.teardown_appcontext
def close_db(error=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def rows_to_dict(rows):
    return [dict(row) for row in rows]


def create_token(user):
    payload = {
        'sub': user['username'],
        'user_id': user.get('id'),
        'tenant_id': user['tenant_id'],
        'role': user['role'],
        'permissions': get_role_permissions(user['role']),
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    return token


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', None)
        if not auth:
            return jsonify({'message': 'Missing authorization header'}), 401
        parts = auth.split()
        if parts[0].lower() != 'bearer' or len(parts) != 2:
            return jsonify({'message': 'Invalid authorization header'}), 401
        token = parts[1]
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            request.claims = data
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token expired'}), 401
        except Exception:
            return jsonify({'message': 'Invalid token'}), 401
        return f(*args, **kwargs)

    return decorated


# Roles and permissions are stored in the database (roles, permissions, role_permissions)
def get_role_permissions(role_name):
    conn = get_db()
    rows = conn.execute(
        '''
        SELECT p.name
        FROM permissions p
        JOIN role_permissions rp ON rp.permission_id = p.id
        JOIN roles r ON r.id = rp.role_id
        WHERE r.name = ?
        ''', (role_name,)
    ).fetchall()
    return [r['name'] for r in rows]


def get_role_info(role_name):
    conn = get_db()
    row = conn.execute('SELECT name, display_name FROM roles WHERE name = ?', (role_name,)).fetchone()
    if not row:
        return {'name': role_name, 'permissions': []}
    return {'name': row['display_name'] or row['name'], 'permissions': get_role_permissions(role_name)}


def get_all_roles():
    conn = get_db()
    rows = conn.execute('SELECT name, display_name FROM roles ORDER BY id').fetchall()
    result = {}
    for r in rows:
        result[r['name']] = {'name': r['display_name'] or r['name'], 'permissions': get_role_permissions(r['name'])}
    return result


def has_permission(role_name, permission):
    return permission in get_role_permissions(role_name)


def get_current_user():
    claims = getattr(request, 'claims', {})
    return {
        'id': claims.get('user_id'),
        'username': claims.get('sub'),
        'tenant_id': claims.get('tenant_id'),
        'role': claims.get('role')
    }



def require_permission(permission):
    def wrapper(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            claims = getattr(request, 'claims', {})
            if not has_permission(claims.get('role'), permission):
                return jsonify({'message': 'Permission denied'}), 403
            return f(*args, **kwargs)
        return decorated
    return wrapper


def record_audit(conn, action, entity_type, entity_id, details, tenant_id, user_id=None):
    conn.execute(
        '''
        INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''',
        (tenant_id, user_id, action, entity_type, entity_id, details, now_utc())
    )
    conn.commit()


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.executescript(
        '''
        CREATE TABLE IF NOT EXISTS tenants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            display_name TEXT,
            description TEXT
        );

        CREATE TABLE IF NOT EXISTS permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT
        );

        CREATE TABLE IF NOT EXISTS role_permissions (
            role_id INTEGER NOT NULL,
            permission_id INTEGER NOT NULL,
            PRIMARY KEY (role_id, permission_id),
            FOREIGN KEY (role_id) REFERENCES roles(id),
            FOREIGN KEY (permission_id) REFERENCES permissions(id)
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'viewer',
            tenant_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        );

        CREATE TABLE IF NOT EXISTS locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        );

        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            location_id INTEGER,
            name TEXT NOT NULL,
            type TEXT,
            status TEXT NOT NULL DEFAULT 'available',
            created_at TEXT NOT NULL,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (location_id) REFERENCES locations(id)
        );

        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            device_id INTEGER NOT NULL,
            user_id INTEGER,
            alert_type TEXT NOT NULL,
            message TEXT NOT NULL,
            severity TEXT NOT NULL DEFAULT 'medium',
            is_resolved INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            resolved_at TEXT,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (device_id) REFERENCES devices(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            device_id INTEGER NOT NULL,
            metric_type TEXT NOT NULL,
            value REAL NOT NULL,
            unit TEXT,
            recorded_at TEXT NOT NULL,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (device_id) REFERENCES devices(id)
        );

        CREATE TABLE IF NOT EXISTS error_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER,
            user_id INTEGER,
            context TEXT,
            error_message TEXT,
            error_code TEXT,
            payload TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            full_name TEXT NOT NULL,
            dni TEXT NOT NULL,
            date_of_birth TEXT,
            phone TEXT,
            email TEXT,
            sex TEXT,
            blood_type TEXT,
            allergies TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            medical_record_number TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        );

        CREATE TABLE IF NOT EXISTS medical_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            patient_id INTEGER NOT NULL,
            record_type TEXT NOT NULL,
            summary TEXT NOT NULL,
            details TEXT,
            created_by INTEGER,
            created_at TEXT NOT NULL,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (patient_id) REFERENCES patients(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS consultations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            patient_id INTEGER NOT NULL,
            doctor_name TEXT NOT NULL,
            reason TEXT NOT NULL,
            symptoms TEXT,
            diagnosis TEXT,
            treatment TEXT,
            prescription TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (patient_id) REFERENCES patients(id)
        );

        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            patient_id INTEGER NOT NULL,
            doctor_name TEXT NOT NULL,
            specialty TEXT NOT NULL,
            appointment_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'scheduled',
            notes TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (patient_id) REFERENCES patients(id)
        );

        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            patient_id INTEGER NOT NULL,
            document_type TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_url TEXT,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'uploaded',
            created_at TEXT NOT NULL,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (patient_id) REFERENCES patients(id)
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            user_id INTEGER,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id INTEGER,
            details TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        '''
    )

    conn.commit()

    # Seed default permissions and roles (only if absent)
    default_permissions = [
        'manage_users', 'manage_locations', 'manage_devices', 'manage_alerts', 'manage_metrics',
        'manage_patients', 'manage_clinical_history', 'manage_consultations', 'manage_appointments',
        'manage_documents', 'view_reports', 'view_audit', 'view_dashboard'
    ]

    default_roles = {
        'tenant_admin': {
            'display_name': 'Administrador',
            'permissions': default_permissions
        },
        'doctor': {
            'display_name': 'Médico',
            'permissions': ['manage_patients', 'manage_clinical_history', 'manage_consultations', 'manage_documents', 'view_reports', 'view_dashboard']
        },
        'nurse': {
            'display_name': 'Enfermero',
            'permissions': ['manage_patients', 'manage_documents', 'manage_alerts', 'view_dashboard']
        },
        'staff': {
            'display_name': 'Personal Administrativo',
            'permissions': ['manage_patients', 'manage_appointments', 'view_reports', 'view_dashboard']
        },
        'auditor': {
            'display_name': 'Auditor',
            'permissions': ['view_reports', 'view_audit', 'view_dashboard']
        },
        'viewer': {
            'display_name': 'Visualizador',
            'permissions': ['view_dashboard']
        }
    }

    # insert permissions
    for perm in default_permissions:
        c.execute('INSERT OR IGNORE INTO permissions (name) VALUES (?)', (perm,))
    conn.commit()

    # insert roles and role_permissions
    for role_key, info in default_roles.items():
        c.execute('INSERT OR IGNORE INTO roles (name, display_name, description) VALUES (?, ?, ?)', (role_key, info['display_name'], None))
        conn.commit()
        role_id_row = c.execute('SELECT id FROM roles WHERE name = ?', (role_key,)).fetchone()
        if role_id_row:
            role_id = role_id_row[0]
            for perm in info['permissions']:
                perm_row = c.execute('SELECT id FROM permissions WHERE name = ?', (perm,)).fetchone()
                if perm_row:
                    perm_id = perm_row[0]
                    c.execute('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', (role_id, perm_id))
    conn.commit()

    now = now_utc()
    tenant_row = c.execute('SELECT id FROM tenants WHERE name = ?', ('Hospital Demo',)).fetchone()
    if tenant_row is None:
        c.execute('INSERT INTO tenants (name, created_at) VALUES (?, ?)', ('Hospital Demo', now))
        conn.commit()
        tenant_id = c.execute('SELECT id FROM tenants WHERE name = ?', ('Hospital Demo',)).fetchone()[0]
    else:
        tenant_id = tenant_row[0]

    admin = c.execute('SELECT id FROM users WHERE username = ?', ('admin',)).fetchone()
    if admin is None:
        c.execute(
            'INSERT INTO users (username, password, role, tenant_id, created_at) VALUES (?, ?, ?, ?, ?)',
            ('admin', generate_password_hash('Admin123!'), 'tenant_admin', tenant_id, now)
        )
        conn.commit()

    if DEMO_DATA_ENABLED:
        seed_provisional_data(conn, tenant_id, now)

    conn.close()


def seed_provisional_data(conn, tenant_id, now):
    c = conn.cursor()

    location = c.execute('SELECT id FROM locations WHERE tenant_id = ? AND name = ?', (tenant_id, 'Emergency')).fetchone()
    if location is None:
        c.execute('INSERT INTO locations (tenant_id, name, description, created_at) VALUES (?, ?, ?, ?)',
                  (tenant_id, 'Emergency', 'Área de atención aguda y monitoreo continuo', now))
        conn.commit()
        location_id = c.execute('SELECT id FROM locations WHERE tenant_id = ? AND name = ?', (tenant_id, 'Emergency')).fetchone()[0]
    else:
        location_id = location[0]

    device = c.execute('SELECT id FROM devices WHERE tenant_id = ? AND name = ?', (tenant_id, 'Monitor 01')).fetchone()
    if device is None:
        c.execute('INSERT INTO devices (tenant_id, location_id, name, type, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                  (tenant_id, location_id, 'Monitor 01', 'monitor', 'active', now))
        conn.commit()

    admin_user = c.execute('SELECT id FROM users WHERE username = ? AND tenant_id = ?', ('admin', tenant_id)).fetchone()
    admin_id = admin_user[0] if admin_user else None

    demo_patients = [
        ('Ana García', '12345678', '1985-04-14', '999111222', 'ana.garcia@demo.local', 'F', 'O+', 'Penicilina', 'active'),
        ('Luis Pérez', '87654321', '1978-02-10', '999333444', 'luis.perez@demo.local', 'M', 'A+', 'Ninguna', 'active'),
        ('Marta Rojas', '45678912', '1992-09-22', '999555666', 'marta.rojas@demo.local', 'F', 'B+', 'Polen', 'active')
    ]
    for patient_data in demo_patients:
        existing = c.execute('SELECT id FROM patients WHERE tenant_id = ? AND dni = ?', (tenant_id, patient_data[1])).fetchone()
        if existing is None:
            c.execute(
                '''
                INSERT INTO patients (tenant_id, full_name, dni, date_of_birth, phone, email, sex, blood_type, allergies, status, medical_record_number, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (tenant_id, *patient_data, f"HC-{tenant_id:02d}-{(c.execute('SELECT COUNT(*) FROM patients WHERE tenant_id = ?', (tenant_id,)).fetchone()[0] + 1):03d}", now)
            )
            conn.commit()

    patient_rows = c.execute('SELECT id, full_name FROM patients WHERE tenant_id = ? ORDER BY id', (tenant_id,)).fetchall()
    if patient_rows:
        for patient in patient_rows:
            patient_id = patient[0]
            patient_name = patient[1]
            record = c.execute('SELECT id FROM medical_records WHERE tenant_id = ? AND patient_id = ?', (tenant_id, patient_id)).fetchone()
            if record is None:
                c.execute(
                    'INSERT INTO medical_records (tenant_id, patient_id, record_type, summary, details, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    (tenant_id, patient_id, 'initial', f'Historia clínica inicial para {patient_name}', 'Datos provisionales para demostrar el flujo del sistema.', admin_id, now)
                )
        conn.commit()

        for patient in patient_rows[:2]:
            patient_id = patient[0]
            consultation = c.execute('SELECT id FROM consultations WHERE tenant_id = ? AND patient_id = ?', (tenant_id, patient_id)).fetchone()
            if consultation is None:
                c.execute(
                    'INSERT INTO consultations (tenant_id, patient_id, doctor_name, reason, symptoms, diagnosis, treatment, prescription, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    (tenant_id, patient_id, 'Dr. Rivera', 'Control de seguimiento', 'Dolor leve', 'Estado estable', 'Revisión y reposo', 'Paracetamol 500mg', now)
                )
            appointment = c.execute('SELECT id FROM appointments WHERE tenant_id = ? AND patient_id = ?', (tenant_id, patient_id)).fetchone()
            if appointment is None:
                c.execute(
                    'INSERT INTO appointments (tenant_id, patient_id, doctor_name, specialty, appointment_date, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    (tenant_id, patient_id, 'Dra. Mendoza', 'Cardiología', (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).date().isoformat(), 'scheduled', 'Cita provisional para fase de pruebas', now)
                )
            document = c.execute('SELECT id FROM documents WHERE tenant_id = ? AND patient_id = ?', (tenant_id, patient_id)).fetchone()
            if document is None:
                c.execute(
                    'INSERT INTO documents (tenant_id, patient_id, document_type, file_name, file_url, description, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    (tenant_id, patient_id, 'result', f'{patient_name.split()[0].lower()}_exam.pdf', 'https://example.com/provisional-file.pdf', 'Documento provisional cargado para prueba', 'uploaded', now)
                )
        conn.commit()

    if admin_id is not None:
        audit_exists = c.execute('SELECT id FROM audit_logs WHERE tenant_id = ? AND action = ?', (tenant_id, 'seed_demo_data')).fetchone()
        if audit_exists is None:
            c.execute(
                'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                (tenant_id, admin_id, 'seed_demo_data', 'system', 1, 'Datos provisionales cargados para soporte de la demo', now)
            )
            conn.commit()


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'database': DB_PATH, 'demo_data': DEMO_DATA_ENABLED})


@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    requested_role = data.get('role')
    if not username or not password:
        return jsonify({'message': 'username and password required'}), 400

    # By default new registrations get 'viewer'. If the caller provides a role,
    # allow it only if the caller has 'manage_users' permission (i.e., an admin).
    role = 'viewer'
    auth_header = request.headers.get('Authorization')
    if requested_role:
        # verify role exists in DB
        role_exists = get_db().execute('SELECT 1 FROM roles WHERE name = ?', (requested_role,)).fetchone()
        if not role_exists:
            return jsonify({'message': 'invalid role'}), 400
        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == 'bearer':
                token = parts[1]
                try:
                    claims = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
                    caller_role = claims.get('role')
                    if caller_role and has_permission(caller_role, 'manage_users'):
                        role = requested_role
                except Exception:
                    pass

    tenant_id = 1
    password_hash = generate_password_hash(password)
    conn = get_db()
    try:
        conn.execute(
            'INSERT INTO users (username, password, role, tenant_id, created_at) VALUES (?, ?, ?, ?, ?)',
            (username, password_hash, role, tenant_id, now_utc())
        )
        conn.commit()
    except sqlite3.IntegrityError:
        return jsonify({'message': 'user already exists'}), 400

    user_row = conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
    user = {
        'id': user_row['id'],
        'username': username,
        'tenant_id': tenant_id,
        'role': role
    }
    return jsonify({'token': create_token(user), 'username': username, 'role': role})


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'message': 'username and password required'}), 400

    conn = get_db()
    row = conn.execute('SELECT id, password, role, tenant_id FROM users WHERE username = ?', (username,)).fetchone()
    if not row or not check_password_hash(row['password'], password):
        return jsonify({'message': 'invalid credentials'}), 401

    user = {
        'id': row['id'],
        'username': username,
        'tenant_id': row['tenant_id'],
        'role': row['role']
    }
    return jsonify({'token': create_token(user), 'username': username, 'role': row['role']})


@app.route('/api/profile')
@token_required
def profile():
    claims = get_current_user()
    return jsonify({
        'username': claims['username'],
        'role': claims['role'],
        'role_name': get_role_info(claims['role'])['name'],
        'permissions': get_role_info(claims['role'])['permissions'],
        'tenant_id': claims['tenant_id'],
        'bio': 'Plataforma de gestión hospitalaria con datos provisionales para pruebas.'
    })


@app.route('/api/roles')
@token_required
def roles():
    return jsonify(get_all_roles())


@app.route('/api/users', methods=['GET', 'POST'])
@token_required
@require_permission('manage_users')
def users():
    claims = get_current_user()
    conn = get_db()
    if request.method == 'GET':
        rows = conn.execute(
            'SELECT id, username, role, tenant_id, created_at FROM users WHERE tenant_id = ? ORDER BY id DESC',
            (claims['tenant_id'],)
        ).fetchall()
        return jsonify(rows_to_dict(rows))

    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'viewer')
    if not username or not password:
        return jsonify({'message': 'username and password required'}), 400
    # validate role exists in DB
    if not get_db().execute('SELECT 1 FROM roles WHERE name = ?', (role,)).fetchone():
        return jsonify({'message': 'invalid role'}), 400

    try:
        conn.execute(
            'INSERT INTO users (username, password, role, tenant_id, created_at) VALUES (?, ?, ?, ?, ?)',
            (username, generate_password_hash(password), role, claims['tenant_id'], now_utc())
        )
        conn.commit()
    except sqlite3.IntegrityError:
        return jsonify({'message': 'user already exists'}), 400

    record_audit(conn, 'create', 'user', None, f'Created user {username}', claims['tenant_id'], claims.get('id'))
    return jsonify({'message': 'User created'})


@app.route('/api/users/<int:user_id>', methods=['PUT', 'DELETE'])
@token_required
@require_permission('manage_users')
def update_user(user_id):
    claims = get_current_user()
    conn = get_db()
    if request.method == 'DELETE':
        conn.execute('DELETE FROM users WHERE id = ? AND tenant_id = ?', (user_id, claims['tenant_id']))
        conn.commit()
        record_audit(conn, 'delete', 'user', user_id, 'Deleted user', claims['tenant_id'], claims.get('id'))
        return jsonify({'message': 'User deleted'})

    data = request.get_json() or {}
    role = data.get('role')
    if role and not get_db().execute('SELECT 1 FROM roles WHERE name = ?', (role,)).fetchone():
        return jsonify({'message': 'invalid role'}), 400

    if role:
        conn.execute('UPDATE users SET role = ? WHERE id = ? AND tenant_id = ?', (role, user_id, claims['tenant_id']))
    if data.get('password'):
        conn.execute('UPDATE users SET password = ? WHERE id = ? AND tenant_id = ?', (generate_password_hash(data['password']), user_id, claims['tenant_id']))
    conn.commit()
    record_audit(conn, 'update', 'user', user_id, 'Updated user', claims['tenant_id'], claims.get('id'))
    return jsonify({'message': 'User updated'})


@app.route('/api/dashboard')
@token_required
def dashboard():
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    conn = get_db()
    counts = {
        'locations': conn.execute('SELECT COUNT(*) FROM locations WHERE tenant_id = ?', (tenant_id,)).fetchone()[0],
        'devices': conn.execute('SELECT COUNT(*) FROM devices WHERE tenant_id = ?', (tenant_id,)).fetchone()[0],
        'alerts': conn.execute('SELECT COUNT(*) FROM alerts WHERE tenant_id = ?', (tenant_id,)).fetchone()[0],
        'metrics': conn.execute('SELECT COUNT(*) FROM metrics WHERE tenant_id = ?', (tenant_id,)).fetchone()[0],
        'users': conn.execute('SELECT COUNT(*) FROM users WHERE tenant_id = ?', (tenant_id,)).fetchone()[0],
        'patients': conn.execute('SELECT COUNT(*) FROM patients WHERE tenant_id = ?', (tenant_id,)).fetchone()[0],
        'appointments': conn.execute('SELECT COUNT(*) FROM appointments WHERE tenant_id = ?', (tenant_id,)).fetchone()[0],
        'consultations': conn.execute('SELECT COUNT(*) FROM consultations WHERE tenant_id = ?', (tenant_id,)).fetchone()[0],
    }
    return jsonify(counts)


@app.route('/api/locations', methods=['GET', 'POST'])
@token_required
def locations():
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    conn = get_db()
    if request.method == 'GET':
        rows = conn.execute('SELECT id, name, description, created_at FROM locations WHERE tenant_id = ? ORDER BY id DESC', (tenant_id,)).fetchall()
        return jsonify(rows_to_dict(rows))

    if claims['role'] not in ('tenant_admin', 'doctor', 'nurse', 'staff'):
        return jsonify({'message': 'Permission denied'}), 403

    data = request.get_json() or {}
    name = data.get('name')
    description = data.get('description', '')
    if not name:
        return jsonify({'message': 'name required'}), 400

    conn.execute(
        'INSERT INTO locations (tenant_id, name, description, created_at) VALUES (?, ?, ?, ?)',
        (tenant_id, name, description, now_utc())
    )
    conn.commit()
    record_audit(conn, 'create', 'location', None, f'Created location {name}', tenant_id, claims.get('id'))
    return jsonify({'message': 'Location created'})


@app.route('/api/devices', methods=['GET', 'POST'])
@token_required
def devices():
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    conn = get_db()
    if request.method == 'GET':
        rows = conn.execute(
            '''SELECT d.id, d.name, d.type, d.status, d.created_at,
                      l.name AS location_name
               FROM devices d
               LEFT JOIN locations l ON d.location_id = l.id
               WHERE d.tenant_id = ?
               ORDER BY d.id DESC''',
            (tenant_id,)
        ).fetchall()
        return jsonify(rows_to_dict(rows))

    if claims['role'] not in ('tenant_admin', 'doctor', 'nurse', 'staff'):
        return jsonify({'message': 'Permission denied'}), 403

    data = request.get_json() or {}
    name = data.get('name')
    device_type = data.get('type', 'generic')
    status = data.get('status', 'active')
    location_id = data.get('location_id')
    if not name:
        return jsonify({'message': 'name required'}), 400

    if location_id is not None:
        loc = conn.execute('SELECT id FROM locations WHERE id = ? AND tenant_id = ?', (location_id, tenant_id)).fetchone()
        if not loc:
            return jsonify({'message': 'invalid location'}), 400

    conn.execute(
        'INSERT INTO devices (tenant_id, location_id, name, type, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        (tenant_id, location_id, name, device_type, status, now_utc())
    )
    conn.commit()
    record_audit(conn, 'create', 'device', None, f'Created device {name}', tenant_id, claims.get('id'))
    return jsonify({'message': 'Device created'})


@app.route('/api/alerts', methods=['GET', 'POST'])
@token_required
def alerts():
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    conn = get_db()
    if request.method == 'GET':
        rows = conn.execute(
            '''SELECT a.id, a.alert_type, a.message, a.severity, a.is_resolved,
                      a.created_at, a.resolved_at, d.name AS device_name
               FROM alerts a
               LEFT JOIN devices d ON a.device_id = d.id
               WHERE a.tenant_id = ?
               ORDER BY a.id DESC''',
            (tenant_id,)
        ).fetchall()
        return jsonify(rows_to_dict(rows))

    data = request.get_json() or {}
    device_id = data.get('device_id')
    alert_type = data.get('alert_type')
    message = data.get('message')
    severity = data.get('severity', 'medium')
    if not device_id or not alert_type or not message:
        return jsonify({'message': 'device_id, alert_type and message are required'}), 400

    device = conn.execute('SELECT id FROM devices WHERE id = ? AND tenant_id = ?', (device_id, tenant_id)).fetchone()
    if not device:
        return jsonify({'message': 'invalid device'}), 400

    conn.execute(
        'INSERT INTO alerts (tenant_id, device_id, user_id, alert_type, message, severity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (tenant_id, device_id, claims.get('id'), alert_type, message, severity, now_utc())
    )
    conn.commit()
    record_audit(conn, 'create', 'alert', None, f'Created alert {alert_type}', tenant_id, claims.get('id'))
    return jsonify({'message': 'Alert created'})


@app.route('/api/metrics', methods=['GET', 'POST'])
@token_required
def metrics():
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    conn = get_db()
    if request.method == 'GET':
        rows = conn.execute(
            '''SELECT m.id, m.metric_type, m.value, m.unit, m.recorded_at, d.name AS device_name
               FROM metrics m
               LEFT JOIN devices d ON m.device_id = d.id
               WHERE m.tenant_id = ?
               ORDER BY m.recorded_at DESC
               LIMIT 50''',
            (tenant_id,)
        ).fetchall()
        return jsonify(rows_to_dict(rows))

    data = request.get_json() or {}
    device_id = data.get('device_id')
    metric_type = data.get('metric_type')
    value = data.get('value')
    unit = data.get('unit', '')
    if not device_id or metric_type is None or value is None:
        return jsonify({'message': 'device_id, metric_type and value are required'}), 400

    device = conn.execute('SELECT id FROM devices WHERE id = ? AND tenant_id = ?', (device_id, tenant_id)).fetchone()
    if not device:
        return jsonify({'message': 'invalid device'}), 400

    conn.execute(
        'INSERT INTO metrics (tenant_id, device_id, metric_type, value, unit, recorded_at) VALUES (?, ?, ?, ?, ?, ?)',
        (tenant_id, device_id, metric_type, float(value), unit, now_utc())
    )
    conn.commit()
    record_audit(conn, 'create', 'metric', None, f'Created metric {metric_type}', tenant_id, claims.get('id'))
    return jsonify({'message': 'Metric recorded'})


@app.route('/api/patients', methods=['GET', 'POST'])
@token_required
def patients():
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    conn = get_db()
    if request.method == 'GET':
        query = request.args.get('q', '').strip()
        sql = 'SELECT id, full_name, dni, date_of_birth, phone, email, sex, blood_type, allergies, status, medical_record_number, created_at FROM patients WHERE tenant_id = ?'
        params = [tenant_id]
        if query:
            sql += ' AND (full_name LIKE ? OR dni LIKE ? OR email LIKE ?)' 
            pattern = f'%{query}%'
            params.extend([pattern, pattern, pattern])
        sql += ' ORDER BY id DESC'
        rows = conn.execute(sql, params).fetchall()
        return jsonify(rows_to_dict(rows))

    if not has_permission(claims.get('role'), 'manage_patients'):
        return jsonify({'message': 'Permission denied'}), 403

    data = request.get_json() or {}
    full_name = data.get('full_name')
    dni = data.get('dni')
    if not full_name or not dni:
        return jsonify({'message': 'full_name and dni are required'}), 400

    medical_record_number = data.get('medical_record_number') or f"HC-{tenant_id:02d}-{(conn.execute('SELECT COUNT(*) FROM patients WHERE tenant_id = ?', (tenant_id,)).fetchone()[0] + 1):03d}"
    cursor = conn.execute(
        '''
        INSERT INTO patients (tenant_id, full_name, dni, date_of_birth, phone, email, sex, blood_type, allergies, status, medical_record_number, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''',
        (tenant_id, full_name, dni, data.get('date_of_birth'), data.get('phone'), data.get('email'), data.get('sex'), data.get('blood_type'), data.get('allergies'), data.get('status', 'active'), medical_record_number, now_utc())
    )
    conn.commit()
    record_audit(conn, 'create', 'patient', cursor.lastrowid, f'Created patient {full_name}', tenant_id, claims.get('id'))
    return jsonify({'message': 'Patient created', 'id': cursor.lastrowid, 'medical_record_number': medical_record_number})


@app.route('/api/patients/<int:patient_id>')
@token_required
def patient_detail(patient_id):
    claims = get_current_user()
    conn = get_db()
    patient = conn.execute('SELECT * FROM patients WHERE id = ? AND tenant_id = ?', (patient_id, claims['tenant_id'])).fetchone()
    if not patient:
        return jsonify({'message': 'Patient not found'}), 404
    return jsonify(dict(patient))


@app.route('/api/medical-records', methods=['GET', 'POST'])
@token_required
def medical_records():
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    conn = get_db()
    if request.method == 'GET':
        patient_id = request.args.get('patient_id')
        if patient_id:
            rows = conn.execute(
                'SELECT * FROM medical_records WHERE tenant_id = ? AND patient_id = ? ORDER BY id DESC',
                (tenant_id, patient_id)
            ).fetchall()
        else:
            rows = conn.execute('SELECT * FROM medical_records WHERE tenant_id = ? ORDER BY id DESC', (tenant_id,)).fetchall()
        return jsonify(rows_to_dict(rows))

    if not has_permission(claims.get('role'), 'manage_clinical_history'):
        return jsonify({'message': 'Permission denied'}), 403

    data = request.get_json() or {}
    patient_id = data.get('patient_id')
    record_type = data.get('record_type', 'note')
    summary = data.get('summary')
    details = data.get('details', '')
    if not patient_id or not summary:
        return jsonify({'message': 'patient_id and summary are required'}), 400

    patient = conn.execute('SELECT id FROM patients WHERE id = ? AND tenant_id = ?', (patient_id, tenant_id)).fetchone()
    if not patient:
        return jsonify({'message': 'invalid patient'}), 400

    cursor = conn.execute(
        'INSERT INTO medical_records (tenant_id, patient_id, record_type, summary, details, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (tenant_id, patient_id, record_type, summary, details, claims.get('id'), now_utc())
    )
    conn.commit()
    record_audit(conn, 'create', 'medical_record', cursor.lastrowid, summary, tenant_id, claims.get('id'))
    return jsonify({'message': 'Medical record created'})


@app.route('/api/consultations', methods=['GET', 'POST'])
@token_required
def consultations():
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    conn = get_db()
    if request.method == 'GET':
        patient_id = request.args.get('patient_id')
        if patient_id:
            rows = conn.execute('SELECT * FROM consultations WHERE tenant_id = ? AND patient_id = ? ORDER BY id DESC', (tenant_id, patient_id)).fetchall()
        else:
            rows = conn.execute('SELECT * FROM consultations WHERE tenant_id = ? ORDER BY id DESC', (tenant_id,)).fetchall()
        return jsonify(rows_to_dict(rows))

    if not has_permission(claims.get('role'), 'manage_consultations'):
        return jsonify({'message': 'Permission denied'}), 403

    data = request.get_json() or {}
    patient_id = data.get('patient_id')
    reason = data.get('reason')
    if not patient_id or not reason:
        return jsonify({'message': 'patient_id and reason are required'}), 400

    patient = conn.execute('SELECT id FROM patients WHERE id = ? AND tenant_id = ?', (patient_id, tenant_id)).fetchone()
    if not patient:
        return jsonify({'message': 'invalid patient'}), 400

    cursor = conn.execute(
        'INSERT INTO consultations (tenant_id, patient_id, doctor_name, reason, symptoms, diagnosis, treatment, prescription, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (tenant_id, patient_id, data.get('doctor_name', 'Dr. Demo'), reason, data.get('symptoms', ''), data.get('diagnosis', ''), data.get('treatment', ''), data.get('prescription', ''), now_utc())
    )
    conn.commit()
    record_audit(conn, 'create', 'consultation', cursor.lastrowid, reason, tenant_id, claims.get('id'))
    return jsonify({'message': 'Consultation created'})


@app.route('/api/appointments', methods=['GET', 'POST'])
@token_required
def appointments():
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    conn = get_db()
    if request.method == 'GET':
        rows = conn.execute('SELECT * FROM appointments WHERE tenant_id = ? ORDER BY appointment_date ASC', (tenant_id,)).fetchall()
        return jsonify(rows_to_dict(rows))

    if not has_permission(claims.get('role'), 'manage_appointments'):
        return jsonify({'message': 'Permission denied'}), 403

    data = request.get_json() or {}
    patient_id = data.get('patient_id')
    appointment_date = data.get('appointment_date')
    specialty = data.get('specialty', 'General')
    if not patient_id or not appointment_date:
        return jsonify({'message': 'patient_id and appointment_date are required'}), 400

    patient = conn.execute('SELECT id FROM patients WHERE id = ? AND tenant_id = ?', (patient_id, tenant_id)).fetchone()
    if not patient:
        return jsonify({'message': 'invalid patient'}), 400

    cursor = conn.execute(
        'INSERT INTO appointments (tenant_id, patient_id, doctor_name, specialty, appointment_date, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        (tenant_id, patient_id, data.get('doctor_name', 'Dr. Demo'), specialty, appointment_date, data.get('status', 'scheduled'), data.get('notes', ''), now_utc())
    )
    conn.commit()
    record_audit(conn, 'create', 'appointment', cursor.lastrowid, appointment_date, tenant_id, claims.get('id'))
    return jsonify({'message': 'Appointment created'})


@app.route('/api/documents', methods=['GET', 'POST'])
@token_required
def documents():
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    conn = get_db()
    if request.method == 'GET':
        patient_id = request.args.get('patient_id')
        if patient_id:
            rows = conn.execute('SELECT * FROM documents WHERE tenant_id = ? AND patient_id = ? ORDER BY id DESC', (tenant_id, patient_id)).fetchall()
        else:
            rows = conn.execute('SELECT * FROM documents WHERE tenant_id = ? ORDER BY id DESC', (tenant_id,)).fetchall()
        return jsonify(rows_to_dict(rows))

    if not has_permission(claims.get('role'), 'manage_documents'):
        return jsonify({'message': 'Permission denied'}), 403

    data = request.get_json() or {}
    patient_id = data.get('patient_id')
    document_type = data.get('document_type', 'clinical')
    file_name = data.get('file_name')
    if not patient_id or not file_name:
        return jsonify({'message': 'patient_id and file_name are required'}), 400

    patient = conn.execute('SELECT id FROM patients WHERE id = ? AND tenant_id = ?', (patient_id, tenant_id)).fetchone()
    if not patient:
        return jsonify({'message': 'invalid patient'}), 400

    cursor = conn.execute(
        'INSERT INTO documents (tenant_id, patient_id, document_type, file_name, file_url, description, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        (tenant_id, patient_id, document_type, file_name, data.get('file_url') or 'https://example.com/provisional-document', data.get('description', ''), data.get('status', 'uploaded'), now_utc())
    )
    conn.commit()
    record_audit(conn, 'create', 'document', cursor.lastrowid, file_name, tenant_id, claims.get('id'))
    return jsonify({'message': 'Document created'})


@app.route('/api/audit-logs')
@token_required
def audit_logs():
    claims = get_current_user()
    if not has_permission(claims.get('role'), 'view_audit'):
        return jsonify({'message': 'Permission denied'}), 403
    conn = get_db()
    rows = conn.execute('SELECT * FROM audit_logs WHERE tenant_id = ? ORDER BY id DESC LIMIT 50', (claims['tenant_id'],)).fetchall()
    return jsonify(rows_to_dict(rows))


@app.route('/api/reports')
@token_required
def reports():
    claims = get_current_user()
    if not has_permission(claims.get('role'), 'view_reports'):
        return jsonify({'message': 'Permission denied'}), 403
    tenant_id = claims['tenant_id']
    conn = get_db()
    summary = {
        'patients': conn.execute('SELECT COUNT(*) FROM patients WHERE tenant_id = ?', (tenant_id,)).fetchone()[0],
        'consultations': conn.execute('SELECT COUNT(*) FROM consultations WHERE tenant_id = ?', (tenant_id,)).fetchone()[0],
        'appointments': conn.execute('SELECT COUNT(*) FROM appointments WHERE tenant_id = ?', (tenant_id,)).fetchone()[0],
        'documents': conn.execute('SELECT COUNT(*) FROM documents WHERE tenant_id = ?', (tenant_id,)).fetchone()[0],
        'active_alerts': conn.execute('SELECT COUNT(*) FROM alerts WHERE tenant_id = ? AND is_resolved = 0', (tenant_id,)).fetchone()[0],
    }
    recent_consultations = conn.execute('SELECT * FROM consultations WHERE tenant_id = ? ORDER BY id DESC LIMIT 5', (tenant_id,)).fetchall()
    return jsonify({'summary': summary, 'recent_consultations': rows_to_dict(recent_consultations)})


@app.route('/')
def index():
    dist_dir = os.path.join(FRONTEND_DIR, 'dist')
    if os.path.isdir(dist_dir):
        return send_from_directory(dist_dir, 'index.html')
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/<path:path>')
def static_proxy(path):
    dist_dir = os.path.join(FRONTEND_DIR, 'dist')
    if os.path.isdir(dist_dir):
        candidate = os.path.join(dist_dir, path)
        if os.path.exists(candidate):
            return send_from_directory(dist_dir, path)
        return send_from_directory(dist_dir, 'index.html')

    candidate = os.path.join(FRONTEND_DIR, path)
    if os.path.exists(candidate):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, 'index.html')


# Ensure DB is initialized when the module is imported (useful for tests and imports)
init_db()

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
