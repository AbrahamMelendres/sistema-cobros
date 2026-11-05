# Sistema de Registro de Cobros
Academia Técnica de Ingeniería y Tecnologías Informáticas

Sistema privado (con login) para registrar cobros diarios de reparación de equipos (Pc / Laptop) y ver un informe general en vivo.

## Stack
- **Frontend + Backend:** Next.js 15.5 (App Router)
- **Base de datos + Auth:** Supabase (Postgres + Auth + Row Level Security + Realtime)
- **Deploy:** Vercel

## Desarrollo local

```bash
npm install
npm run dev
```

Abre http://localhost:3000 — te redirige a `/login`.

Configura `.env.local` en la raíz del proyecto con las credenciales del proyecto Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-publica
SUPABASE_SERVICE_ROLE_KEY=tu-clave-secreta-de-servidor
```

La clave `SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor. No la compartas ni la incluyas en código del navegador. Los archivos `.env*` están ignorados por Git.

Para producción, primero genera el build y luego inicia el servidor:

```bash
npm run build
npm start
```

## Usuarios
Los administradores pueden gestionar cuentas desde **Caja → Usuarios**. Asigna a cada persona el rol mínimo que necesite. No guardes contraseñas ni credenciales de prueba en este repositorio.

## Desplegar en Vercel

1. Sube este proyecto a un repositorio de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New Project** → importa el repo (detecta Next.js automáticamente).
3. En **Environment Variables**, configura las tres variables descritas arriba para cada entorno. La clave secreta debe quedar como variable de servidor, nunca con prefijo `NEXT_PUBLIC_`.
4. Despliega. Cada push a la rama configurada puede iniciar un nuevo despliegue.

## Base de datos

- `supabase/schema.sql` contiene el esquema base de cobros y perfiles; no representa por sí solo todos los módulos y políticas actuales.
- Revisa y aplica las migraciones de `supabase/migrations/` en el proyecto correcto antes de depender de funciones como roles y bitácora.
- La bitácora empieza a registrar cambios después de aplicar su migración; no crea historial retroactivo.

## Estructura
```
src/
  app/
    login/              -> pantalla de inicio de sesión
    (protected)/        -> páginas que requieren sesión
    api/admin/          -> operaciones de administración de usuarios
  components/          -> formularios, caja, informes y bitácora
  lib/
    supabase/           -> clientes de Supabase (navegador, servidor y middleware)
    types.ts            -> tipos compartidos
  proxy.ts              -> actualiza/verifica la sesión
supabase/
  migrations/           -> cambios versionados de base de datos
public/
  logo.jpeg             -> escudo de la Academia Técnica
```
