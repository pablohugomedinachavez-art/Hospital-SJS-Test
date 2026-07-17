# Supabase users table design

Esta tabla es necesaria para el login del frontend y el control de roles.

## Estructura `public.users`

- `id`: uuid, primary key, `default uuid_generate_v4()`
- `username`: text, not null, unique
- `password`: text, not null
- `role`: text, not null
- `full_name`: text
- `email`: text
- `phone`: text
- `created_at`: timestamptz, not null, `default now()`

## SQL para crear tabla

```sql
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  username text not null unique,
  password text not null,
  role text not null,
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);
```

## SQL de ejemplo para insertar usuarios

```sql
insert into public.users (username, password, role, full_name, email, phone) values
  ('developer', 'dev123', 'developer', 'Desarrollador Admin', 'dev@hospital.com', '+123456789'),
  ('doctor', 'doc123', 'doctor', 'Dr. Médico', 'doctor@hospital.com', '+987654321'),
  ('reception', 'rec123', 'reception', 'Recepcionista', 'rec@hospital.com', '+555123456'),
  ('nurse', 'nur123', 'nurse', 'Enfermera', 'nurse@hospital.com', '+555987654');
```

## Notas

- Para producción, usa hash de contraseñas en lugar de texto plano.
- Asegúrate que la tabla exista en Supabase antes de probar el login.
