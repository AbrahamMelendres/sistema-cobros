# Auditoría del sistema

**Fecha:** 2026-11-05
**Alcance:** revisión estática del repositorio (Next.js, rutas API, documentación, políticas SQL y migraciones). No se accedió a Supabase ni se verificó la configuración desplegada.

## Resumen

El proyecto separa los clientes de Supabase de servidor y navegador, protege las operaciones de administración con una verificación del rol y tiene una migración de roles con políticas más restrictivas. Sin embargo, la documentación/esquema base no está alineada con ese modelo y se encontró una credencial incluida en el README. No se debe asumir que la configuración de producción coincide con las migraciones del repositorio.

## Hallazgos

| Prioridad | Hallazgo | Evidencia | Recomendación |
|---|---|---|---|
| Alta | El README contenía una credencial de acceso de ejemplo. Se retiró de la versión actual del documento, pero una eliminación no borra el dato del historial Git anterior. | `README.md` (sección de usuarios, antes de esta auditoría) | Si la credencial aún funciona, cámbiala y revoca sesiones. Si el repositorio tuvo acceso público, considera que el valor ya fue expuesto; limpiar el historial requiere una operación coordinada con todos los colaboradores. |
| Alta | El esquema base permite a cualquier usuario autenticado insertar, actualizar y borrar cualquier fila de `registros`. La migración de roles reemplaza esas políticas, pero ejecutar solo el esquema base deja permisos más amplios. | `supabase/schema.sql` (políticas RLS de `registros`); `supabase/migrations/20260923_roles_usuario_rls.sql` (políticas por rol) | Unificar la instalación y las migraciones. Verificar en Supabase que `pg_policies` contiene las políticas por rol esperadas y que no sobreviven políticas permisivas antiguas. |
| Media | Los roles autenticados pueden leer todos los registros, movimientos, pendientes y movimientos de custodia. Los registros incluyen datos personales como CI y teléfono; el rol de consulta también recibe ese acceso según las políticas revisadas. | `supabase/migrations/20260923_roles_usuario_rls.sql` (políticas `*_select_autenticados`); `supabase/schema.sql` | Confirmar que esta visibilidad completa es intencional. Limitar campos o filas por rol si personal de consulta no necesita esos datos. |
| Media | No están versionadas las definiciones de `vista_resumen_caja` ni `vista_dinero_por_responsable`, así que no se pudo auditar su fórmula. En una captura compartida, el saldo neto parecía no coincidir con saldo actual menos pendientes. | `src/components/CajaResumen.tsx`; solo hay ajustes de seguridad de vistas en la migración de roles | Añadir las definiciones de las vistas a migraciones revisables y comparar el resultado con movimientos reales en Supabase antes de modificar saldos. |
| Media | No hay un script ni archivos de pruebas automatizadas en el repositorio; `npm run build` verifica compilación y tipos, pero no prueba reglas financieras, roles ni RLS. | `package.json` y `src/` | Añadir pruebas para cálculos de caja, permisos por rol, eliminación y exportación; ejecutar pruebas de políticas contra una base de prueba. |
| Media | Parte de la documentación estaba desactualizada: indicaba Next.js 16 aunque el manifiesto fija Next.js 15.5.25, describía solo variables públicas y tenía instrucciones de usuarios que no reflejaban el flujo de roles actual. La documentación se actualizó durante esta auditoría; las instrucciones SQL de instalación todavía requieren validación contra un Supabase nuevo. | `README.md`, `package.json`, `supabase/schema.sql` y `supabase/migrations/` | Mantener un procedimiento único de instalación con orden de migraciones y validar ese procedimiento en un proyecto Supabase de prueba. |
| Baja | La API de administración solicita como máximo 1.000 usuarios en una sola página; no contempla paginación para instalaciones con más usuarios. | `src/app/api/admin/usuarios/route.ts` | Implementar paginación si se espera superar ese volumen. |
| Baja | Next.js detecta varios `package-lock.json` en carpetas padre y advierte que puede inferir mal la raíz de tracing. No impidió el build local. | Salida de `npm run build` | Definir `outputFileTracingRoot` en la configuración de Next.js o revisar cuál lockfile externo corresponde al entorno de desarrollo. |

## Controles observados

- Las rutas API de administración verifican la sesión y el rol antes de usar funciones administrativas de Supabase.
- La clave de servicio se lee desde una variable de servidor y `.env` está ignorado por Git; no se encontró ningún archivo `.env` rastreado.
- La migración de roles restringe escritura y eliminación de movimientos financieros a administradores, mientras deja operaciones diarias a roles autorizados.
- La nueva migración de bitácora registra acciones/campos modificados sin almacenar los valores anteriores o nuevos. Su existencia en el repositorio no confirma que haya sido aplicada al proyecto remoto.

## Validación realizada

- `npm run build`: correcto.
- `npm run lint`: correcto después de excluir artefactos generados de Next.js en `eslint.config.mjs`.
- `git diff --check`: correcto.
- No se ejecutaron pruebas contra la base de datos real ni se verificó el estado de las migraciones remotas.

## Prioridades recomendadas

1. Rotar la credencial retirada del README si todavía está activa.
2. Confirmar las políticas RLS reales del proyecto de producción y cerrar la discrepancia con `schema.sql`.
3. Revisar y versionar las definiciones de las vistas que calculan saldos.
4. Añadir pruebas automatizadas de cálculos, permisos y flujos financieros.
