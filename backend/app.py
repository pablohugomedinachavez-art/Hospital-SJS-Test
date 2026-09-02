import os
import datetime
import time
from datetime import timezone
from supabase import create_client, Client
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
import csv
from io import StringIO
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
import io
import pandas as pd
from flask import send_file
import openpyxl
from openpyxl.chart import BarChart, Reference
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

# 1. Cargar variables de entorno (Búsqueda en backend y en la raíz)


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

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
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')

if not SUPABASE_DB_URL:
    raise ValueError("No se encontró SUPABASE_DB_URL en el archivo .env")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Faltan SUPABASE_URL o SUPABASE_KEY para inicializar el cliente de Supabase")

# 3. Inicialización de Flask y SQLAlchemy

app.config['SECRET_KEY'] = SECRET_KEY
app.config['SQLALCHEMY_DATABASE_URI'] = SUPABASE_DB_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JSON_SORT_KEYS'] = False

CORS(app,
     resources={r"/api/*": {"origins": "*"}},  
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'],
     expose_headers=['Authorization'])

db = SQLAlchemy(app)
# ==========================================
# 4. Modelos de Base de Datos (SQLAlchemy)
# ==========================================
class Tenant(db.Model):
    __tablename__ = 'tenants'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.datetime.now(timezone.utc))

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String, unique=True, nullable=False)
    password = db.Column(db.String, nullable=False)
    role = db.Column(db.String, default='viewer', nullable=False)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.datetime.now(timezone.utc))


# Inicializa el cliente de Supabase
SUPABASE_URL = "https://ncvqppiqvmfaorzitvpt.supabase.co"
# Usa el token JWT clásico (eyJ...) en lugar de la llave sb_secret_...
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jdnFwcGlxdm1mYW9yeml0dnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODI1MTksImV4cCI6MjA5OTg1ODUxOX0.oDAydesqnzPNrK9-YNQlg5nJxGt4K3aLJHnr4KK6cy4" 


# Inicialización correcta y limpia para el servidor Flask
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


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

def parse_device_type(user_agent_str):
    ua = user_agent_str.lower()
    if 'mobi' in ua or 'android' in ua and 'mobile' in ua or 'iphone' in ua:
        return 'mobile'
    elif 'ipad' in ua or 'tablet' in ua:
        return 'tablet'
    elif 'macintosh' in ua or 'windows' in ua or 'linux' in ua:
        # Distinguir portátil de escritorio si es posible, por defecto PC o laptop
        if 'laptop' in ua or 'book' in ua:
            return 'laptop'
        return 'pc'
    return 'other'

def register_client_device(db_connection, tenant_id, user_id, location_id=None):
    user_agent = request.headers.get('User-Agent', '')
    ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
    device_type = parse_device_type(user_agent)
    device_name = f"{device_type.upper()} - {ip_address}"
    created_at = datetime.now(timezone.utc)
    
    cursor = db_connection.cursor()
    
    # Verificar si el dispositivo ya existe para esta IP y tenant para evitar duplicados
    cursor.execute(
        """
        SELECT id FROM public.devices 
        WHERE tenant_id = %s AND ip_address = %s AND user_agent = %s
        """,
        (tenant_id, ip_address, user_agent)
    )
    existing = cursor.fetchone()
    
    if existing:
        device_id = existing[0]
        # Opcional: actualizar última actividad o estado
    else:
        cursor.execute(
            """
            INSERT INTO public.devices 
            (tenant_id, location_id, name, type, status, created_at, ip_address, user_agent)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (tenant_id, location_id, device_name, device_type, 'active', created_at, ip_address, user_agent)
        )
        device_id = cursor.fetchone()[0]
        db_connection.commit()
        
    return device_id

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


def get_user_columns():
    try:
        rows = db_query(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'users'
            """,
            fetchall=True
        ) or []
        return {row['column_name'] for row in rows}
    except Exception:
        return set()


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
        if request.method == 'OPTIONS':
            return '', 200
        auth = request.headers.get('Authorization', None)
        if not auth:
            return jsonify({'message': 'Missing authorization header'}), 401
        parts = auth.split()
        if parts[0].lower() != 'bearer' or len(parts) != 2:
            return jsonify({'message': 'Invalid authorization header'}), 401
        try:
            # CAMBIO CRÍTICO: Usar app.config en lugar de current_app para garantizar la misma clave exacta
            data = jwt.decode(parts[1], app.config['SECRET_KEY'], algorithms=['HS256'])
            request.claims = data
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token expired'}), 401
        except Exception:
            return jsonify({'message': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated


def get_client_ip():
    x_forwarded = request.headers.get('X-Forwarded-For')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.remote_addr or '127.0.0.1'

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

    # Also attempt to record the action tied to the originating session / IP
    try:
        ip_addr = request.headers.get('X-Forwarded-For', request.remote_addr)
        user_agent = request.headers.get('User-Agent', '')
        # Insert into device_actions for tracking by IP/session
        db_query(
            '''
            INSERT INTO device_actions (tenant_id, session_id, user_id, ip_address, user_agent, action_type, entity_type, entity_id, details, created_at)
            VALUES (%s, NULL, %s, %s, %s, %s, %s, %s, %s, %s)
            ''',
            (tenant_id, user_id, ip_addr, user_agent, action, entity_type, entity_id, details, now_utc()), commit=True
        )
    except Exception as e:
        print(f"[DEVICE ACTION WARNING]: No se pudo registrar la acción del dispositivo: {str(e)}")


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

        # Record session for this login (IP and user-agent)
        try:
            ip_addr = request.headers.get('X-Forwarded-For', request.remote_addr)
            user_agent = request.headers.get('User-Agent', '')
            session_row = db_query(
                '''
                INSERT INTO sessions (tenant_id, user_id, ip_address, user_agent, created_at, last_seen)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
                ''',
                (user_dict['tenant_id'], user_dict['id'], ip_addr, user_agent, now_utc(), now_utc()), commit=True, fetchone=True
            )
            # Optionally include session id in token or logs (not modifying token now)
        except Exception as e:
            print(f"[SESSION WARNING]: No se pudo crear el registro de sesión: {str(e)}")

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

    # Add counts for common entities
    tenant_id = claims['tenant_id']
    patients_count = (db_query('SELECT COUNT(*) as count FROM patients WHERE tenant_id = %s', (tenant_id,), fetchone=True) or {}).get('count', 0)
    consultations_count = (db_query('SELECT COUNT(*) as count FROM consultations WHERE tenant_id = %s', (tenant_id,), fetchone=True) or {}).get('count', 0)
    appointments_count = (db_query('SELECT COUNT(*) as count FROM appointments WHERE tenant_id = %s', (tenant_id,), fetchone=True) or {}).get('count', 0)
    documents_count = (db_query('SELECT COUNT(*) as count FROM documents WHERE tenant_id = %s', (tenant_id,), fetchone=True) or {}).get('count', 0)

    # Fetch user created_at from users table
    user_row = db_query('SELECT id, username, role, created_at FROM users WHERE id = %s AND tenant_id = %s', (claims.get('id'), tenant_id), fetchone=True) or {}

    return jsonify({
        'username': claims['username'],
        'role': claims['role'],
        'role_name': role_info['name'],
        'permissions': role_info['permissions'],
        'tenant_id': claims['tenant_id'],
        'bio': 'Plataforma de gestión hospitalaria (Supabase).',
        'created_at': user_row.get('created_at'),
        'counts': {
            'patients': patients_count,
            'consultations': consultations_count,
            'appointments': appointments_count,
            'documents': documents_count
        }
    })


@app.route('/api/profile/change_password', methods=['POST'])
@token_required
def change_own_password():
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    data = request.get_json() or {}
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    if not old_password or not new_password:
        return jsonify({'message': 'old_password and new_password required'}), 400

    user = db_query('SELECT id, password FROM users WHERE id = %s AND tenant_id = %s', (claims.get('id'), tenant_id), fetchone=True)
    if not user:
        return jsonify({'message': 'user not found'}), 404

    from werkzeug.security import check_password_hash
    if not check_password_hash(user['password'], old_password):
        return jsonify({'message': 'old password incorrect'}), 401

    hashed = generate_password_hash(new_password)
    db_query('UPDATE users SET password = %s WHERE id = %s AND tenant_id = %s', (hashed, user['id'], tenant_id), commit=True)
    record_audit('update', 'user', user['id'], 'User changed own password', tenant_id, user['id'])
    return jsonify({'message': 'Password updated'})

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
@app.route('/api/appointments/<int:appointment_id>', methods=['PUT', 'DELETE'])
@token_required
def appointments(appointment_id=None):
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    
    # Listar citas
    if request.method == 'GET':
        rows = db_query('SELECT * FROM appointments WHERE tenant_id = %s ORDER BY appointment_date ASC', (tenant_id,), fetchall=True)
        return jsonify(rows or [])

    # Verificar permisos para modificaciones
    if not has_permission(claims.get('role'), 'manage_appointments'):
        return jsonify({'message': 'Permission denied'}), 403

    # Crear nueva cita (POST)
    if request.method == 'POST':
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

    # Validar existencia de la cita para PUT / DELETE
    if appointment_id:
        existing = db_query('SELECT id FROM appointments WHERE id = %s AND tenant_id = %s', (appointment_id, tenant_id), fetchone=True)
        if not existing:
            return jsonify({'message': 'Appointment not found'}), 404

    # Actualizar cita (PUT)
    if request.method == 'PUT':
        data = request.get_json() or {}
        db_query(
            'UPDATE appointments SET doctor_name = %s, specialty = %s, appointment_date = %s, end_time = %s, notes = %s WHERE id = %s AND tenant_id = %s',
            (data.get('doctor_name'), data.get('specialty'), data.get('appointment_date'), data.get('end_time'), data.get('notes'), appointment_id, tenant_id),
            commit=True
        )
        record_audit('update', 'appointment', appointment_id, data.get('appointment_date'), tenant_id, claims.get('id'))
        return jsonify({'message': 'Appointment updated'})

    # Eliminar cita (DELETE)
    if request.method == 'DELETE':
        db_query('DELETE FROM appointments WHERE id = %s AND tenant_id = %s', (appointment_id, tenant_id), commit=True)
        record_audit('delete', 'appointment', appointment_id, None, tenant_id, claims.get('id'))
        return jsonify({'message': 'Appointment deleted'})

# ==========================================
# ENDPOINT: CONSULTAS CON FILTROS DE BÚSQUEDA
# ==========================================
@app.route('/api/consultations', methods=['GET', 'POST'])
@token_required
def consultations_handler():
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    user_id = claims.get('id')

    # 1. OBTENER CONSULTAS CON FILTROS (GET)
    if request.method == 'GET':
        # Capturar parámetros de la URL
        search_query = request.args.get('q', '').strip()       # Búsqueda general (Nombre, diagnóstico, motivo)
        doctor = request.args.get('doctor', '').strip()         # Filtro por médico
        start_date = request.args.get('start_date', '').strip() # Fecha inicio (YYYY-MM-DD)
        end_date = request.args.get('end_date', '').strip()     # Fecha fin (YYYY-MM-DD)

        # Base del SQL
        sql = '''
            SELECT c.id, c.patient_id, p.full_name as patient_name, c.doctor_name, 
                   c.reason, c.symptoms, c.diagnosis, c.treatment, c.prescription, 
                   c.triage_id, t.weight_kg, t.height_cm, t.blood_pressure, t.bmi, 
                   t.abdominal_perimeter_cm, c.created_at
            FROM consultations c
            LEFT JOIN patients p ON p.id = c.patient_id
            LEFT JOIN triages t ON t.id = c.triage_id
            WHERE c.tenant_id = %s
        '''
        params = [tenant_id]

        # Aplicar filtro de búsqueda general por texto
        if search_query:
            sql += ''' AND (
                p.full_name ILIKE %s OR 
                c.diagnosis ILIKE %s OR 
                c.reason ILIKE %s OR 
                c.symptoms ILIKE %s
            )'''
            term = f"%{search_query}%"
            params.extend([term, term, term, term])

        # Aplicar filtro por médico
        if doctor:
            sql += ' AND c.doctor_name ILIKE %s'
            params.append(f"%{doctor}%")

        # Aplicar filtro por rango de fechas
        if start_date:
            sql += ' AND c.created_at >= %s'
            params.append(start_date)

        if end_date:
            sql += ' AND c.created_at <= %s'
            params.append(f"{end_date} 23:59:59")

        sql += ' ORDER BY c.id DESC'

        rows = db_query(sql, tuple(params), fetchall=True)
        return jsonify(rows or []), 200

    # 2. CREAR CONSULTA (POST)
    # ... (Se mantiene igual a tu código previo)


# ==========================================
# ENDPOINT: SUBIR DOCUMENTO Y VINCULAR PACIENTE
# ==========================================
@app.route('/api/documents/upload-supabase', methods=['POST', 'OPTIONS'])
@token_required
def upload_supabase_document():
    if request.method == 'OPTIONS':
        return '', 200

    claims = get_current_user()
    tenant_id = claims['tenant_id']

    if not has_permission(claims.get('role'), 'manage_patients'):
        return jsonify({'message': 'Permission denied'}), 403

    patient_id = request.form.get('patient_id')
    document_type = request.form.get('document_type', 'evolución')
    template_id = request.form.get('template_id')
    description = request.form.get('description', '')
    dynamic_values_str = request.form.get('dynamicValues', '{}')

    if not patient_id or not template_id:
        return jsonify({'message': 'patient_id y template_id son obligatorios'}), 400

    try:
        import json
        import io
        from reportlab.lib.pagesizes import A4  # <--- Cambiado a A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors

       # 1. Obtener la plantilla de la base de datos
        template_res = db_query(
            "SELECT nombre, structure FROM templates_formulario WHERE id = %s",
            (template_id,),
            fetchone=True
        )
        
        if not template_res:
            return jsonify({'message': 'Plantilla no encontrada'}), 404

        template_name = template_res.get('nombre', 'Documento Clínico')
        structure = template_res.get('structure', [])
        dynamic_values = json.loads(dynamic_values_str)

        # 2. Generar el PDF en memoria usando A4 y márgenes seguros de 36 pt (0.5 pulgadas)
        # A4 dimensiones: 595.27 x 841.89 pt. Ancho útil = 595.27 - 72 = 523.27 pt
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        ancho_util = A4[0] - 72  # ~523.27 puntos disponibles para contenido

        story = []
        styles = getSampleStyleSheet()
        
        # Título
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=16,
            textColor=colors.HexColor('#0f172a'),
            spaceAfter=15
        )
        story.append(Paragraph(f"<b>{template_name}</b>", title_style))
        story.append(Paragraph(f"<b>ID de Paciente:</b> {patient_id} | <b>Tipo:</b> {document_type}", styles['Normal']))
        story.append(Spacer(1, 15))

        # 3. Construcción dinámica de tablas por cada fila del template adaptadas al ancho A4
        if isinstance(structure, list):
            for rIdx, row in enumerate(structure):
                row_cells = []
                num_cols = len(row) if len(row) > 0 else 1
                ancho_por_columna = ancho_util / num_cols
                col_widths = [ancho_por_columna] * num_cols

                for cIdx, cell in enumerate(row):
                    cell_key = f"{rIdx}-{cIdx}"
                    val = dynamic_values.get(cell_key, cell.get('nombre_campo', ''))
                    field_label = cell.get('nombre_campo', 'Campo')
                    cell_text = f"<b>{field_label}:</b><br/>{val}"
                    row_cells.append(Paragraph(cell_text, styles['Normal']))
                
                if row_cells:
                    t = Table([row_cells], colWidths=col_widths)
                    t.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
                        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1e293b')),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                        ('TOPPADDING', (0, 0), (-1, -1), 8),
                        ('LEFTPADDING', (0, 0), (-1, -1), 10),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1'))
                    ]))
                    story.append(t)
                    story.append(Spacer(1, 6)) # Espaciado limpio entre filas del grid

        doc.build(story)
        file_bytes = buffer.getvalue()
        buffer.close()

        # 3. Subir el PDF binario a Supabase Storage
        filename = f"doc_{patient_id}_{int(time.time())}.pdf"
        storage_path = f"tenant_{tenant_id}/patient_{patient_id}/{filename}"
        bucket_name = "documents" # Cambia por el nombre real de tu bucket si es distinto
        
        supabase.storage.from_(bucket_name).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": "application/pdf", "x-upsert": "true"}
        )

        # 4. Obtener URL pública de forma segura
        public_url_response = supabase.storage.from_(bucket_name).get_public_url(storage_path)
        if isinstance(public_url_response, str):
            file_url = public_url_response
        elif isinstance(public_url_response, dict):
            file_url = public_url_response.get('publicUrl') or public_url_response.get('data', {}).get('publicUrl')
        else:
            file_url = getattr(public_url_response, 'public_url', str(public_url_response))

        # 5. Insertar el registro en la base de datos (con la variable correctamente definida)
        new_doc = db_query(
            '''
            INSERT INTO documents (
                tenant_id, patient_id, document_type, file_name, 
                file_url, description, status, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            ''',
            (
                int(tenant_id), int(patient_id), document_type, filename, 
                file_url, description, 'active', now_utc()
            ),
            commit=True,
            fetchone=True
        )

        if not new_doc or 'id' not in new_doc:
            raise Exception("No se pudo registrar el documento en la base de datos.")

        record_audit('create', 'document', new_doc['id'], f'Generated PDF template {template_id}', tenant_id, claims.get('id'))

        return jsonify({
            'message': 'Documento PDF generado y registrado con éxito',
            'id': new_doc['id'],
            'file_url': file_url
        }), 201

    except Exception as e:
        print(f"--- ERROR AL GENERAR/SUBIR PDF A SUPABASE: {str(e)} ---")
        return jsonify({'message': f'Error interno: {str(e)}'}), 500
    

    
# ==========================================
# ENDPOINT: OBTENER DOCUMENTOS DE UN PACIENTE
# ==========================================
@app.route('/api/patients/<int:patient_id>/documents', methods=['GET'])
@token_required
def get_patient_documents(patient_id):
    claims = get_current_user()
    tenant_id = claims['tenant_id']

    try:
        # Consultar los documentos asociados al paciente y tenant actual
        docs = db_query(
            '''
            SELECT id, document_type as category, file_name as title, file_name, file_url, description, status, created_at
            FROM documents
            WHERE tenant_id = %s AND patient_id = %s
            ORDER BY created_at DESC
            ''',
            (tenant_id, patient_id),
            fetchall=True
        )

        return jsonify(docs or []), 200

    except Exception as e:
        print(f"--- ERROR AL OBTENER DOCUMENTOS DEL PACIENTE: {e} ---")
        return jsonify({'message': f'Error interno: {str(e)}'}), 500


@app.route('/api/patients/<int:patient_id>/appointments', methods=['GET'])
@token_required
def get_patient_appointments(patient_id):
    claims = get_current_user()
    tenant_id = claims['tenant_id']

    # Verify patient exists and belongs to the current tenant
    patient = db_query(
        'SELECT id FROM patients WHERE id = %s AND tenant_id = %s',
        (patient_id, tenant_id),
        fetchone=True
    )
    if not patient:
        return jsonify({'message': 'Patient not found'}), 404

    # Fetch appointments for the specified patient
    appointments = db_query(
        '''
        SELECT id, patient_id, doctor_name, reason, symptoms, weight_kg, height_cm, 
               blood_pressure, bmi, abdominal_perimeter_cm, diagnosis, treatment, 
               prescription, created_at
        FROM appointments 
        WHERE patient_id = %s AND tenant_id = %s 
        ORDER BY created_at DESC
        ''',
        (patient_id, tenant_id),
        fetchall=True
    )

    return jsonify(appointments or [])

# ==========================================
# ENDPOINTS: PLANTILLAS DE FORMULARIOS (TEMPLATES)
# ==========================================
@app.route('/api/templates', methods=['GET', 'POST'])
@app.route('/api/templates/<int:template_id>', methods=['DELETE'])
@token_required
def templates_handler(template_id=None):
    claims = get_current_user()
    tenant_id = claims['tenant_id']

    # 1. OBTENER PLANTILLAS (GET)
    if request.method == 'GET':
        rows = db_query(
            '''
            SELECT id, tenant_id, nombre, version, estado, structure, creado_por, fecha_creacion 
            FROM templates_formulario 
            WHERE tenant_id = %s
            ORDER BY id DESC
            ''', 
            (tenant_id,),
            fetchall=True
        )
        return jsonify(rows or []), 200

    # 2. CREAR O GUARDAR PLANTILLA (POST)
    if request.method == 'POST':
        data = request.get_json() or {}
        nombre = data.get('nombre')
        structure = data.get('structure')
        version = data.get('version', 1)
        creado_por = claims.get('username', 'Sistema')

        if not nombre or not structure:
            return jsonify({'message': 'nombre y structure son obligatorios'}), 400

        try:
            new_template = db_query(
                '''
                INSERT INTO templates_formulario (tenant_id, nombre, version, estado, structure, creado_por, fecha_creacion)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                ''',
                (tenant_id, nombre, version, 'activo', psycopg2.extras.Json(structure), creado_por, now_utc()),
                commit=True,
                fetchone=True
            )

            record_audit('create', 'template', new_template['id'], f'Created template {nombre}', tenant_id, claims.get('id'))
            
            return jsonify({
                'message': 'Plantilla guardada con éxito',
                'id': new_template['id']
            }), 201

        except Exception as e:
            print(f"--- ERROR AL GUARDAR PLANTILLA: {e} ---")
            return jsonify({'message': f'Error interno al guardar la plantilla: {str(e)}'}), 500

    # 3. ELIMINAR PLANTILLA (DELETE)
    if request.method == 'DELETE' and template_id:
        existing = db_query('SELECT id FROM templates_formulario WHERE id = %s AND tenant_id = %s', (template_id, tenant_id), fetchone=True)
        if not existing:
            return jsonify({'message': 'Plantilla no encontrada'}), 404

        try:
            db_query('DELETE FROM templates_formulario WHERE id = %s AND tenant_id = %s', (template_id, tenant_id), commit=True)
            record_audit('delete', 'template', template_id, 'Deleted template', tenant_id, claims.get('id'))
            return jsonify({'message': 'Plantilla eliminada correctamente'}), 200
        except Exception as e:
            print(f"--- ERROR AL ELIMINAR PLANTILLA: {e} ---")
            return jsonify({'message': f'Error interno al eliminar la plantilla: {str(e)}'}), 500



@app.route('/api/documents', methods=['GET', 'POST', 'DELETE'])
@token_required
def documents():
    claims = get_current_user()
    tenant_id = claims['tenant_id']

    # 1. OBTENER DOCUMENTOS (GET)
    if request.method == 'GET':
        patient_id = request.args.get('patient_id')
        sql = '''
            SELECT d.id, d.tenant_id, d.patient_id, p.full_name as patient_name, 
                   d.document_type, d.file_name, d.file_url, 
                   d.description, d.status, d.created_at
            FROM documents d
            LEFT JOIN patients p ON p.id = d.patient_id
            WHERE d.tenant_id = %s
        '''
        params = [tenant_id]

        if patient_id:
            sql += ' AND d.patient_id = %s'
            params.append(patient_id)

        sql += ' ORDER BY d.id DESC'
        rows = db_query(sql, tuple(params), fetchall=True)
        return jsonify(rows or []), 200

    # 2. ELIMINAR DOCUMENTO (DELETE)
    if request.method == 'DELETE':
        if not has_permission(claims.get('role'), 'manage_patients'):
            return jsonify({'message': 'Permission denied'}), 403
        
        data = request.get_json() or {}
        doc_id = data.get('document_id')
        if not doc_id:
            return jsonify({'message': 'document_id es requerido'}), 400

        doc_to_delete = db_query(
            'SELECT id, file_url FROM documents WHERE id = %s AND tenant_id = %s',
            (doc_id, tenant_id), fetchone=True
        )
        if not doc_to_delete:
            return jsonify({'message': 'Documento no encontrado'}), 404

        deleted = db_query(
            'DELETE FROM documents WHERE id = %s AND tenant_id = %s RETURNING id',
            (doc_id, tenant_id), commit=True, fetchone=True
        )

        file_url = doc_to_delete.get('file_url')
        if file_url and '/documents/' in file_url:
            try:
                storage_path = file_url.split('/documents/')[-1]
                storage_path = unquote(storage_path)
                supabase.storage.from_("documents").remove([storage_path])
            except Exception as st_err:
                print(f"Error removiendo archivo de Supabase Storage: {st_err}")

        record_audit('delete', 'document', deleted['id'], f'Deleted document {deleted["id"]}', tenant_id, claims.get('id'))
        return jsonify({'message': 'Documento eliminado'}), 200

    # 3. REGISTRAR Y SUBIR DOCUMENTO (POST)
    if not has_permission(claims.get('role'), 'manage_patients'):
        return jsonify({'message': 'Permission denied'}), 403

    patient_id = request.form.get('patient_id')
    document_type = request.form.get('document_type', 'result')
    description = request.form.get('description', '')
    file_name = request.form.get('file_name', '')
    file = request.files.get('file')

    if not patient_id:
        return jsonify({'message': 'patient_id es obligatorio'}), 400

    if not file:
        return jsonify({'message': 'El archivo es obligatorio'}), 400

    if not file_name:
        file_name = file.filename

    try:
        file_bytes = file.read()
        file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'pdf'
        
        mime_types = {
            'pdf': 'application/pdf',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
        
        mime_type = mime_types.get(file_ext, file.mimetype if file.mimetype != 'text/plain' else 'application/pdf')

        storage_path = f"tenant_{tenant_id}/patient_{patient_id}/{int(time.time())}_{file_name}"
        if not storage_path.lower().endswith(f".{file_ext}"):
            storage_path += f".{file_ext}"

        # Subida a Supabase
        supabase.storage.from_("documents").upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": mime_type, "x-upsert": "true"}
        )

        # Obtener URL pública
        public_url_response = supabase.storage.from_("documents").get_public_url(storage_path)
        
        if isinstance(public_url_response, str):
            public_url = public_url_response
        elif isinstance(public_url_response, dict):
            public_url = public_url_response.get('publicUrl') or public_url_response.get('data', {}).get('publicUrl')
        else:
            public_url = getattr(public_url_response, 'public_url', str(public_url_response))

    except Exception as st_err:
        print(f"--- ERROR DE SUPABASE STORAGE: {st_err} ---")
        return jsonify({'message': f'Error al subir el archivo al almacenamiento: {str(st_err)}'}), 500

    # Inserción con las 8 columnas exactas en la base de datos
    try:
        new_doc = db_query(
            '''
            INSERT INTO documents (
                tenant_id, patient_id, document_type, file_name, 
                file_url, description, status, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            ''',
            (
                int(tenant_id), int(patient_id), document_type, file_name, 
                public_url, description, 'active', now_utc()
            ),
            commit=True,
            fetchone=True
        )

        record_audit('create', 'document', new_doc['id'], f'Uploaded document {file_name}', tenant_id, claims.get('id'))
        
        return jsonify({
            'message': 'Documento registrado con éxito',
            'id': new_doc['id'],
            'file_url': public_url
        }), 201

    except Exception as db_err:
        print(f"--- ERROR DE BASE DE DATOS: {db_err} ---")
        return jsonify({'message': f'Error al registrar en la base de datos: {str(db_err)}'}), 500
    
# ==========================================
# ENDPOINT OPCIONAL: TRIAJE INDEPENDIENTE
# ==========================================
@app.route('/api/triage', methods=['GET', 'POST'])
@token_required
def triage_handler():
    claims = get_current_user()
    tenant_id = claims['tenant_id']

    if request.method == 'GET':
        rows = db_query('SELECT * FROM triages WHERE tenant_id = %s ORDER BY id DESC', (tenant_id,), fetchall=True)
        return jsonify(rows or []), 200

    if request.method == 'POST':
        data = request.get_json() or {}
        patient_id = data.get('patient_id')
        weight_kg = data.get('weight_kg')
        height_cm = data.get('height_cm')
        blood_pressure = data.get('blood_pressure')

        if not patient_id or not weight_kg or not height_cm or not blood_pressure:
            return jsonify({'message': 'patient_id, weight_kg, height_cm y blood_pressure son obligatorios'}), 400

        bmi = data.get('bmi')
        if not bmi and float(height_cm) > 0:
            h_m = float(height_cm) / 100.0
            bmi = round(float(weight_kg) / (h_m * h_m), 2)

        new_triage = db_query(
            '''
            INSERT INTO triages (tenant_id, patient_id, weight_kg, height_cm, blood_pressure, bmi, abdominal_perimeter_cm, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            ''',
            (tenant_id, patient_id, weight_kg, height_cm, blood_pressure, bmi, data.get('abdominal_perimeter_cm'), now_utc()),
            commit=True, fetchone=True
        )

        return jsonify({'message': 'Triaje registrado', 'id': new_triage['id']}), 201
    
@app.route('/api/locations', methods=['GET', 'POST'])
@token_required
def locations():
    claims = get_current_user()
    tenant_id = claims['tenant_id']

    if request.method == 'GET':
        rows = db_query(
            '''
            SELECT l.id, l.name, l.description, l.created_at,
                COUNT(DISTINCT d.id) AS device_count,
                COUNT(a.id) FILTER (WHERE a.is_resolved = 0) AS active_alerts,
                COUNT(a.id) AS total_alerts
            FROM locations l
            LEFT JOIN devices d ON d.location_id = l.id AND d.tenant_id = %s
            LEFT JOIN alerts a ON a.device_id = d.id AND a.tenant_id = %s
            WHERE l.tenant_id = %s
            GROUP BY l.id
            ORDER BY l.id DESC
            ''',
            (tenant_id, tenant_id, tenant_id), fetchall=True
        )
        return jsonify(rows or [])

    if not has_permission(claims.get('role'), 'manage_locations'):
        return jsonify({'message': 'Permission denied'}), 403

    data = request.get_json() or {}
    name = data.get('name')
    description = data.get('description', '')
    if not name:
        return jsonify({'message': 'name is required'}), 400

    new_row = db_query(
        'INSERT INTO locations (tenant_id, name, description, created_at) VALUES (%s, %s, %s, %s) RETURNING id',
        (tenant_id, name, description, now_utc()), commit=True, fetchone=True
    )
    record_audit('create', 'location', new_row['id'], f'Created location {name}', tenant_id, claims.get('id'))
    return jsonify({'message': 'Location created', 'id': new_row['id']})


@app.route('/api/locations/<int:location_id>', methods=['GET', 'PUT'])
@token_required
def location_detail(location_id):
    claims = get_current_user()
    tenant_id = claims['tenant_id']

    if request.method == 'GET':
        row = db_query(
            '''
            SELECT l.id, l.name, l.description, l.created_at,
                COUNT(DISTINCT d.id) AS device_count,
                COUNT(a.id) FILTER (WHERE a.is_resolved = 0) AS active_alerts,
                COUNT(a.id) AS total_alerts
            FROM locations l
            LEFT JOIN devices d ON d.location_id = l.id AND d.tenant_id = %s
            LEFT JOIN alerts a ON a.device_id = d.id AND a.tenant_id = %s
            WHERE l.tenant_id = %s AND l.id = %s
            GROUP BY l.id
            ''',
            (tenant_id, tenant_id, tenant_id, location_id), fetchone=True
        )
        if not row:
            return jsonify({'message': 'Location not found'}), 404

        row['user_count'] = 0
        row['hospital_position'] = ''
        return jsonify(row)

    if not has_permission(claims.get('role'), 'manage_locations'):
        return jsonify({'message': 'Permission denied'}), 403

    data = request.get_json() or {}
    name = data.get('name')
    description = data.get('description', '')
    if not name:
        return jsonify({'message': 'name is required'}), 400

    db_query(
        'UPDATE locations SET name = %s, description = %s WHERE id = %s AND tenant_id = %s',
        (name, description, location_id, tenant_id), commit=True
    )
    record_audit('update', 'location', location_id, f'Updated location {name}', tenant_id, claims.get('id'))
    return jsonify({'message': 'Location updated'})



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


@app.route('/api/dashboard/areas')
@token_required
def dashboard_areas():
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    try:
        rows = db_query(
            '''
            SELECT l.id, l.name,
                COUNT(DISTINCT d.id) AS device_count,
                COUNT(a.id) FILTER (WHERE a.is_resolved = 0) AS active_alerts,
                COUNT(a.id) AS total_alerts
            FROM locations l
            LEFT JOIN devices d ON d.location_id = l.id AND d.tenant_id = %s
            LEFT JOIN alerts a ON a.device_id = d.id AND a.tenant_id = %s
            WHERE l.tenant_id = %s
            GROUP BY l.id, l.name
            ORDER BY l.name
            ''',
            (tenant_id, tenant_id, tenant_id), fetchall=True
        )
        return jsonify(rows or [])
    except Exception as e:
        print(f"[DASHBOARD AREAS ERROR]: {e}")
        return jsonify({'message': 'Error generating dashboard areas'}), 500


@app.route('/api/reports')
@token_required
def reports():
    claims = get_current_user()
    tenant_id = claims['tenant_id']

    try:
        summary = {
            'patients': (db_query('SELECT COUNT(*) as count FROM patients WHERE tenant_id = %s', (tenant_id,), fetchone=True) or {}).get('count', 0),
            'consultations': (db_query('SELECT COUNT(*) as count FROM consultations WHERE tenant_id = %s', (tenant_id,), fetchone=True) or {}).get('count', 0),
            'appointments': (db_query('SELECT COUNT(*) as count FROM appointments WHERE tenant_id = %s', (tenant_id,), fetchone=True) or {}).get('count', 0),
            'documents': (db_query('SELECT COUNT(*) as count FROM documents WHERE tenant_id = %s', (tenant_id,), fetchone=True) or {}).get('count', 0),
            'active_alerts': (db_query('SELECT COUNT(*) as count FROM alerts WHERE tenant_id = %s AND is_resolved = 0', (tenant_id,), fetchone=True) or {}).get('count', 0),
        }

        recent_consultations = db_query('SELECT id, patient_id, reason, diagnosis, created_at FROM consultations WHERE tenant_id = %s ORDER BY created_at DESC LIMIT 10', (tenant_id,), fetchall=True) or []

        return jsonify({'summary': summary, 'recent_consultations': recent_consultations})
    except Exception as e:
        print(f"[REPORTS ERROR]: {e}")
        return jsonify({'message': 'Error generating reports'}), 500


@app.route('/api/reports/series')
@token_required
def reports_series():
    claims = get_current_user()
    tenant_id = claims['tenant_id']

    days = int(request.args.get('days', 30))
    try:
        sql = '''
        SELECT DATE(created_at) as day, COUNT(*) as patients
        FROM patients WHERE tenant_id = %s AND created_at >= now() - interval '%s days'
        GROUP BY day ORDER BY day ASC
        ''' % ('%s', days)
        pts = db_query(sql, (tenant_id,), fetchall=True) or []

        sql2 = '''
        SELECT DATE(created_at) as day, COUNT(*) as consultations
        FROM consultations WHERE tenant_id = %s AND created_at >= now() - interval '%s days'
        GROUP BY day ORDER BY day ASC
        ''' % ('%s', days)
        cons = db_query(sql2, (tenant_id,), fetchall=True) or []

        day_map = {row['day']: {'day': row['day'], 'patients': 0, 'consultations': 0} for row in pts}
        for row in cons:
            if row['day'] in day_map:
                day_map[row['day']]['consultations'] = row['consultations']
            else:
                day_map[row['day']] = {'day': row['day'], 'patients': 0, 'consultations': row['consultations']}

        merged = [day_map[day] for day in sorted(day_map)]
        for item in merged:
            item['patients'] = next((r['patients'] for r in pts if r['day'] == item['day']), 0)

        return jsonify(merged)
    except Exception as e:
        print(f"[SERIES ERROR]: {e}")
        return jsonify({'message': 'Error generating series'}), 500


@app.route('/api/metrics')
@token_required
def metrics():
    """Return key metrics and a simple session duration prediction."""
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    try:
        # Active users: distinct user_id in sessions last 24h
        # CÓDIGO CORREGIDO
        active_users = (db_query("SELECT COUNT(DISTINCT user_id) as count FROM sessions WHERE tenant_id ="" %s AND last_seen >= NOW() - INTERVAL '1 day'",(tenant_id,),fetchone=True,)or {}).get("count", 0)
        # Average session duration (seconds) across sessions with last_seen
        avg_row = db_query("SELECT AVG(EXTRACT(EPOCH FROM (last_seen - created_at))) as avg_seconds FROM sessions WHERE tenant_id = %s AND last_seen IS NOT NULL", (tenant_id,), fetchone=True) or {'avg_seconds': None}
        avg_seconds = avg_row.get('avg_seconds') or 0

        # Simple time-series prediction: get daily avg durations for last 7 days and perform linear trend
        series = db_query("SELECT DATE(created_at) as day, AVG(EXTRACT(EPOCH FROM (COALESCE(last_seen, created_at) - created_at))) as avg_seconds FROM sessions WHERE tenant_id = %s AND created_at >= now() - interval '14 days' GROUP BY day ORDER BY day ASC", (tenant_id,), fetchall=True) or []
        # Build arrays for regression
        xs = []
        ys = []
        for i, row in enumerate(series):
            xs.append(i)
            ys.append(row.get('avg_seconds') or 0)

        pred = None
        if len(xs) >= 2:
            # Simple linear regression y = a + b*x
            n = len(xs)
            sum_x = sum(xs)
            sum_y = sum(ys)
            sum_xx = sum(x*x for x in xs)
            sum_xy = sum(x*y for x,y in zip(xs,ys))
            denom = (n*sum_xx - sum_x*sum_x)
            if denom != 0:
                b = (n*sum_xy - sum_x*sum_y) / denom
                a = (sum_y - b*sum_x) / n
                next_x = n
                pred = max(0, a + b*next_x)

        # return metrics
        return jsonify({
            'active_users': active_users,
            'avg_session_seconds': avg_seconds,
            'session_duration_prediction_seconds': pred,
            'series': series
        })
    except Exception as e:
        print(f"[METRICS ERROR]: {e}")
        return jsonify({'message': 'Error generating metrics'}), 500


@app.route('/api/users', methods=['GET'])
@token_required
def list_users():
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    if not has_permission(claims.get('role'), 'manage_users'):
        return jsonify({'message': 'Permission denied'}), 403

    users = db_query(
        '''
        SELECT u.id, u.username, u.role, u.tenant_id, u.created_at
        FROM users u
        WHERE u.tenant_id = %s
        ORDER BY u.id DESC
        ''',
        (tenant_id,), fetchall=True
    )
    return jsonify(users or [])


@app.route('/api/users/<int:user_id>', methods=['PUT'])
@token_required
def update_user(user_id):
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    if not has_permission(claims.get('role'), 'manage_users'):
        return jsonify({'message': 'Permission denied'}), 403

    data = request.get_json() or {}
    role = data.get('role')
    location_id = data.get('location_id')
    active = data.get('active')

    # Only update allowed fields.
    # location_id is optional and may not exist in the current database schema.
    updates = []
    params = []
    if role:
        updates.append('role = %s')
        params.append(role)
    if location_id is not None and 'location_id' in get_user_columns():
        updates.append('location_id = %s')
        params.append(location_id)
    if active is not None:
        if not active:
            updates.append("role = %s")
            params.append('disabled')

    if not updates:
        return jsonify({'message': 'No fields to update'}), 400

    params.extend([user_id, tenant_id])
    sql = f"UPDATE users SET {', '.join(updates)} WHERE id = %s AND tenant_id = %s"
    db_query(sql, tuple(params), commit=True)
    field_names = ', '.join([u.split('=')[0].strip() for u in updates])
    record_audit('update', 'user', user_id, f'Updated user fields: {field_names}', tenant_id, claims.get('id'))
    return jsonify({'message': 'User updated'})


@app.route('/api/users/<int:user_id>/reset_password', methods=['POST'])
@token_required
def reset_user_password(user_id):
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    if not has_permission(claims.get('role'), 'manage_users'):
        return jsonify({'message': 'Permission denied'}), 403

    data = request.get_json() or {}
    new_password = data.get('new_password')
    if not new_password:
        return jsonify({'message': 'new_password required'}), 400

    hashed_pw = generate_password_hash(new_password)
    db_query('UPDATE users SET password = %s WHERE id = %s AND tenant_id = %s', (hashed_pw, user_id, tenant_id), commit=True)
    record_audit('update', 'user', user_id, 'Password reset by admin', tenant_id, claims.get('id'))
    return jsonify({'message': 'Password reset'})

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@token_required
def delete_user(user_id):
    claims = get_current_user()
    tenant_id = claims['tenant_id']
    if not has_permission(claims.get('role'), 'manage_users'):
        return jsonify({'message': 'Permission denied'}), 403

    # Opcional: evitar que el usuario se elimine a sí mismo
    if claims.get('id') == user_id:
        return jsonify({'message': 'No puedes eliminar tu propia cuenta'}), 400

    # Ejecutar la eliminación asegurando el aislamiento por tenant_id
    db_query('DELETE FROM users WHERE id = %s AND tenant_id = %s', (user_id, tenant_id), commit=True)
    
    record_audit('delete', 'user', user_id, f'Deleted user id {user_id}', tenant_id, claims.get('id'))
    return jsonify({'message': 'User deleted successfully'})

@app.route('/api/sessions', methods=['GET'])
@token_required
def get_sessions():
    claims = request.claims
    tenant_id = claims['tenant_id']
    if not has_permission(claims.get('role'), 'manage_devices') and not has_permission(claims.get('role'), 'manage_users'):
        return jsonify({'message': 'Permission denied'}), 403

    rows = db_query(
        '''SELECT s.id, s.user_id, u.username, s.ip_address, s.user_agent, s.created_at, s.last_seen 
           FROM sessions s LEFT JOIN users u ON u.id = s.user_id 
           WHERE s.tenant_id = %s ORDER BY s.created_at DESC''', 
        (tenant_id,), fetchall=True
    )
    return jsonify(rows or [])

@app.route('/api/devices', methods=['GET', 'POST'])
@token_required
def devices():
    claims = request.claims
    tenant_id = claims.get('tenant_id')

    if request.method == 'GET':
        rows = db_query('SELECT * FROM devices WHERE tenant_id = %s ORDER BY id DESC', (tenant_id,), fetchall=True)
        return jsonify(rows or [])

    # 1. Validar Roles
    role = claims.get('role')
    if role not in ['admin', 'it_support']:
        return jsonify({'message': 'Permission denied'}), 403

    # 2. Sanitizar payload entrante
    data = request.get_json() or {}
    name = data.get('name')
    if not name:
        return jsonify({'message': 'name is required'}), 400

    # Convertir cadenas vacías o valores inválidos a None (NULL en PostgreSQL) para location_id
    location_id = data.get('location_id')
    if location_id in ['', 'null', None]:
        location_id = None
    else:
        try:
            location_id = int(location_id)
        except (ValueError, TypeError):
            location_id = None

    type_ = data.get('type', 'pc')
    status_ = data.get('status', 'active')
    ip_address = data.get('ip_address') or get_client_ip()
    user_agent = data.get('user_agent') or request.headers.get('User-Agent', '')

    # Usar un objeto datetime nativo de Python para la columna de la BD
    created_at = datetime.datetime.now(datetime.timezone.utc)

    # 3. Inserción segura en PostgreSQL (sin patient_id)
    try:
        new_row = db_query(
            '''
            INSERT INTO devices (tenant_id, location_id, name, type, status, ip_address, user_agent, created_at) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            ''',
            (tenant_id, location_id, name, type_, status_, ip_address, user_agent, created_at), 
            commit=True, 
            fetchone=True
        )

        if not new_row or 'id' not in new_row:
            return jsonify({'message': 'No se pudo recuperar el ID del dispositivo creado'}), 500

        device_id = new_row['id']

        # 4. Auditoría aislada
        try:
            record_audit('create', 'device', device_id, f'Created device {name}', tenant_id, claims.get('user_id') or claims.get('id'))
        except Exception as audit_err:
            print(f"[WARN Auditoria] Error al guardar log: {audit_err}")

        return jsonify({'message': 'Device created', 'id': device_id}), 201

    except Exception as e:
        print(f"[ERROR DB /api/devices POST]: {str(e)}")
        return jsonify({'message': 'Error interno al registrar dispositivo', 'error': str(e)}), 500

    
@app.route('/api/device_actions', methods=['GET', 'POST'])
@token_required
def device_actions():
    claims = request.claims
    tenant_id = claims['tenant_id']
    user_id = claims.get('id')

    if request.method == 'POST':
        data = request.get_json() or {}
        action_type = data.get('action_type')
        entity_type = data.get('entity_type')
        entity_id = data.get('entity_id')
        details = data.get('details', '')

        if not action_type or not entity_type:
            return jsonify({'message': 'action_type and entity_type are required'}), 400

        ip_addr = data.get('ip_address') or get_client_ip()
        user_agent = data.get('user_agent') or request.headers.get('User-Agent', '')

        try:
            new_action = db_query(
                '''
                INSERT INTO device_actions 
                (tenant_id, session_id, user_id, ip_address, user_agent, action_type, entity_type, entity_id, details, created_at)
                VALUES (%s, NULL, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                ''',
                (tenant_id, user_id, ip_addr, user_agent, action_type, entity_type, entity_id, details, now_utc()),
                commit=True,
                fetchone=True
            )
            return jsonify({'message': 'Device action logged', 'id': new_action['id']}), 201
        except Exception as e:
            return jsonify({'message': f'Error logging action: {str(e)}'}), 500

    if not has_permission(claims.get('role'), 'manage_devices') and not has_permission(claims.get('role'), 'manage_users'):
        return jsonify({'message': 'Permission denied'}), 403

    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = max(1, min(100, int(request.args.get('per_page', 25))))
    except ValueError:
        page, per_page = 1, 25

    where_sql, params = _build_device_actions_query(tenant_id)

    count_sql = f'''
        SELECT COUNT(*) as total 
        FROM device_actions da 
        LEFT JOIN users u ON u.id = da.user_id 
        WHERE {where_sql}
    '''
    total_row = db_query(count_sql, tuple(params), fetchone=True) or {'total': 0}
    total = total_row.get('total', 0)

    offset = (page - 1) * per_page
    query_sql = f'''
        SELECT da.id, da.session_id, da.user_id, u.username, u.role as user_role, da.ip_address, 
               da.user_agent, da.action_type, da.entity_type, da.entity_id, 
               da.details, da.created_at
        FROM device_actions da
        LEFT JOIN users u ON u.id = da.user_id
        WHERE {where_sql}
        ORDER BY da.created_at DESC
        LIMIT %s OFFSET %s
    '''
    
    query_params = list(params) + [per_page, offset]
    rows = db_query(query_sql, tuple(query_params), fetchall=True) or []

    return jsonify({
        'total': total,
        'page': page,
        'per_page': per_page,
        'items': rows
    })


@app.route('/api/incidents', methods=['GET', 'POST', 'PUT'])
@token_required
def incidents_handler():
    claims = get_current_user()
    tenant_id = claims['tenant_id']

    if request.method == 'GET':
        rows = db_query('SELECT i.id, i.incident_type, i.description, i.status, i.created_at, i.updated_at, u.username FROM incidents i LEFT JOIN users u ON u.id = i.user_id WHERE i.tenant_id = %s ORDER BY i.created_at DESC', (tenant_id,), fetchall=True)
        return jsonify(rows or [])

    if request.method == 'POST':
        data = request.get_json() or {}
        inc_type = data.get('incident_type')
        desc = data.get('description')
        user_id = claims.get('id')
        if not inc_type:
            return jsonify({'message': 'incident_type required'}), 400
        new_row = db_query('INSERT INTO incidents (tenant_id, user_id, incident_type, description, status, created_at) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id', (tenant_id, user_id, inc_type, desc, 'open', now_utc()), commit=True, fetchone=True)
        record_audit('create', 'incident', new_row['id'], f'Incident {inc_type}', tenant_id, user_id)
        return jsonify({'message': 'Incident created', 'id': new_row['id']})

    if request.method == 'PUT':
        data = request.get_json() or {}
        inc_id = data.get('id')
        status = data.get('status')
        if not inc_id or not status:
            return jsonify({'message': 'id and status required'}), 400
        db_query('UPDATE incidents SET status = %s, updated_at = %s WHERE id = %s AND tenant_id = %s', (status, now_utc(), inc_id, tenant_id), commit=True)
        record_audit('update', 'incident', inc_id, f'Status set to {status}', tenant_id, claims.get('id'))
        return jsonify({'message': 'Incident updated'})

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



@app.route('/api/dashboard/export/excel', methods=['GET'])
@token_required
def export_dashboard_excel():
    claims = get_current_user()
    tenant_id = claims['tenant_id']

    # 1. Obtener métricas independientes reales del dashboard
    total_patients = db_query("SELECT COUNT(*) as count FROM patients WHERE tenant_id = %s", (tenant_id,), fetchone=True)['count']
    total_consultations = db_query("SELECT COUNT(*) as count FROM documents WHERE tenant_id = %s", (tenant_id,), fetchone=True)['count']
    
    # Asumiendo que tienes una tabla o conteo separado para sesiones (ajusta la tabla si difiere)
    try:
        total_sessions = db_query("SELECT COUNT(*) as count FROM sessions WHERE tenant_id = %s", (tenant_id,), fetchone=True)['count']
    except Exception:
        total_sessions = 0 # Valor por defecto si la tabla de sesiones tiene otro nombre

    active_users = db_query("SELECT COUNT(*) as count FROM users WHERE tenant_id = %s", (tenant_id,), fetchone=True)['count']

    # 2. Obtener la tendencia diaria diferenciando consultas y sesiones si aplica
    series_sql = '''
        SELECT DATE(created_at) as dia, COUNT(DISTINCT patient_id) as pacientes, COUNT(*) as consultas
        FROM documents
        WHERE tenant_id = %s
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
    '''
    series_rows = db_query(series_sql, (tenant_id,), fetchall=True)

    # 3. Crear libro de Excel con openpyxl e incrustar gráficos
    wb = openpyxl.Workbook()
    
    # --- PESTAÑA 1: Resumen General ---
    ws_summary = wb.active
    ws_summary.title = "Resumen General"
    ws_summary.append(["Métrica del Sistema", "Valor Total"])
    ws_summary.append(["Total Pacientes Registrados", total_patients])
    ws_summary.append(["Total Consultas Médicas", total_consultations])
    ws_summary.append(["Total Sesiones Registradas", total_sessions])
    ws_summary.append(["Usuarios Activos", active_users])

    # --- PESTAÑA 2: Tendencia Diaria con Gráfico de Barras ---
    ws_trend = wb.create_sheet(title="Tendencia Diaria")
    ws_trend.append(["Día", "Pacientes", "Consultas"])

    if series_rows:
        for row in series_rows:
            dia_str = pd.to_datetime(row['dia']).strftime('%Y-%m-%d')
            ws_trend.append([dia_str, row['pacientes'], row['consultas']])

        # Crear un gráfico de barras profesional incorporado en la hoja
        chart = BarChart()
        chart.type = "col"
        chart.style = 10
        chart.title = "Evolución Diaria de Pacientes y Consultas"
        chart.y_axis.title = "Cantidad"
        chart.x_axis.title = "Día"

        # Referencias de datos (asumiendo cabecera en fila 1 y datos hasta len)
        data_ref = Reference(ws_trend, min_col=2, min_row=1, max_col=3, max_row=len(series_rows) + 1)
        cats_ref = Reference(ws_trend, min_col=1, min_row=2, max_row=len(series_rows) + 1)
        
        chart.add_data(data_ref, titles_from_data=True)
        chart.set_categories(cats_ref)
        
        # Insertar gráfico en la celda E2
        ws_trend.add_chart(chart, "E2")

    # Guardar en memoria y retornar
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'dashboard_analitico_{int(time.time())}.xlsx'
    )
    

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)


