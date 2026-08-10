import os
import datetime
from datetime import timezone
from functools import wraps
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import jwt
import psycopg2
from psycopg2.extras import RealDictCursor
from werkzeug.security import generate_password_hash, check_password_hash

# 1. Cargar variables de entorno (Búsqueda en backend y en la raíz)
CURRENT_DIR = Path(__file__).resolve().parent
PARENT_DIR = CURRENT_DIR.parent

env_loaded = False
for env_path in [CURRENT_DIR / '.env', PARENT_DIR / '.env', Path('.env')]:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=True)
        print(f"[OK] Archivo .env cargado exitosamente desde: {env_path}")
        env_loaded = True
        break

if not env_loaded:
    print("[WARN] No se encontró ningún archivo .env. Asegúrate de configurar las variables de entorno.")

# 2. Obtener y validar variables
SUPABASE_DB_URL = os.getenv('SUPABASE_DB_URL') or os.getenv('DATABASE_URL')
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
]
DEMO_DATA_ENABLED = os.getenv('DEMO_DATA_ENABLED', 'true').lower() in {'1', 'true', 'yes', 'on'}

if not SUPABASE_DB_URL:
    raise ValueError("No se encontró la variable SUPABASE_DB_URL ni DATABASE_URL en el archivo .env")

# 3. Inicialización de Flask y SQLAlchemy
app = Flask(__name__)
app.config['SECRET_KEY'] = SECRET_KEY
app.config['SQLALCHEMY_DATABASE_URI'] = SUPABASE_DB_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JSON_SORT_KEYS'] = False

CORS(app,
     resources={r"/api/*": {"origins": "*"}},  # Permite orígenes en entorno de desarrollo local
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'],
     expose_headers=['Authorization'])

db = SQLAlchemy(app)


# 4. Modelos de Base de Datos (SQLAlchemy)
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String, unique=True, nullable=False)
    password = db.Column(db.String, nullable=False)
    role = db.Column(db.String, default='viewer', nullable=False)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.datetime.now(timezone.utc))

class Tenant(db.Model):
    __tablename__ = 'tenants'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.datetime.now(timezone.utc))


# 5. Funciones auxiliares
def now_utc():
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()

def get_db():
    """Conecta directamente a PostgreSQL vía psycopg2 utilizando la URL parseada."""
    if 'db' not in g:
        g.db = psycopg2.connect(SUPABASE_DB_URL, cursor_factory=RealDictCursor)
    return g.db

@app.teardown_appcontext
def close_db(error=None):
    db_conn = g.pop('db', None)
    if db_conn is not None:
        db_conn.close()

def db_query(query, params=(), commit=False, fetchone=False, fetchall=False):
    conn = get_db()
    with conn.cursor() as cur:
        try:
            cur.execute(query, params)
            result = None
            if fetchone:
                row = cur.fetchone()
                result = dict(row) if row else None
            elif fetchall:
                result = [dict(row) for row in cur.fetchall()]
            
            if commit:
                conn.commit()
            return result
        except Exception as e:
            conn.rollback()
            raise e

def create_token(user):
    payload = {
        'sub': user['username'],
        'user_id': user.get('id'),
        'tenant_id': user['tenant_id'],
        'role': user['role'],
        'permissions': get_role_permissions(user['role']),
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

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

def get_role_permissions(role_name):
    try:
        rows = db_query(
            '''
            SELECT p.name
            FROM permissions p
            JOIN role_permissions rp ON rp.permission_id = p.id
            JOIN roles r ON r.id = rp.role_id
            WHERE r.name = %s
            ''', (role_name,), fetchall=True
        )
        return [r['name'] for r in rows] if rows else []
    except Exception:
        return []

def get_role_info(role_name):
    try:
        row = db_query('SELECT name, display_name FROM roles WHERE name = %s', (role_name,), fetchone=True)
        if not row:
            return {'name': role_name, 'permissions': []}
        return {'name': row['display_name'] or row['name'], 'permissions': get_role_permissions(role_name)}
    except Exception:
        return {'name': role_name, 'permissions': []}

def get_all_roles():
    try:
        rows = db_query(
            '''
            SELECT r.name AS role_name, r.display_name, p.name AS perm_name
            FROM roles r
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            ORDER BY r.id
            ''', fetchall=True
        )
        result = {}
        for r in rows:
            role_key = r['role_name']
            if role_key not in result:
                result[role_key] = {
                    'name': r['display_name'] or role_key,
                    'permissions': []
                }
            if r['perm_name']:
                result[role_key]['permissions'].append(r['perm_name'])
        return result
    except Exception:
        return {}

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

def record_audit(action, entity_type, entity_id, details, tenant_id, user_id=None):
    try:
        db_query(
            '''
            INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ''',
            (tenant_id, user_id, action, entity_type, entity_id, details, now_utc()), commit=True
        )
    except Exception as e:
        print(f"[AUDIT LOG WARNING]: No se pudo registrar auditoría: {str(e)}")


# 6. Endpoints de la API
@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'database': 'Supabase PostgreSQL', 'demo_data': DEMO_DATA_ENABLED})

@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json() or {}
        username = data.get('username')
        password = data.get('password')
        tenant_id = data.get('tenant_id')

        if not username or not password:
            return jsonify({'message': 'username and password required'}), 400

        if User.query.filter_by(username=username).first():
            return jsonify({'message': 'user already exists'}), 400

        if not tenant_id:
            default_tenant = Tenant.query.first()
            if not default_tenant:
                default_tenant = Tenant(name="Hospital Central", created_at=datetime.datetime.now(timezone.utc))
                db.session.add(default_tenant)
                db.session.flush()
            tenant_id = default_tenant.id

        hashed_password = generate_password_hash(password)

        new_user = User(
            username=username,
            password=hashed_password,
            role=data.get('role', 'viewer'),
            tenant_id=tenant_id,
            created_at=datetime.datetime.now(timezone.utc)
        )

        db.session.add(new_user)
        db.session.commit()

        user_dict = {
            'id': new_user.id,
            'username': new_user.username,
            'tenant_id': new_user.tenant_id,
            'role': new_user.role
        }

        return jsonify({
            'token': create_token(user_dict),
            'username': new_user.username,
            'role': new_user.role,
            'tenant_id': new_user.tenant_id
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"[REGISTER ERROR]: {str(e)}")
        return jsonify({'message': f'Internal server error: {str(e)}'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json() or {}
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'message': 'username and password required'}), 400

        # Autenticación mediante SQLAlchemy (evita fallos de conexión manual)
        user = User.query.filter_by(username=username).first()

        if not user or not check_password_hash(user.password, password):
            return jsonify({'message': 'invalid credentials'}), 401

        user_dict = {
            'id': user.id,
            'username': user.username,
            'tenant_id': user.tenant_id,
            'role': user.role
        }

        token = create_token(user_dict)

        return jsonify({
            'token': token,
            'username': user.username,
            'role': user.role
        }), 200

    except Exception as e:
        print(f"[LOGIN ERROR]: {str(e)}")
        return jsonify({'message': f'Internal server error: {str(e)}'}), 500

@app.route('/api/auth/verify', methods=['GET'])
def auth_verify():
    auth_header = request.headers.get('Authorization', None)
    token = None

    if auth_header:
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() == 'bearer':
            token = parts[1]

    if not token:
        token = request.cookies.get('token')

    if not token:
        return jsonify({'authenticated': False, 'message': 'Missing authentication token'}), 401

    try:
        claims = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        user = {
            'id': claims.get('user_id'),
            'username': claims.get('sub'),
            'tenant_id': claims.get('tenant_id'),
            'role': claims.get('role'),
            'permissions': claims.get('permissions', [])
        }
        return jsonify({'authenticated': True, 'user': user}), 200
    except jwt.ExpiredSignatureError:
        return jsonify({'authenticated': False, 'message': 'Token expired'}), 401
    except Exception:
        return jsonify({'authenticated': False, 'message': 'Invalid token'}), 401
    

@app.route('/api/profile')
@token_required
def profile():
    claims = get_current_user()
    role_info = get_role_info(claims['role'])
    return jsonify({
        'username': claims['username'],
        'role': claims['role'],
        'role_name': role_info['name'],
        'permissions': role_info['permissions'],
        'tenant_id': claims['tenant_id'],
        'bio': 'Plataforma de gestión hospitalaria (Supabase).'
    })

@app.route('/api/roles')
@token_required
def roles():
    return jsonify(get_all_roles())

@app.route('/api/patients', methods=['GET', 'POST', 'DELETE'])
@token_required
def patients():
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    
    if request.method == 'GET':
        query = request.args.get('q', '').strip()
        sql = 'SELECT id, full_name, dni, date_of_birth, phone, email, sex, blood_type, allergies, status, medical_record_number, created_at FROM patients WHERE tenant_id = %s'
        params = [tenant_id]
        if query:
            sql += ' AND (LOWER(full_name) LIKE LOWER(%s) OR dni LIKE %s OR email LIKE %s)' 
            pattern = f'%{query}%'
            params.extend([pattern, pattern, pattern])
        sql += ' ORDER BY id DESC'
        
        rows = db_query(sql, tuple(params), fetchall=True)
        return jsonify(rows or [])

    if request.method == 'DELETE':
        if not has_permission(claims.get('role'), 'manage_patients'):
            return jsonify({'message': 'Permission denied'}), 403
        data = request.get_json() or {}
        patient_id = data.get('patient_id')
        if not patient_id:
            return jsonify({'message': 'patient_id is required'}), 400

        deleted = db_query(
            'DELETE FROM patients WHERE id = %s AND tenant_id = %s RETURNING id',
            (patient_id, tenant_id), commit=True, fetchone=True
        )
        if not deleted:
            return jsonify({'message': 'invalid patient'}), 400

        record_audit('delete', 'patient', deleted['id'], f'Deleted patient {deleted["id"]}', tenant_id, claims.get('id'))
        return jsonify({'message': 'Patient deleted'})

    if not has_permission(claims.get('role'), 'manage_patients'):
        return jsonify({'message': 'Permission denied'}), 403

    data = request.get_json() or {}
    full_name = data.get('full_name')
    dni = data.get('dni')
    if not full_name or not dni:
        return jsonify({'message': 'full_name and dni are required'}), 400

    existing_patient = db_query('SELECT id FROM patients WHERE tenant_id = %s AND dni = %s', (tenant_id, dni), fetchone=True)
    if existing_patient:
        return jsonify({'message': 'Un paciente con ese DNI ya existe'}), 400

    count_row = db_query('SELECT COUNT(*) as count FROM patients WHERE tenant_id = %s', (tenant_id,), fetchone=True)
    count_val = count_row['count'] if count_row else 0
    medical_record_number = data.get('medical_record_number') or f"HC-{tenant_id:02d}-{(count_val + 1):03d}"
    
    new_patient = db_query(
        '''
        INSERT INTO patients (tenant_id, full_name, dni, date_of_birth, phone, email, sex, blood_type, allergies, status, medical_record_number, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        ''',
        (tenant_id, full_name, dni, data.get('date_of_birth'), data.get('phone'), data.get('email'), data.get('sex'), data.get('blood_type'), data.get('allergies'), data.get('status', 'active'), medical_record_number, now_utc()),
        commit=True, fetchone=True
    )
    
    record_audit('create', 'patient', new_patient['id'], f'Created patient {full_name}', tenant_id, claims.get('id'))
    return jsonify({'message': 'Patient created', 'id': new_patient['id'], 'medical_record_number': medical_record_number})

@app.route('/api/appointments', methods=['GET', 'POST'])
@token_required
def appointments():
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    
    if request.method == 'GET':
        rows = db_query('SELECT * FROM appointments WHERE tenant_id = %s ORDER BY appointment_date ASC', (tenant_id,), fetchall=True)
        return jsonify(rows or [])

    if not has_permission(claims.get('role'), 'manage_appointments'):
        return jsonify({'message': 'Permission denied'}), 403

    data = request.get_json() or {}
    patient_id = data.get('patient_id')
    appointment_date = data.get('appointment_date')
    specialty = data.get('specialty', 'General')
    
    if not patient_id or not appointment_date:
        return jsonify({'message': 'patient_id and appointment_date are required'}), 400

    patient = db_query('SELECT id FROM patients WHERE id = %s AND tenant_id = %s', (patient_id, tenant_id), fetchone=True)
    if not patient:
        return jsonify({'message': 'invalid patient'}), 400

    new_appointment = db_query(
        'INSERT INTO appointments (tenant_id, patient_id, doctor_name, specialty, appointment_date, status, notes, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id',
        (tenant_id, patient_id, data.get('doctor_name', 'Dr. Demo'), specialty, appointment_date, data.get('status', 'scheduled'), data.get('notes', ''), now_utc()),
        commit=True, fetchone=True
    )
    
    record_audit('create', 'appointment', new_appointment['id'], appointment_date, tenant_id, claims.get('id'))
    return jsonify({'message': 'Appointment created'})

@app.route('/api/dashboard')
@token_required
def dashboard():
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    
    counts = {
        'locations': (db_query('SELECT COUNT(*) as count FROM locations WHERE tenant_id = %s', (tenant_id,), fetchone=True) or {}).get('count', 0),
        'devices': (db_query('SELECT COUNT(*) as count FROM devices WHERE tenant_id = %s', (tenant_id,), fetchone=True) or {}).get('count', 0),
        'alerts': (db_query('SELECT COUNT(*) as count FROM alerts WHERE tenant_id = %s', (tenant_id,), fetchone=True) or {}).get('count', 0),
        'patients': (db_query('SELECT COUNT(*) as count FROM patients WHERE tenant_id = %s', (tenant_id,), fetchone=True) or {}).get('count', 0),
    }
    return jsonify(counts)

@app.route('/')
def index():
    dist_dir = os.path.join(FRONTEND_DIR, 'dist')
    if os.path.isdir(dist_dir):
        return send_from_directory(dist_dir, 'index.html')
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    if path.startswith('api/'):
        return jsonify({'message': 'Endpoint not found'}), 404

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

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)