# ============================================
# SIS WEB - Avance de Indicadores (Flask)
# ============================================
# Dependencias: pip install flask
# Ejecutar: python app.py
# Abrir navegador: http://127.0.0.1:5000

from flask import Flask, render_template_string, request, redirect, url_for, session, flash
import sqlite3
import hashlib
import os
from datetime import datetime

app = Flask(__name__)
app.secret_key = "sis_secret_key_2026_segura"
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sis_database.db")

# ============================================
# BASE DE DATOS
# ============================================
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            nombre_completo TEXT NOT NULL,
            rol TEXT DEFAULT 'usuario',
            estado INTEGER DEFAULT 1,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pacientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dni TEXT NOT NULL,
            apellidos TEXT NOT NULL,
            nombres TEXT NOT NULL,
            num_hc TEXT NOT NULL,
            fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            registrado_por TEXT
        )
    """)
    
    pw_hash = hashlib.sha256("admin123".encode()).hexdigest()
    cursor.execute("""
        INSERT OR IGNORE INTO usuarios (id, username, password, nombre_completo, rol)
        VALUES (1, 'admin', ?, 'Administrador del Sistema', 'admin')
    """, (pw_hash,))
    
    conn.commit()
    conn.close()

# ============================================
# CSS Y HTML BASE (sin archivos externos)
# ============================================
CSS_BASE = """
<style>
    :root {
        --color-primario: #1a5276;
        --color-secundario: #2980b9;
        --color-acento: #3498db;
        --color-exito: #27ae60;
        --color-peligro: #c0392b;
        --color-alerta: #e67e22;
        --color-fondo: #f0f2f5;
        --color-blanco: #ffffff;
        --color-texto: #2c3e50;
        --color-texto-claro: #7f8c8d;
        --sombra: 0 4px 20px rgba(0,0,0,0.08);
        --radio: 12px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    body { background-color: var(--color-fondo); color: var(--color-texto); min-height: 100vh; }
    
    .navbar {
        background: linear-gradient(135deg, var(--color-primario) 0%, var(--color-secundario) 100%);
        color: white;
        padding: 0 30px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 2px 10px rgba(0,0,0,0.15);
        position: fixed;
        top: 0; left: 0; right: 0;
        z-index: 1000;
    }
    .navbar-brand { font-size: 1.3rem; font-weight: 700; display: flex; align-items: center; gap: 10px; }
    .navbar-user { display: flex; align-items: center; gap: 20px; font-size: 0.95rem; }
    .navbar-user span { opacity: 0.95; }
    .btn-logout {
        background: var(--color-peligro);
        color: white;
        border: none;
        padding: 8px 18px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.85rem;
        transition: all 0.2s;
        text-decoration: none;
    }
    .btn-logout:hover { background: #922b21; transform: translateY(-1px); }
    
    .layout { display: flex; margin-top: 60px; min-height: calc(100vh - 60px); }
    
    .sidebar {
        width: 260px;
        background: var(--color-blanco);
        border-right: 1px solid #e1e4e8;
        padding: 25px 0;
        position: fixed;
        height: 100%;
        overflow-y: auto;
    }
    .sidebar-title {
        padding: 0 25px 20px;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--color-texto-claro);
        font-weight: 700;
        border-bottom: 1px solid #f0f0f0;
        margin-bottom: 10px;
    }
    .nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 25px;
        color: var(--color-texto);
        text-decoration: none;
        font-size: 0.95rem;
        font-weight: 500;
        transition: all 0.2s;
        border-left: 3px solid transparent;
    }
    .nav-item:hover { background: #f8f9fa; color: var(--color-primario); border-left-color: var(--color-acento); }
    .nav-item.active { background: #eaf2f8; color: var(--color-primario); border-left-color: var(--color-primario); font-weight: 600; }
    .nav-icon { font-size: 1.2rem; width: 24px; text-align: center; }
    
    .main-content {
        margin-left: 260px;
        flex: 1;
        padding: 30px;
    }
    .page-header {
        margin-bottom: 25px;
    }
    .page-header h1 {
        font-size: 1.6rem;
        color: var(--color-primario);
        margin-bottom: 5px;
    }
    .page-header p { color: var(--color-texto-claro); font-size: 0.95rem; }
    
    .card {
        background: var(--color-blanco);
        border-radius: var(--radio);
        box-shadow: var(--sombra);
        padding: 25px;
        margin-bottom: 25px;
        border: 1px solid #eaecef;
    }
    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 1px solid #f0f0f0;
    }
    .card-title { font-size: 1.1rem; font-weight: 700; color: var(--color-primario); }
    
    .modules-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
    }
    .module-card {
        background: var(--color-blanco);
        border-radius: var(--radio);
        padding: 25px;
        text-align: center;
        box-shadow: var(--sombra);
        border: 1px solid #eaecef;
        transition: all 0.3s;
        cursor: pointer;
        text-decoration: none;
        color: inherit;
        display: block;
    }
    .module-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 30px rgba(0,0,0,0.12);
        border-color: var(--color-acento);
    }
    .module-icon {
        font-size: 2.5rem;
        margin-bottom: 15px;
        display: block;
    }
    .module-title { font-size: 1.1rem; font-weight: 700; color: var(--color-texto); margin-bottom: 8px; }
    .module-desc { font-size: 0.85rem; color: var(--color-texto-claro); }
    
    .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 20px;
    }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--color-texto);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .form-control {
        padding: 12px 15px;
        border: 1px solid #d5d8dc;
        border-radius: 8px;
        font-size: 1rem;
        background: #fafbfc;
        transition: all 0.2s;
        color: var(--color-texto);
    }
    .form-control:focus {
        outline: none;
        border-color: var(--color-acento);
        background: white;
        box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.15);
    }
    .btn {
        padding: 12px 28px;
        border: none;
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        text-decoration: none;
    }
    .btn-primary { background: var(--color-primario); color: white; }
    .btn-primary:hover { background: var(--color-secundario); transform: translateY(-1px); }
    .btn-success { background: var(--color-exito); color: white; }
    .btn-success:hover { background: #219a52; }
    .btn-danger { background: var(--color-peligro); color: white; }
    .btn-danger:hover { background: #922b21; }
    
    .table-container { overflow-x: auto; }
    .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
    }
    .data-table thead th {
        background: var(--color-primario);
        color: white;
        padding: 14px;
        text-align: left;
        font-weight: 600;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .data-table tbody tr { border-bottom: 1px solid #f0f0f0; transition: background 0.15s; }
    .data-table tbody tr:hover { background: #f8f9fa; }
    .data-table tbody td { padding: 14px; color: var(--color-texto); }
    .badge {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
    }
    .badge-success { background: #d4edda; color: #155724; }
    .badge-warning { background: #fff3cd; color: #856404; }
    
    .login-body {
        background: linear-gradient(135deg, var(--color-primario) 0%, var(--color-secundario) 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
    }
    .login-box {
        background: white;
        padding: 45px;
        border-radius: var(--radio);
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        width: 100%;
        max-width: 420px;
        text-align: center;
    }
    .login-logo {
        width: 70px; height: 70px;
        background: var(--color-primario);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0 auto 20px;
    }
    .login-box h2 { color: var(--color-primario); margin-bottom: 5px; font-size: 1.4rem; }
    .login-box .subtitle { color: var(--color-texto-claro); margin-bottom: 30px; font-size: 0.9rem; }
    .login-form .form-group { margin-bottom: 18px; text-align: left; }
    .login-form label { font-size: 0.8rem; font-weight: 600; color: var(--color-texto); margin-bottom: 6px; display: block; }
    .login-form input {
        width: 100%;
        padding: 12px 15px;
        border: 1px solid #d5d8dc;
        border-radius: 8px;
        font-size: 1rem;
        background: #fafbfc;
    }
    .login-form input:focus {
        outline: none;
        border-color: var(--color-acento);
        box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.15);
    }
    .login-form button {
        width: 100%;
        padding: 14px;
        margin-top: 10px;
        font-size: 1rem;
    }
    .login-info {
        margin-top: 25px;
        padding-top: 20px;
        border-top: 1px solid #f0f0f0;
        font-size: 0.8rem;
        color: var(--color-texto-claro);
    }
    
    .alert {
        padding: 14px 20px;
        border-radius: 8px;
        margin-bottom: 20px;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    .alert-warning { background: #fff3cd; color: #856404; border: 1px solid #ffeeba; }
    
    .footer-bar {
        margin-left: 260px;
        padding: 15px 30px;
        background: white;
        border-top: 1px solid #e1e4e8;
        display: flex;
        justify-content: space-between;
        font-size: 0.8rem;
        color: var(--color-texto-claro);
    }
    
    @media (max-width: 768px) {
        .sidebar { width: 100%; position: relative; height: auto; }
        .main-content, .footer-bar { margin-left: 0; }
        .layout { flex-direction: column; }
    }
</style>
"""

def render_page(title, navbar, sidebar, content, fecha):
    """Renderiza una página completa con el layout profesional."""
    alerts = ""
    messages = []
    try:
        messages = session.get('_flashes', [])
    except:
        pass
    
    # Procesar flashes de Flask
    with app.app_context():
        from flask import get_flashed_messages
        flash_msgs = get_flashed_messages(with_categories=True)
        for category, message in flash_msgs:
            alerts += f'<div class="alert alert-{category}">{message}</div>'
    
    html = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
        {CSS_BASE}
    </head>
    <body>
        {navbar}
        <div class="layout">
            {sidebar}
            <main class="main-content">
                {alerts}
                {content}
            </main>
        </div>
        <div class="footer-bar">
            <span>SIS Indicadores v1.0</span>
            <span>{fecha}</span>
        </div>
    </body>
    </html>
    """
    return render_template_string(html)

def render_login_page(title, content):
    """Renderiza la página de login (sin sidebar)."""
    with app.app_context():
        from flask import get_flashed_messages
        flash_msgs = get_flashed_messages(with_categories=True)
        alerts = ""
        for category, message in flash_msgs:
            alerts += f'<div class="alert alert-{category}">{message}</div>'
    
    html = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
        {CSS_BASE}
    </head>
    <body>
        {alerts}
        {content}
    </body>
    </html>
    """
    return render_template_string(html)

def navbar_html():
    nombre = session.get('nombre', 'Usuario')
    return f"""
    <div class="navbar">
        <div class="navbar-brand">📊 AVANCE DE INDICADORES SIS</div>
        <div class="navbar-user">
            <span>👤 {nombre}</span>
            <a href="{url_for('logout')}" class="btn-logout">Cerrar Sesión</a>
        </div>
    </div>
    """

def sidebar_html(activo="menu"):
    items = [
        ("menu", "🏠", "Inicio", url_for('menu')),
        ("registro", "📝", "Registro de Pacientes", url_for('registro')),
        ("seguimiento", "🔍", "Seguimiento", url_for('seguimiento')),
        ("reporte", "📈", "Reportes", url_for('reporte')),
        ("usuarios", "👥", "Gestión de Usuarios", url_for('usuarios')),
    ]
    html = '<aside class="sidebar"><div class="sidebar-title">Módulos del Sistema</div>'
    for key, icon, label, href in items:
        cls = "nav-item active" if activo == key else "nav-item"
        html += f'<a href="{href}" class="{cls}"><span class="nav-icon">{icon}</span> {label}</a>'
    html += '</aside>'
    return html

# ============================================
# RUTAS
# ============================================
@app.route("/")
def index():
    if "user_id" in session:
        return redirect(url_for("menu"))
    return redirect(url_for("login"))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()
        
        if not username or not password:
            flash("Complete todos los campos.", "error")
            return redirect(url_for("login"))
        
        pw_hash = hashlib.sha256(password.encode()).hexdigest()
        conn = get_db()
        user = conn.execute(
            "SELECT id, nombre_completo, rol FROM usuarios WHERE username = ? AND password = ? AND estado = 1",
            (username, pw_hash)
        ).fetchone()
        conn.close()
        
        if user:
            session["user_id"] = user["id"]
            session["nombre"] = user["nombre_completo"]
            session["rol"] = user["rol"]
            session["username"] = username
            flash(f"Bienvenido, {user['nombre_completo']}.", "success")
            return redirect(url_for("menu"))
        else:
            flash("Usuario o contraseña incorrectos.", "error")
            return redirect(url_for("login"))
    
    content = f"""
    <div class="login-body">
        <div class="login-box">
            <div class="login-logo">SIS</div>
            <h2>SISTEMA DE INDICADORES</h2>
            <p class="subtitle">Ingrese sus credenciales de acceso</p>
            <form class="login-form" method="POST" action="{url_for('login')}">
                <div class="form-group">
                    <label>Usuario</label>
                    <input type="text" name="username" placeholder="Ingrese su usuario" required autofocus>
                </div>
                <div class="form-group">
                    <label>Contraseña</label>
                    <input type="password" name="password" placeholder="Ingrese su contraseña" required>
                </div>
                <button type="submit" class="btn btn-primary">INICIAR SESIÓN</button>
            </form>
            <div class="login-info">
                <p><strong>Usuario demo:</strong> admin</p>
                <p><strong>Contraseña:</strong> admin123</p>
                <p style="margin-top:10px;">©️ {datetime.now().year} SIS - Todos los derechos reservados</p>
            </div>
        </div>
    </div>
    """
    return render_login_page("Iniciar Sesión - SIS", content)

@app.route("/logout")
def logout():
    session.clear()
    flash("Sesión cerrada correctamente.", "success")
    return redirect(url_for("login"))

@app.route("/menu")
def menu():
    if "user_id" not in session:
        return redirect(url_for("login"))
    
    conn = get_db()
    pacientes = conn.execute(
        "SELECT * FROM pacientes ORDER BY fecha_registro DESC LIMIT 10"
    ).fetchall()
    conn.close()
    
    filas = ""
    for p in pacientes:
        filas += f"""
        <tr>
            <td>{p['id']}</td>
            <td><strong>{p['dni']}</strong></td>
            <td>{p['apellidos']}</td>
            <td>{p['nombres']}</td>
            <td><span class="badge badge-success">{p['num_hc']}</span></td>
            <td>{p['fecha_registro']}</td>
        </tr>
        """
    if not filas:
        filas = '<tr><td colspan="6" style="text-align:center;color:var(--color-texto-claro);padding:30px;">No hay pacientes registrados aún.</td></tr>'
    
    content = f"""
    <div class="page-header">
        <h1>Panel de Control</h1>
        <p>Bienvenido al sistema de indicadores SIS. Seleccione un módulo para comenzar.</p>
    </div>
    
    <div class="modules-grid">
        <a href="{url_for('registro')}" class="module-card">
            <span class="module-icon">📝</span>
            <div class="module-title">Registro de Pacientes</div>
            <div class="module-desc">Registrar nuevos pacientes con DNI, nombres y número de HC.</div>
        </a>
        <a href="{url_for('seguimiento')}" class="module-card">
            <span class="module-icon">🔍</span>
            <div class="module-title">Seguimiento</div>
            <div class="module-desc">Consultar y dar seguimiento a los registros existentes.</div>
        </a>
        <a href="{url_for('reporte')}" class="module-card">
            <span class="module-icon">📈</span>
            <div class="module-title">Reportes</div>
            <div class="module-desc">Generar reportes estadísticos y exportar datos.</div>
        </a>
        <a href="{url_for('usuarios')}" class="module-card">
            <span class="module-icon">👥</span>
            <div class="module-title">Gestión de Usuarios</div>
            <div class="module-desc">Administrar usuarios y permisos del sistema.</div>
        </a>
    </div>
    
    <div class="card">
        <div class="card-header">
            <span class="card-title">📋 Últimos Pacientes Registrados</span>
        </div>
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr><th>ID</th><th>DNI</th><th>APELLIDOS</th><th>NOMBRES</th><th>N° HC</th><th>FECHA REGISTRO</th></tr>
                </thead>
                <tbody>{filas}</tbody>
            </table>
        </div>
    </div>
    """
    
    return render_page("Menú Principal - SIS", navbar_html(), sidebar_html("menu"), 
                       content, datetime.now().strftime("%d/%m/%Y %H:%M"))

@app.route("/registro", methods=["GET", "POST"])
def registro():
    if "user_id" not in session:
        return redirect(url_for("login"))
    
    if request.method == "POST":
        dni = request.form.get("dni", "").strip()
        apellidos = request.form.get("apellidos", "").strip().upper()
        nombres = request.form.get("nombres", "").strip().upper()
        num_hc = request.form.get("num_hc", "").strip().upper()
        
        if not all([dni, apellidos, nombres, num_hc]):
            flash("Todos los campos son obligatorios.", "error")
        else:
            conn = get_db()
            conn.execute("""
                INSERT INTO pacientes (dni, apellidos, nombres, num_hc, registrado_por)
                VALUES (?, ?, ?, ?, ?)
            """, (dni, apellidos, nombres, num_hc, session.get("username", "admin")))
            conn.commit()
            conn.close()
            flash(f"Paciente {apellidos}, {nombres} registrado correctamente.", "success")
            return redirect(url_for("registro"))
    
    conn = get_db()
    pacientes = conn.execute(
        "SELECT * FROM pacientes ORDER BY fecha_registro DESC"
    ).fetchall()
    conn.close()
    
    filas = ""
    for p in pacientes:
        filas += f"""
        <tr>
            <td>{p['id']}</td>
            <td><strong>{p['dni']}</strong></td>
            <td>{p['apellidos']}</td>
            <td>{p['nombres']}</td>
            <td><span class="badge badge-success">{p['num_hc']}</span></td>
            <td>{p['registrado_por']}</td>
            <td>{p['fecha_registro']}</td>
        </tr>
        """
    if not filas:
        filas = '<tr><td colspan="7" style="text-align:center;color:var(--color-texto-claro);padding:30px;">No hay pacientes registrados.</td></tr>'
    
    content = f"""
    <div class="page-header">
        <h1>📝 Registro de Pacientes</h1>
        <p>Complete los datos del paciente para registrarlo en el sistema.</p>
    </div>
    
    <div class="card">
        <div class="card-header">
            <span class="card-title">Formulario de Registro</span>
        </div>
        <form method="POST" action="{url_for('registro')}">
            <div class="form-grid">
                <div class="form-group">
                    <label>DNI</label>
                    <input type="text" name="dni" class="form-control" placeholder="Ej: 12345678" maxlength="8" required>
                </div>
                <div class="form-group">
                    <label>Número de Historia Clínica (HC)</label>
                    <input type="text" name="num_hc" class="form-control" placeholder="Ej: HC-2026-001" required>
                </div>
                <div class="form-group">
                    <label>Apellidos</label>
                    <input type="text" name="apellidos" class="form-control" placeholder="Ej: TORRES BAUTISTA" required>
                </div>
                <div class="form-group">
                    <label>Nombres</label>
                    <input type="text" name="nombres" class="form-control" placeholder="Ej: ELAIN CRISTELL" required>
                </div>
            </div>
            <div style="margin-top: 25px; display: flex; gap: 12px;">
                <button type="submit" class="btn btn-success">💾 GUARDAR REGISTRO</button>
                <a href="{url_for('menu')}" class="btn btn-primary" style="background:var(--color-texto-claro);">← VOLVER AL MENÚ</a>
            </div>
        </form>
    </div>
    
    <div class="card">
        <div class="card-header">
            <span class="card-title">📋 Pacientes Registrados</span>
        </div>
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr><th>ID</th><th>DNI</th><th>APELLIDOS</th><th>NOMBRES</th><th>N° HC</th><th>REGISTRADO POR</th><th>FECHA</th></tr>
                </thead>
                <tbody>{filas}</tbody>
            </table>
        </div>
    </div>
    """
    
    return render_page("Registro de Pacientes - SIS", navbar_html(), sidebar_html("registro"),
                       content, datetime.now().strftime("%d/%m/%Y %H:%M"))

@app.route("/seguimiento")
def seguimiento():
    if "user_id" not in session:
        return redirect(url_for("login"))
    
    content = f"""
    <div class="page-header">
        <h1>🔍 Seguimiento</h1>
        <p>Seguimiento y consulta de pacientes registrados.</p>
    </div>
    <div class="card" style="text-align:center;padding:60px 30px;">
        <div style="font-size:4rem;margin-bottom:20px;">🚧</div>
        <h2 style="color:var(--color-primario);margin-bottom:10px;">Módulo en Desarrollo</h2>
        <p style="color:var(--color-texto-claro);font-size:1.05rem;">
            Esta sección está siendo construida.<br>
            Por favor, utilice el <strong>módulo de Registro de Pacientes</strong> que ya se encuentra activo.
        </p>
        <a href="{url_for('menu')}" class="btn btn-primary" style="margin-top:25px;">← VOLVER AL MENÚ PRINCIPAL</a>
    </div>
    """
    return render_page("Seguimiento - SIS", navbar_html(), sidebar_html("seguimiento"),
                       content, datetime.now().strftime("%d/%m/%Y %H:%M"))

@app.route("/reporte")
def reporte():
    if "user_id" not in session:
        return redirect(url_for("login"))
    
    content = f"""
    <div class="page-header">
        <h1>📈 Reportes</h1>
        <p>Generación de reportes estadísticos del sistema.</p>
    </div>
    <div class="card" style="text-align:center;padding:60px 30px;">
        <div style="font-size:4rem;margin-bottom:20px;">🚧</div>
        <h2 style="color:var(--color-primario);margin-bottom:10px;">Módulo en Desarrollo</h2>
        <p style="color:var(--color-texto-claro);font-size:1.05rem;">
            Esta sección está siendo construida.<br>
            Por favor, utilice el <strong>módulo de Registro de Pacientes</strong> que ya se encuentra activo.
        </p>
        <a href="{url_for('menu')}" class="btn btn-primary" style="margin-top:25px;">← VOLVER AL MENÚ PRINCIPAL</a>
    </div>
    """
    return render_page("Reportes - SIS", navbar_html(), sidebar_html("reporte"),
                       content, datetime.now().strftime("%d/%m/%Y %H:%M"))

@app.route("/usuarios")
def usuarios():
    if "user_id" not in session:
        return redirect(url_for("login"))
    
    content = f"""
    <div class="page-header">
        <h1>👥 Gestión de Usuarios</h1>
        <p>Administración de usuarios y permisos del sistema.</p>
    </div>
    <div class="card" style="text-align:center;padding:60px 30px;">
        <div style="font-size:4rem;margin-bottom:20px;">🚧</div>
        <h2 style="color:var(--color-primario);margin-bottom:10px;">Módulo en Desarrollo</h2>
        <p style="color:var(--color-texto-claro);font-size:1.05rem;">
            Esta sección está siendo construida.<br>
            Por favor, utilice el <strong>módulo de Registro de Pacientes</strong> que ya se encuentra activo.
        </p>
        <a href="{url_for('menu')}" class="btn btn-primary" style="margin-top:25px;">← VOLVER AL MENÚ PRINCIPAL</a>
    </div>
    """
    return render_page("Gestión de Usuarios - SIS", navbar_html(), sidebar_html("usuarios"),
                       content, datetime.now().strftime("%d/%m/%Y %H:%M"))

# ============================================
# INICIO
# ============================================
if __name__ == "__main__":
    init_db()
    print("=" * 50)
    print("  SIS INDICADORES - Servidor iniciado")
    print("=" * 50)
    print("  Abre tu navegador en: http://127.0.0.1:5001")
    print("  Usuario: admin")
    print("  Contraseña: admin123")
    print("=" * 50)
    app.run(host="127.0.0.1", port=5001, debug=True)