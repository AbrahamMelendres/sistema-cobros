# Sistema de Registro de Cobros
Academia Técnica de Ingeniería y Tecnologías Informáticas

Sistema privado (con login) para registrar cobros diarios de reparación de equipos (Pc / Laptop) y ver un informe general en vivo.

## Stack
- **Frontend + Backend:** Next.js 16 (App Router)
- **Base de datos + Auth:** Supabase (Postgres + Auth + Row Level Security + Realtime)
- **Deploy:** Vercel

## Proyecto de Supabase
Ya está creado y configurado: `sistema-cobros` (ID `cxhejiygwmxvneicermw`).
- Tabla `registros`: los cobros diarios.
- Tabla `profiles`: nombre completo asociado a cada usuario de login.
- RLS activado: solo usuarios autenticados pueden leer/escribir.
- Realtime activado en `registros` (el informe se actualiza solo).

El esquema completo está en `supabase/schema.sql` (ya aplicado, es solo referencia).

## Desarrollo local

```bash
npm install
npm run dev
```

Abre http://localhost:3000 — te redirige a `/login`.

Las variables de entorno ya están en `.env.local` (URL y clave pública/anon de Supabase — son seguras de exponer en el frontend, no dan acceso administrativo).

## Usuarios
Para crear un nuevo usuario (otra recepcionista):
1. Panel de Supabase → Authentication → Users → **Add user** → Create new user.
2. Activa "Auto Confirm User".
3. Copia su UID y ejecuta en el SQL Editor de Supabase:
   ```sql
   insert into public.profiles (id, nombre_completo)
   values ('<uid-del-usuario>', 'Nombre Completo');
   ```

**Usuario ya creado:**
- Email: `maya.calderon@academiatecnica.local`
- Contraseña temporal: `Maya2026Cobros!` (cámbiala después de tu primer ingreso, desde Authentication → Users → editar usuario, en el panel de Supabase)

## Desplegar en Vercel

1. Sube este proyecto a un repositorio de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New Project** → importa el repo (detecta Next.js automáticamente).
3. En **Environment Variables**, agrega:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://cxhejiygwmxvneicermw.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (la que está en tu `.env.local`)
4. Deploy. Cada push a `main` vuelve a desplegar automáticamente.

## Estructura
```
src/
  app/
    login/            -> pantalla de inicio de sesión
    (protected)/
      dia/             -> registro de cobros por día (tabla editable)
      informe/         -> dashboard en vivo (totales, por día)
  components/          -> Navbar, RegistroDia, InformeDashboard
  lib/
    supabase/          -> clientes de Supabase (browser, server, middleware)
    types.ts           -> tipos de datos de "registros"
  proxy.ts              -> protege rutas: si no hay sesión, redirige a /login
public/
  logo.jpeg            -> escudo de la Academia Técnica
```
