# PLAN-PROYECTO-TIC

Plan de acción exhaustivo para replicar y desplegar el proyecto TIC Hospitalario adaptado a:
- Deploy frontend: Vercel
- Base de datos y Auth: Supabase (PostgreSQL)
- Código fuente y versionado: GitHub

Este documento detalla paso a paso instalaciones, configuraciones previas, procedimientos operativos, migraciones, seguridad, manejo de errores, pruebas, monitoreo y tareas de mantenimiento.

**Nota**: No se incluye desarrollo de código en este documento; se describen procedimientos para que el equipo aplique/configure y despliegue el sistema.

---

**Resumen de recursos**
- Repositorio GitHub: `https://github.com/practicashospitalsj-afk/TrabajosPracticasHSJ.git`
- Archivo de esquema : `intercomunicador_database_schema.sql`
- Proyecto Supabase: 3 entornos recomendados(super importante) `dev`, `staging`, `prod`
- Proyecto Vercel: 3 proyectos corresondientes (super importante)`dev`, `staging`, `prod`
---

**Parte 0 — Pre-requisitos (instalaciones previas)**

Instalar en la máquina local (o en CI donde proceda):

- Git
  - Verificar: `git --version`
- Node.js (LTS, recomendado >=18)
  - Verificar: `node --version` y `npm --version` o `yarn --version`
- Supabase CLI
  - Instalar: `npm install -g supabase` (o `brew install supabase/tap/supabase-cli` en mac)
  - Verificar: `supabase --version`
- Vercel CLI
  - Instalar: `npm install -g vercel`
  - Verificar: `vercel --version`
- GitHub CLI (opcional, para automatizar repo): `gh auth login` y `gh repo create`
- psql o pgAdmin (para interacción directa con la DB):
  - Verificar: `psql --version`
- (Opcional) Sentry CLI si se usa Sentry para errores

Recomendación de cuentas y permisos:
- Cuenta GitHub con acceso a la organización/proyecto y privilegios para crear repositorios y secrets.
- Cuenta Vercel ligada a GitHub para integraciones automáticas.
- Cuenta Supabase con privilegios de administrador (creación de proyectos y claves).

---

**Parte 1 — Estructura del repositorio (configuración inicial)**

1. Crear repositorio en GitHub `proyecto-ticHospitalario` con plantilla mínima.
2. Estructura sugerida de carpetas:
   - `/frontend` (React/Vite)
   - `/backend` (si se usa serverless o funciones; pueden ser funciones de Vercel)
   - `/infra` (scripts, terraform si se desea infra-as-code)
   - `/database` (migrations, seeds, `intercomunicador_database_schema.sql`)
   - `/docs` (documentación operativa y este plan)
3. Añadir archivos básicos:
   - `.gitignore`
   - `README.md` con instrucciones rápidas
   - `CODEOWNERS`, `CONTRIBUTING.md` si procede
4. Proteger la rama `main`: requerir PRs aprobados y checks (CI).

Comandos mínimos para iniciar localmente:

```bash
git init
git remote add origin git@github.com:<org>/proyecto-ticHospitalario.git
git checkout -b develop
mkdir frontend backend infra database docs
git add .
git commit -m "init: estructura del repo"
git push -u origin develop
```

---

**Parte 2 — Creación y configuración de proyectos Supabase**

1. Crear un proyecto Supabase por entorno (dev/staging/prod). Cada proyecto crea una base Postgres gestionada.
2. Obtener claves y endpoints:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (solo para operaciones públicas limitadas)
   - `SUPABASE_SERVICE_ROLE_KEY` (clave secreta para tareas administrativas y migraciones)
3. Recomendaciones de red y seguridad:
   - Limitar IPs que pueden acceder al panel si es posible.
   - Habilitar backups automáticos y configurar política de retención.
4. Configurar Auth providers si los necesitan (correo/contraseña, OAuth providers).

Carga del esquema SQL:

- Opción A — Editor SQL de Supabase: pegar y ejecutar el contenido de `intercomunicador_database_schema.sql`.
- Opción B — Supabase CLI / psql desde local/CI (recomendado para migraciones reproducibles):

```bash
# exportar variables (ejemplo en CI via secrets)
export SUPABASE_URL="https://xyz.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

# usar supabase db push (si usas migraciones de supabase)
supabase db push --project-ref <project-ref> --file ./database/intercomunicador_database_schema.sql

# o con psql
psql "postgresql://postgres:<password>@db.<host>:5432/postgres" -f ./database/intercomunicador_database_schema.sql
```

Migraciones:
- Mantener las migraciones versionadas en `/database/migrations`.
- Usar un sistema sencillo: archivos `V001__init.sql`, `V002__add_indexes.sql`, etc.
- Ejecutar migraciones desde CI antes de desplegar cambios que dependan de ellas.

---

**Parte 3 — Auth, Claims y Row Level Security (RLS)**

Objetivo: cada usuario sólo puede ver/alterar datos de su `tenant_id` y sólo según su `role`.

1. Modelado de claims:
   - Cuando un usuario inicia sesión, el token JWT debe incluir `tenant_id` y `role` en sus claims.
   - Supabase Auth permite hook de `jwt` customization (con funciones edge o generador en backend) o usar `service_role` para asignar claims durante registro.
2. Habilitar RLS en tablas sensibles: `users`, `devices`, `locations`, `alerts`, `metrics`, etc.

Ejemplo de policy RLS (SQL) para la tabla `devices`:

```sql
-- permitir SELECT a un usuario si tenant_id coincide con el claim
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_devices_tenant" ON devices
FOR SELECT
USING (tenant_id = current_setting('request.jwt.claims.tenant_id')::integer);

CREATE POLICY "insert_devices_tenant" ON devices
FOR INSERT
WITH CHECK (tenant_id = current_setting('request.jwt.claims.tenant_id')::integer);
```

Políticas por rol (ejemplo):
- `tenant_admin`: puede SELECT/INSERT/UPDATE/DELETE donde `tenant_id = claim`.
- `staff`: puede SELECT/INSERT (limitado), no DELETE.
- `viewer`: solo SELECT.

Asegurar que las funciones server-side que usan `service_role` no quiebren RLS (usar `auth.uid()` y claims correctamente en las funciones o seteos de session).

---

**Parte 4 — Variables de entorno y configuración en Vercel**

Variables mínimas por proyecto Vercel (dev/staging/prod):

- `SUPABASE_URL` = https://<project>.supabase.co
- `SUPABASE_ANON_KEY` = <anon-key>
- `SUPABASE_SERVICE_ROLE_KEY` = <service-role-key> (guardar como secret en Vercel, uso limitado)
- `NODE_ENV` = production/staging/development
- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` si frontend necesita acceso cliente
- `SENTRY_DSN` (si aplica)
- `JWT_SECRET` (si el back necesita firmar tokens propios)

En Vercel: configurar variables en Settings → Environment Variables, y marcar `Encrypted`.
Conectar el proyecto Vercel al repo GitHub para despliegues mediante push a ramas configuradas.

---

**Parte 5 — CI/CD (GitHub Actions) y migraciones**

Propuesta de flujo:
- `pull_request` → ejecutar linters y tests unitarios (frontend y backend), construir artefactos.
- `push` a `develop` → desplegar a Vercel `dev` (preview), ejecutar migraciones `supabase db push --project-ref` usando `SUPABASE_SERVICE_ROLE_KEY` almacenada en secrets.
- `merge` a `main` → despliegue a `prod` en Vercel y ejecución de migraciones contra `prod` (con confirmación manual si se desea).

Ejemplo mínimo de job que aplica migraciones:

```yaml
jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Install supabase CLI
        run: npm install -g supabase
      - name: Apply migrations
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          supabase db push --project-ref ${{ secrets.SUPABASE_PROJECT_REF }} --file ./database/intercomunicador_database_schema.sql
```

Añadir revisión humana para migraciones destructivas.

---

**Parte 6 — Manejo de errores (arquitectura y prácticas)**

1. Convenciones de error:
   - Usar objetos de error con `code`, `message`, `details`, `trace_id`.
   - Mapear errores a HTTP codes: 400/401/403/404/409/500.
2. Logging centralizado:
   - Registrar errores críticos en Sentry o similar.
   - Mantener logs de acceso y auditoría en Supabase (audit table) para acciones CRUD sensibles.
3. Retries y backoff:
   - Implementar reintentos exponenciales para llamadas a servicios externos (máx 3 intentos).
   - Usar idempotency keys para operaciones que podrían reintentarse (ej. crear alerta).
4. Circuit-breaker:
   - Monitorear fallos repetidos a un servicio externo y abrir circuito (p. ej. si 5 fallos en 1 minuto), con reintento programado a intervalos.
5. Manejo en DB:
   - Validaciones estrictas (CHECK constraints, FK, UNIQUE). Capturar violaciones y mapear a errores legibles.
   - Tabla `error_reports` para registrar fallos no fatales con metadata (tenant_id, user_id, payload, error, created_at).

SQL ejemplo para `error_reports`:

```sql
CREATE TABLE error_reports (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER,
  user_id INTEGER,
  context TEXT,
  error_message TEXT,
  error_code TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

6. Alertas y notificaciones:
   - Integrar alertas (Slack, email) para errores 5xx críticos o cuando la tasa de errores exceda umbral.

---

**Parte 7 — Seeds, datos de ejemplo y pruebas de integración**

1. Crear seeds en `/database/seeds/` para:
   - Tenants de prueba
   - Roles y permisos base (`super_admin`, `tenant_admin`, `staff`, `viewer`)
   - Usuarios de prueba con hashed passwords (o crear via Supabase Auth flows)
   - Algunos dispositivos, ubicaciones, métricas y alertas
2. Procedimiento para ejecutar seeds:

```bash
# ejecutar SQL de seeds contra el proyecto dev
psql "${SUPABASE_DB_URL}" -f ./database/seeds/seed_tenants.sql
```

3. Validar RLS y permisos con cuentas de prueba (login y comprobar queries).

---

**Parte 8 — Backup, restore y mantenimiento operativo**

1. Backups:
   - Usar backups automáticos de Supabase y configurar retención.
   - Exportar snapshots periódicos con `pg_dump` para retención adicional.
2. Restore:
   - Probar restauración en un entorno `staging` al menos cada mes.
3. Mantenimiento:
   - Programar `VACUUM ANALYZE` y `REINDEX` según tamaño de tablas.
   - Monitorear tablas grandes: `metrics` y `alerts` crecerán rápido; particionar por fecha si necesario.

Comando de exportación básica:

```bash
pg_dump -h <host> -U <user> -Fc -d <db> -f backup-$(date +%F).dump
# restore
pg_restore -h <host> -U <user> -d <db> backup-file.dump
```

---

**Parte 9 — Monitoreo y alertas**

- Habilitar logs y métricas en Vercel y Supabase (requests, errors, latencia).
- Integrar Sentry para tracking de errores de aplicación.
- Crear alertas Slack/Email cuando:
  - Errores 5xx > X por minuto
  - Tiempo de respuesta > Y ms
  - Fallos de migración o backup

---

**Parte 10 — Checklist de release (producción)**

1. Tests: unitarios, integración y E2E pasan en CI.
2. Migraciones aplicadas en `staging` y validadas. Backup tomado antes de migrar `prod`.
3. Variables de entorno en Vercel `prod` configuradas y secretas.
4. RLS y policies validadas con cuentas de `tenant_admin` y `viewer`.
5. Monitorización y alertas configuradas.
6. Procedimiento de rollback probado.

---

**Parte 11 — Procedimientos de rollback y recuperación**

- Si una migración rompe producción:
  1. Revertir la migración si es reversible (ejecutar SQL de down). Si no reversible: restaurar snapshot.
  2. Poner el servicio en modo mantenimiento (mensaje estático en Vercel o feature flag).
  3. Restaurar base de datos desde backup a un entorno staging y aplicar fixes.
  4. Promover cambios probados a prod.

---

**Parte 12 — Documentación operativa y traspaso**

- Mantener en `/docs`:
  - `README-deploy.md` con comandos paso a paso.
  - `RUNBOOK.md` con acciones ante incidentes (cómo restaurar, cómo rotar claves, cómo deshabilitar RLS temporalmente).
  - `DB-MIGRATIONS.md` con convenciones de nombres y cómo versionar.

---

**Anexos: ejemplos SQL útiles**

1) Crear rol base y seeds de roles:

```sql
INSERT INTO roles (tenant_id, name, description, is_system_role)
VALUES (1, 'tenant_admin', 'Administrador del tenant', true),
       (1, 'staff', 'Personal operativo', true),
       (1, 'viewer', 'Solo lectura', true);
```

2) Política RLS ejemplo completa para `locations`:

```sql
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locations_select_tenant" ON locations
FOR SELECT
USING (tenant_id = current_setting('request.jwt.claims.tenant_id')::integer);

CREATE POLICY "locations_insert_tenant" ON locations
FOR INSERT
WITH CHECK (tenant_id = current_setting('request.jwt.claims.tenant_id')::integer);
```

3) Tabla para errores operativos (ver sección manejo de errores):

```sql
CREATE TABLE error_reports (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER,
  user_id INTEGER,
  context TEXT,
  error_message TEXT,
  error_code TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

🏗️ Arquitectura híbrida con Supabase + Vercel

1. Entornos separados
- Supabase: tres proyectos (`dev`, `staging`, `prod`) para bases de datos y almacenamiento.

- Vercel: tres proyectos (`dev`, `staging`, `prod`) conectados a ramas distintas del repositorio.

Beneficio: aislamiento total entre entornos, evitando que datos sensibles de producción se mezclen con pruebas.

2. Datos activos (Postgres en Supabase)
Uso: fichas médicas recientes, citas, diagnósticos, tratamientos.

Optimización:
- Índices en campos críticos (`patient_id`, fecha, `doctor_id`, uids de sesión).
- Particionamiento por fechas (ej. `metrics`, `alerts`, `records`) para mejorar rendimiento y mantenimiento.

Acceso: consultas rápidas vía API de Supabase (o funciones serverless en Vercel que actúen como capa de negocio).

Seguridad:
- Row-Level Security (RLS) para restringir acceso por roles y `tenant_id`.
- Autenticación JWT/OAuth2 integrada con Supabase Auth.

3. Datos históricos comprimidos (Supabase Storage)
Uso: documentos clínicos completos (PDF, DICOM, imágenes, series históricas).

Formatos recomendados:
- Parquet/ORC → compresión columnar, ideales para análisis masivo.
- ZIP cifrado / AES-256 → para transmisión segura de documentos individuales.

Ciclo de vida:
- Activos → permanecen en la base de datos y Storage 6–12 meses.
- Históricos → movidos automáticamente a almacenamiento comprimido (parquet/zip) y etiquetados con metadatos (tenant, paciente, rango de fechas).
- Eliminación → solo conforme a la normativa aplicable; conservar según períodos legales.

4. Transmisión de datos
Proceso recomendado:
- Comprimir → cifrar → enviar → descomprimir → mostrar → eliminar copia temporal.

Notas:
- El archivo original permanece en Storage cifrado; nunca almacenar binarios grandes en Postgres.
- Usar enlaces presignados (signed URLs) con expiración corta para descargas desde frontend en Vercel.

5. Procesamiento analítico
Herramientas externas: Spark, DuckDB, BigQuery (según volumen y presupuesto).

Uso: estadísticas hospitalarias, investigación clínica, auditorías.

Ventaja: leer formatos columnares (Parquet/ORC) directamente para análisis sin descomprimir todos los archivos.

🔒 Seguridad y privacidad en Perú
1. Normativa aplicable
- Ley N° 29733 – Protección de Datos Personales.
- Ley General de Salud N° 26842.
- Directiva Administrativa N° 294-MINSA/2020/OGTI.
- ISO/IEC 27001:2022 (recomendada por MINSA).

2. Requisitos de seguridad
- Cifrado en reposo: AES-256 en Supabase Storage y discos gestionados.
- Cifrado en tránsito: TLS 1.3 en todas las comunicaciones (frontend↔Vercel↔Supabase).
- Autenticación: JWT/OAuth2, con posibilidad de integrar SSO hospitalario (SAML/OIDC) y MFA para roles críticos.
- Control de acceso: roles definidos (médico, enfermero, administrador, auditor) y políticas RLS.
- Auditoría: logs inmutables que registren accesos, modificaciones y transmisiones (retener según requisitos legales).

3. Privacidad y cumplimiento
- Principio de minimización: almacenar solo lo estrictamente necesario por propósito.
- Consentimiento informado: mecanismo para registrar y auditar consentimientos cuando aplique (investigación).
- Derecho de acceso y rectificación: flujos para que pacientes soliciten ver o corregir su información.
- Retención legal: historiales médicos conservados según plazos legales; no eliminar hasta que el periodo expire.

⚠️ Riesgos y mitigaciones
- Pérdida de datos al eliminar tras lectura → Mitigación: mantener copia cifrada en Storage y backups.
- Accesos no autorizados → Mitigación: RLS + cifrado + auditoría + MFA.
- Saturación de base de datos con data masiva → Mitigación: mover históricos a Storage comprimido y particionar tablas activas.
- Incumplimiento normativo → Mitigación: aplicar Directiva MINSA y Ley N° 29733; auditorías periódicas.

✅ Conclusión
La arquitectura híbrida con Supabase + Vercel es viable y robusta para un hospital en Perú:
- Supabase/Postgres para datos activos y consultas rápidas.
- Supabase Storage con compresión y cifrado para históricos y transmisión ligera.
- Vercel para frontend seguro y escalable, con entornos separados.

Cumplimiento legal y normativo puede alcanzarse aplicando la Directiva MINSA y la Ley de Protección de Datos Personales; la solución escala 4–5 años con cientos de entradas diarias si se aplica el ciclo de vida de datos y particionamiento.

📘 Manual Técnico Hospitalario (Documento 889)

1. Objetivo
Diseñar un sistema hospitalario que maneje data masiva (fichas médicas, documentos clínicos, imágenes DICOM, reportes) durante 4–5 años, con cientos de entradas diarias, garantizando:

- Escalabilidad
- Seguridad y privacidad
- Cumplimiento normativo peruano

2. Arquitectura General
2.1 Entornos
- Supabase: tres proyectos (`dev`, `staging`, `prod`) con Postgres y Storage.

- Vercel: tres proyectos (`dev`, `staging`, `prod`) conectados a ramas del repositorio.

Beneficio: aislamiento total entre entornos, evitando fugas de datos sensibles.

2.2 Datos activos (Supabase/Postgres)
Contenido: fichas médicas recientes, citas, diagnósticos, tratamientos.

Optimización: índices en `patient_id`, fecha, `doctor_id`; particionamiento por fechas.

Acceso: API de Supabase consumida por frontend en Vercel o por funciones serverless que actúen como capa de negocio.

Seguridad: Row-Level Security (RLS) y autenticación JWT/OAuth2.

2.3 Datos históricos comprimidos (Supabase Storage)
Contenido: documentos clínicos completos (PDF, DICOM, imágenes).

Formatos recomendados:
- Parquet/ORC para análisis masivo (compresión columnar).
- ZIP cifrado / AES-256 para transmisión segura.

Ciclo de vida:
- Activos: permanecen en la base 6–12 meses.
- Históricos: archivados en Storage comprimido y etiquetados con metadatos.
- Eliminación: conforme a normativa local.

2.4 Transmisión
Proceso: comprimir → cifrar → enviar → descomprimir → mostrar → eliminar copia temporal.

Nota: el archivo original permanece en almacenamiento seguro.

2.5 Procesamiento analítico
Herramientas: Spark, DuckDB, BigQuery.

Uso: estadísticas hospitalarias, investigación clínica y auditorías.

Ventaja: lectura directa de formatos comprimidos para análisis sin descompresión manual.

3. Seguridad y Privacidad
3.1 Normativa peruana
- Ley N° 29733 – Protección de Datos Personales.
- Ley General de Salud N° 26842.
- Directiva Administrativa N° 294-MINSA/2020/OGTI.

3.2 Estándares internacionales
- ISO/IEC 27001:2022 – gestión de seguridad de la información.

3.3 Requisitos técnicos
- Cifrado en reposo: AES-256 en Supabase Storage.
- Cifrado en tránsito: TLS 1.3 en todas las comunicaciones.
- Autenticación: JWT/OAuth2, con MFA para personal médico cuando proceda.
- Control de acceso: roles (médico, enfermero, administrador, auditor) y políticas RLS.
- Auditoría: logs inmutables que registren accesos y modificaciones.

3.4 Privacidad
- Principio de minimización: almacenar solo lo necesario.
- Consentimiento informado: registrar consentimiento para investigación.
- Derecho de acceso y rectificación: permitir que pacientes revisen y corrijan su información.
- Retención legal: conservar historiales según plazos legales.

4. Riesgos y Mitigaciones

Riesgo — Mitigación
- Pérdida de datos al eliminar tras lectura — Copia segura en almacenamiento comprimido y backups.
- Accesos no autorizados — RLS + cifrado + autenticación multifactor.
- Saturación de base de datos — Particionamiento + mover históricos a Storage comprimido.
- Incumplimiento normativo — Aplicar Directiva MINSA y auditorías periódicas.

5. Conclusión
La arquitectura híbrida Supabase + Vercel garantiza:
- Rendimiento y escalabilidad para cientos de entradas diarias.
- Seguridad y privacidad conforme a normativa peruana.
- Flexibilidad para análisis masivo con datos comprimidos.
- Estabilidad a largo plazo (4–5 años) con un ciclo de vida de datos bien definido.

---

**Correcciones aplicadas y checklist de inconsistencias detectadas**

He aplicado correcciones y añadido recomendaciones prácticas para evitar inconsistencias entre herramientas y metodologías. A continuación el resumen y acciones concretas incluidas en este plan:

- Backend vs Vercel:
  - Problema: el proyecto original usa microservicios Flask (Python); Vercel es optimizado para serverless Node/Edge.
  - Acción incluida: añadir una decisión de estrategia de backend (véase tarea 14 en TODO). Opciones: portar a Node/Supabase Edge Functions, mantener Flask en PaaS (Cloud Run/Render/Railway) o híbrido.

- Auth/RLS (patrón seguro):
  - Problema: no confiar en claims inyectados desde cliente; Supabase no permite inyectar arbitrariamente claims desde cliente.
  - Acción incluida: usar `profiles`/`users` table con `tenant_id` y `role`, y políticas RLS basadas en `auth.uid()` y joins. Ejemplo SQL añadido abajo.

- Uso de `SUPABASE_SERVICE_ROLE_KEY`:
  - Acción incluida: advertencia y política: `SERVICE_ROLE_KEY` nunca en frontend; disponible solo en CI/CD o backend seguro.

- Pipeline de procesamiento de binarios (DICOM, Parquet):
  - Acción incluida: recomendación de workers/ETL (Cloud Run / scheduled jobs / managed workers) y uso de Storage para históricos.

- Migraciones y CI:
  - Acción incluida: flujo recomendado en CI (dry-run → aprobación manual → apply) y ejemplos de GitHub Actions (tarea 18 completada).

- Políticas de retención y legal:
  - Acción incluida: ejemplos de retenciones y proceso de solicitud legal (tarea 17 completada).

- Estimación de costes y egress:
  - Acción incluida: nota para incluir estimación y alertas (tarea 19 creada).

Ejemplo RLS recomendado (patrón `profiles` + `auth.uid()`):

```sql
-- tabla profiles ligada a auth.users
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  tenant_id integer NOT NULL,
  role text NOT NULL,
  full_name text
);

-- ejemplo: habilitar RLS en devices
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_devices_for_tenant" ON devices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = devices.tenant_id
  )
);

CREATE POLICY "insert_devices_check_tenant" ON devices
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = NEW.tenant_id
  )
);
```

Ejemplo de flujo seguro de migraciones en CI (GitHub Actions, esquema):

```yaml
name: Migrations
on:
  workflow_dispatch:
  push:
    branches: [ develop ]

jobs:
  migration-plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Install supabase CLI
        run: npm install -g supabase
      - name: Dry-run migrations
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          supabase db diff --file=./database/intercomunicador_database_schema.sql || true

  migration-apply:
    needs: migration-plan
    if: github.event_name == 'workflow_dispatch' # manual approval for prod
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install supabase CLI
        run: npm install -g supabase
      - name: Apply migrations
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          supabase db push --file=./database/intercomunicador_database_schema.sql
```

Recomendaciones operativas rápidas (prioridad):
- No desplegar Flask directo en Vercel sin adaptación; elegir estrategia de backend (tarea 14).
- Mantener `SERVICE_ROLE_KEY` sólo en GitHub Secrets / backend seguro.
- Crear workers para tareas pesadas (DICOM → Parquet) fuera de Vercel.
- Implementar monitoreo de costos y políticas de archivado automático.

---

He actualizado la lista de tareas (`manage_todo_list`) con items de corrección y su estatus.

**Siguientes pasos sugeridos**
1. Revisar este plan y confirmar alcance (qué microservicios/funcionalidades exactas se migran a Vercel/Supabase).
2. Ejecutar la `Parte 0` en una máquina base y compartir resultados (versiones de herramientas y accesos a cuentas Supabase/Vercel/GitHub).
3. Aplicar la `Parte 1` y `Parte 2` para levantar el entorno `dev`.

---

Archivo generado: `PLAN-PROYECTO-TIC.md` (en la raíz del workspace).

