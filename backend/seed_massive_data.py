import os
import sqlite3
import datetime
import random
from werkzeug.security import generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'hospital.db')

ROLES = ['tenant_admin', 'doctor', 'nurse', 'staff', 'auditor', 'viewer']
DEVICE_TYPES = ['monitor', 'ventilator', 'infusion pump', 'scanner', 'bed sensor']
DEVICE_STATUSES = ['available', 'active', 'maintenance', 'offline']
ALERT_TYPES = ['battery', 'connection', 'temperature', 'pressure', 'alarm']
ALERT_SEVERITIES = ['low', 'medium', 'high', 'critical']
METRIC_TYPES = [('battery', '%'), ('temperature', '°C'), ('heart_rate', 'bpm'), ('pressure', 'mmHg'), ('oxygen', '%')]
SPECIALTIES = ['Cardiología', 'Pediatría', 'Medicina general', 'Neurología', 'Urgencias']
DOCUMENT_TYPES = ['report', 'prescription', 'image', 'consent', 'record']
BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
SEXES = ['M', 'F']
ALLERGIES = ['Ninguna', 'Penicilina', 'Aspirina', 'Polen', 'Mariscos']

FIRST_NAMES = [
    'Ana', 'Luis', 'Marta', 'Carlos', 'Sofía', 'Diego', 'Camila', 'Javier', 'Lucía', 'Miguel',
    'Pablo', 'Laura', 'Daniela', 'Andrés', 'Mariana', 'Sergio', 'Valeria', 'Alberto', 'Nadia', 'Ramón'
]
LAST_NAMES = [
    'García', 'Pérez', 'Rojas', 'Díaz', 'Luna', 'Ortega', 'Gómez', 'Sánchez', 'Vega', 'Cruz',
    'Mendoza', 'Fernández', 'Torres', 'Castillo', 'Navarro', 'Fuentes', 'Ramírez', 'Bravo', 'Herrera', 'Mora'
]


def now_iso():
    return datetime.datetime.utcnow().replace(microsecond=0).isoformat()


def ensure_tenant(conn):
    c = conn.cursor()
    row = c.execute('SELECT id FROM tenants WHERE name = ?', ('Hospital Demo',)).fetchone()
    if row:
        return row[0]
    c.execute('INSERT INTO tenants (name, created_at) VALUES (?, ?)', ('Hospital Demo', now_iso()))
    conn.commit()
    return c.lastrowid


def ensure_users(conn, tenant_id, target_count=100):
    c = conn.cursor()
    current_count = c.execute('SELECT COUNT(*) FROM users WHERE tenant_id = ?', (tenant_id,)).fetchone()[0]
    if current_count >= target_count:
        return

    existing_usernames = {row[0] for row in c.execute('SELECT username FROM users WHERE tenant_id = ?', (tenant_id,)).fetchall()}
    for idx in range(current_count + 1, target_count + 1):
        username = f'user{idx:03d}'
        if username in existing_usernames:
            continue
        password = generate_password_hash('User123!')
        role = ROLES[idx % len(ROLES)]
        c.execute(
            'INSERT INTO users (username, password, role, tenant_id, created_at) VALUES (?, ?, ?, ?, ?)',
            (username, password, role, tenant_id, now_iso())
        )
    conn.commit()


def ensure_locations(conn, tenant_id, target_count=100):
    c = conn.cursor()
    current_count = c.execute('SELECT COUNT(*) FROM locations WHERE tenant_id = ?', (tenant_id,)).fetchone()[0]
    if current_count >= target_count:
        return

    for idx in range(current_count + 1, target_count + 1):
        c.execute(
            'INSERT INTO locations (tenant_id, name, description, created_at) VALUES (?, ?, ?, ?)',
            (tenant_id, f'Ubicación {idx:03d}', f'Área de servicio {idx:03d}', now_iso())
        )
    conn.commit()


def ensure_devices(conn, tenant_id, target_count=100):
    c = conn.cursor()
    current_count = c.execute('SELECT COUNT(*) FROM devices WHERE tenant_id = ?', (tenant_id,)).fetchone()[0]
    if current_count >= target_count:
        return

    location_ids = [row[0] for row in c.execute('SELECT id FROM locations WHERE tenant_id = ?', (tenant_id,)).fetchall()]
    if not location_ids:
        return

    for idx in range(current_count + 1, target_count + 1):
        location_id = random.choice(location_ids)
        type_ = random.choice(DEVICE_TYPES)
        status = random.choice(DEVICE_STATUSES)
        c.execute(
            'INSERT INTO devices (tenant_id, location_id, name, type, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            (tenant_id, location_id, f'Dispositivo {idx:03d}', type_, status, now_iso())
        )
    conn.commit()


def ensure_patients(conn, tenant_id, target_count=100):
    c = conn.cursor()
    current_count = c.execute('SELECT COUNT(*) FROM patients WHERE tenant_id = ?', (tenant_id,)).fetchone()[0]
    if current_count >= target_count:
        return

    for idx in range(current_count + 1, target_count + 1):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        full_name = f'{first_name} {last_name}'
        dni = f'{10000000 + idx}'
        dob = (datetime.date.today() - datetime.timedelta(days=7300 + idx)).isoformat()
        phone = f'999{idx:07d}'[-10:]
        email = f'{first_name.lower()}.{last_name.lower()}{idx}@demo.local'
        sex = random.choice(SEXES)
        blood_type = random.choice(BLOOD_TYPES)
        allergies = random.choice(ALLERGIES)
        status = 'active'
        mrn = f'HC-{tenant_id:02d}-{idx:04d}'
        c.execute(
            '''INSERT INTO patients (tenant_id, full_name, dni, date_of_birth, phone, email, sex, blood_type, allergies, status, medical_record_number, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (tenant_id, full_name, dni, dob, phone, email, sex, blood_type, allergies, status, mrn, now_iso())
        )
    conn.commit()


def ensure_alerts(conn, tenant_id, target_count=100):
    c = conn.cursor()
    current_count = c.execute('SELECT COUNT(*) FROM alerts WHERE tenant_id = ?', (tenant_id,)).fetchone()[0]
    if current_count >= target_count:
        return

    device_ids = [row[0] for row in c.execute('SELECT id FROM devices WHERE tenant_id = ?', (tenant_id,)).fetchall()]
    user_ids = [row[0] for row in c.execute('SELECT id FROM users WHERE tenant_id = ?', (tenant_id,)).fetchall()]
    if not device_ids or not user_ids:
        return

    for idx in range(current_count + 1, target_count + 1):
        device_id = random.choice(device_ids)
        user_id = random.choice(user_ids)
        alert_type = random.choice(ALERT_TYPES)
        severity = random.choice(ALERT_SEVERITIES)
        message = f'Alerta {alert_type} detectada en dispositivo {device_id}'
        created_at = now_iso()
        is_resolved = 1 if idx % 3 == 0 else 0
        resolved_at = created_at if is_resolved else None
        c.execute(
            '''INSERT INTO alerts (tenant_id, device_id, user_id, alert_type, message, severity, is_resolved, created_at, resolved_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (tenant_id, device_id, user_id, alert_type, message, severity, is_resolved, created_at, resolved_at)
        )
    conn.commit()


def ensure_metrics(conn, tenant_id, target_count=100):
    c = conn.cursor()
    current_count = c.execute('SELECT COUNT(*) FROM metrics WHERE tenant_id = ?', (tenant_id,)).fetchone()[0]
    if current_count >= target_count:
        return

    device_ids = [row[0] for row in c.execute('SELECT id FROM devices WHERE tenant_id = ?', (tenant_id,)).fetchall()]
    if not device_ids:
        return

    for idx in range(current_count + 1, target_count + 1):
        device_id = random.choice(device_ids)
        metric_type, unit = random.choice(METRIC_TYPES)
        value = round(random.uniform(10, 100), 2) if unit == '%' else round(random.uniform(20, 120), 2)
        recorded_at = now_iso()
        c.execute(
            'INSERT INTO metrics (tenant_id, device_id, metric_type, value, unit, recorded_at) VALUES (?, ?, ?, ?, ?, ?)',
            (tenant_id, device_id, metric_type, value, unit, recorded_at)
        )
    conn.commit()


def ensure_consultations(conn, tenant_id, target_count=100):
    c = conn.cursor()
    current_count = c.execute('SELECT COUNT(*) FROM consultations WHERE tenant_id = ?', (tenant_id,)).fetchone()[0]
    if current_count >= target_count:
        return

    patient_ids = [row[0] for row in c.execute('SELECT id FROM patients WHERE tenant_id = ?', (tenant_id,)).fetchall()]
    if not patient_ids:
        return

    for idx in range(current_count + 1, target_count + 1):
        patient_id = random.choice(patient_ids)
        doctor = f'Dr. {random.choice(LAST_NAMES)}'
        reason = f'Consulta de control {idx}'
        symptoms = 'Síntomas leves'
        diagnosis = 'Condición estable'
        treatment = 'Recomendaciones generales'
        prescription = 'Paracetamol 500mg'
        c.execute(
            '''INSERT INTO consultations (tenant_id, patient_id, doctor_name, reason, symptoms, diagnosis, treatment, prescription, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (tenant_id, patient_id, doctor, reason, symptoms, diagnosis, treatment, prescription, now_iso())
        )
    conn.commit()


def ensure_appointments(conn, tenant_id, target_count=100):
    c = conn.cursor()
    current_count = c.execute('SELECT COUNT(*) FROM appointments WHERE tenant_id = ?', (tenant_id,)).fetchone()[0]
    if current_count >= target_count:
        return

    patient_ids = [row[0] for row in c.execute('SELECT id FROM patients WHERE tenant_id = ?', (tenant_id,)).fetchall()]
    if not patient_ids:
        return

    for idx in range(current_count + 1, target_count + 1):
        patient_id = random.choice(patient_ids)
        doctor = f'Dr. {random.choice(LAST_NAMES)}'
        specialty = random.choice(SPECIALTIES)
        appointment_date = (datetime.date.today() + datetime.timedelta(days=idx % 30 + 1)).isoformat()
        status = 'scheduled' if idx % 4 != 0 else 'completed'
        notes = f'Cita programada en {specialty}'
        c.execute(
            '''INSERT INTO appointments (tenant_id, patient_id, doctor_name, specialty, appointment_date, status, notes, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            (tenant_id, patient_id, doctor, specialty, appointment_date, status, notes, now_iso())
        )
    conn.commit()


def ensure_documents(conn, tenant_id, target_count=100):
    c = conn.cursor()
    current_count = c.execute('SELECT COUNT(*) FROM documents WHERE tenant_id = ?', (tenant_id,)).fetchone()[0]
    if current_count >= target_count:
        return

    patient_ids = [row[0] for row in c.execute('SELECT id FROM patients WHERE tenant_id = ?', (tenant_id,)).fetchall()]
    if not patient_ids:
        return

    for idx in range(current_count + 1, target_count + 1):
        patient_id = random.choice(patient_ids)
        doc_type = random.choice(DOCUMENT_TYPES)
        file_name = f'{doc_type}_{idx:03d}.pdf'
        file_url = f'https://example.com/docs/{file_name}'
        description = f'Documento de tipo {doc_type} para el paciente {patient_id}'
        status = 'uploaded' if idx % 5 != 0 else 'archived'
        c.execute(
            '''INSERT INTO documents (tenant_id, patient_id, document_type, file_name, file_url, description, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            (tenant_id, patient_id, doc_type, file_name, file_url, description, status, now_iso())
        )
    conn.commit()


def main():
    conn = sqlite3.connect(DB_PATH)
    tenant_id = ensure_tenant(conn)
    ensure_users(conn, tenant_id)
    ensure_locations(conn, tenant_id)
    ensure_devices(conn, tenant_id)
    ensure_patients(conn, tenant_id)
    ensure_alerts(conn, tenant_id)
    ensure_metrics(conn, tenant_id)
    ensure_consultations(conn, tenant_id)
    ensure_appointments(conn, tenant_id)
    ensure_documents(conn, tenant_id)
    conn.close()
    print('Seeded 100 records per module successfully.')


if __name__ == '__main__':
    main()
