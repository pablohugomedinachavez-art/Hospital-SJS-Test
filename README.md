# Proyecto TIC Hospitalario

Aplicación funcional orientada a la gestión hospitalaria con autenticación JWT, base de datos local SQLite y flujo operativo para pacientes, consultas, citas, documentos y reportes.

## Qué incluye
- Backend Flask con API `/api/*`
- Autenticación con login/register y roles JWT
- Gestión de usuarios, tenants, ubicaciones, dispositivos, alertas y métricas
- Gestión de pacientes, historias clínicas, consultas, citas, documentos y auditoría
- Frontend React + Vite con panel de control y módulos operativos
- Datos provisionales cargados automáticamente para demo

## Estructura
- `backend/` - servidor Flask y base de datos local `hospital.db` (SQLite)
- `frontend/` - React + Vite
- `database/` - esquema SQL para la base de datos y futuras migraciones

> Nota: esta implementación está pensada para un despliegue local con SQLite. El frontend consume la API local en `/api`, y no requiere Supabase en tiempo de ejecución.

## Instrucciones locales

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

El backend escuchará en `http://127.0.0.1:5000`.

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

El frontend se abrirá en `http://127.0.0.1:5173` y usará proxy hacia la API en `http://127.0.0.1:5000`.

### 3. Producción

```powershell
cd frontend
npm run build
python ..\backend\app.py
```

Luego abre `http://127.0.0.1:5000`.

## Credenciales de demo
- Usuario: `admin`
- Contraseña: `Admin123!`

## Base de datos
La aplicación crea `backend/hospital.db` y carga datos provisionales al iniciarse.

El esquema actualizado se encuentra en `database/intercomunicador_database_schema.sql`.
