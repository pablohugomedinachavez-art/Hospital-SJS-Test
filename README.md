# Hospital-SJS-Test

Prueba de funcionamiento para programa de gestión de personal y pacientes para el Hospital San José.

## Descripción
Aplicación web conectada a Supabase para controlar acceso, usuarios y roles.

## Funcionalidades actuales
- Login por usuario y contraseña usando la tabla `users` de Supabase
- Manejo de credenciales por variables de entorno
- Configuración dinámica de Supabase en el servidor local

## Instrucciones
1. Inicia el servidor de configuración:

```powershell
& 'C:\Users\itomc\AppData\Local\Programs\Python\Python312\python.exe' server.py
```

2. Abre la app en el navegador:

```text
http://localhost:3000
```

## Tabla `users` en Supabase
Se recomienda crear la tabla `users` en Supabase con los campos:
- `id` (uuid)
- `username` (text, único)
- `password` (text)
- `role` (text)
- `full_name` (text)
- `email` (text)
- `phone` (text)
- `created_at` (timestamptz)

## Nota
Para producción, utiliza hashes seguros en lugar de contraseñas en texto plano.

