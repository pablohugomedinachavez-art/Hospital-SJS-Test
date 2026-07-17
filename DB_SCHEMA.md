# Diseño de la base de datos para Hospital San Jose

## Tablas principales

### users
- id: uuid (primary key)
- username: text (unique)
- password: text
- role: text
- full_name: text
- email: text
- phone: text
- created_at: timestamptz (default now())

### patients
- id: uuid (primary key)
- full_name: text
- email: text
- phone: text
- document_id: text
- birth_date: date
- address: text
- medical_history: text
- notes: text
- created_at: timestamptz (default now())

### staff
- id: uuid (primary key)
- user_id: uuid (foreign key users.id)
- position: text
- department: text
- shift: text
- status: text
- created_at: timestamptz (default now())

### appointments
- id: uuid (primary key)
- patient_id: uuid (foreign key patients.id)
- doctor_id: uuid (foreign key staff.id)
- scheduled_at: timestamptz
- status: text
- notes: text
- created_at: timestamptz (default now())

### reports
- id: uuid (primary key)
- report_type: text
- created_by: uuid (foreign key users.id)
- details: text
- created_at: timestamptz (default now())

## Reglas RLS y permisos

Para pruebas simples, puedes empezar con políticas públicas en la tabla `users` y luego restringir por rol:
- developer: full access
- doctor: access a `patients` y `appointments`
- reception: access a `appointments`
- nurse: access a `patients`

## Notas

- Asegúrate de que la tabla `users` tenga el campo `role` para determinar los módulos disponibles.
- En Supabase, crea las tablas con `uuid_generate_v4()` si usas UUID.
- Para producción, reemplaza el campo `password` con hashes seguros.
