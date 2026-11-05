# Plan de pruebas QA — Registro de Cobros

## 1. Objetivo

Validar los flujos funcionales, transaccionales, de autorización y de presentación del sistema de Registro de Cobros, incluyendo el diseño móvil reciente. Las pruebas deben confirmar que los datos guardados en Supabase son correctos, que las operaciones fallidas informan el error y que usuarios sin permisos no pueden realizar cambios aunque intenten invocar la operación fuera de la interfaz.

## 2. Alcance

- Inicio/cierre de sesión y acceso a rutas protegidas.
- Roles: Administrador, Encargada y Consulta.
- Registro diario de cobros, edición, pago, entrega, búsqueda, importación y exportación.
- Movimientos manuales y carga rápida de caja; historial, eliminación y exportación.
- Resumen de caja y dinero por responsable.
- Pendientes y custodia dentro de Control de dinero.
- Catálogos, usuarios y bitácora administrativa.
- Informes de cobros e informes de caja.
- Navegación, presentación responsiva, impresión y errores de conectividad.

No se incluyen pruebas de penetración, carga de alto volumen ni validación contable legal. No ejecutar casos destructivos en producción.

## 3. Entorno y datos de prueba

### Entorno recomendado

- Ambiente de pruebas de Supabase separado de producción, con las migraciones vigentes aplicadas.
- Aplicación iniciada con configuración del ambiente de pruebas; nunca copiar credenciales al plan ni a capturas.
- Navegadores Chromium y Firefox actuales; Chrome/Edge en escritorio y viewport móvil de 390 × 844 o menor.
- Usuarios de prueba:
  - **QA-Admin:** rol Administrador.
  - **QA-Operador:** rol Encargada.
  - **QA-Lectura:** rol Consulta.
  - **QA-SinRol:** autenticado sin fila en `roles_usuario`.
- Catálogos activos: una actividad “QA Actividad A” y dos responsables “QA Responsable A/B”.
- Datos identificables con prefijo `QA-` para facilitar su localización y limpieza.

### Preparación financiera aislada

1. Anotar los saldos iniciales de las vistas de caja y custodia.
2. Crear registros de prueba con importes pequeños y conocidos; anotar sus IDs.
3. No borrar registros históricos ni modificar filas ajenas a la prueba.
4. Antes de probar resultados de saldo, obtener y revisar la definición desplegada de `vista_resumen_caja` y `vista_dinero_por_responsable`. El repositorio no contiene esas fórmulas.
5. Si la migración de bitácora no está aplicada, ejecutar sus pruebas como “bloqueadas por ambiente” y no confundirlo con una falla de interfaz.

## 4. Prioridad y severidad

- **P0 — Bloqueante:** pérdida/duplicación de dinero o acceso indebido a datos u operaciones.
- **P1 — Alta:** flujo principal de cobro, actualización o informe incorrecto.
- **P2 — Media:** navegación, filtros, exportación o presentación defectuosa con alternativa disponible.
- **P3 — Baja:** detalle visual sin impacto funcional.

## 5. Casos de prueba

### A. Acceso, sesión y roles

| ID | Pri. | Caso y pasos | Resultado esperado |
|---|---|---|---|
| AUTH-01 | P0 | Abrir `/dia` sin sesión. | Redirección a `/login`; no se muestra contenido protegido. |
| AUTH-02 | P1 | Iniciar sesión con cada usuario de prueba y navegar por Caja, Informes y Nosotros. | Usuario autenticado accede a las rutas habilitadas; la sesión se conserva al recargar. |
| AUTH-03 | P1 | Cerrar sesión y usar Atrás/recargar una ruta protegida. | Sesión terminada y acceso protegido denegado. |
| AUTH-04 | P0 | Como Consulta, intentar crear/editar/eliminar registros mediante interfaz y petición autenticada directa. | La interfaz no ofrece acciones restringidas y RLS deniega cualquier escritura no permitida. |
| AUTH-05 | P0 | Como Encargada, crear/actualizar un registro diario, movimiento y pendiente; intentar borrar registro o movimiento financiero, administrar usuarios/catálogos y escribir custodia. | Se permiten solo operaciones operativas previstas; las restringidas son rechazadas también por Supabase. |
| AUTH-06 | P0 | Como Administrador, invitar usuario, cambiar rol y eliminar un usuario distinto al actual; intentar eliminar la propia cuenta. | Cambios permitidos con confirmación/mensajes; no puede eliminarse a sí mismo. Verificar resultado en Auth/roles. |
| AUTH-07 | P1 | Abrir `/caja/pendientes` y `/caja/custodia`; después cambiar entre pestañas desde `/caja/control-dinero`. | Rutas antiguas redirigen a la pestaña correspondiente; selección de pestaña y URL permanecen sincronizadas. |

### B. Registro diario de cobros

| ID | Pri. | Caso y pasos | Resultado esperado |
|---|---|---|---|
| DIA-01 | P1 | Abrir Día en la fecha actual sin registros. | Estado vacío comprensible; fecha actual seleccionada; se puede crear el primer registro. |
| DIA-02 | P1 | Agregar registro, completar cliente, CI, celular, equipos/servicios y guardar por el flujo disponible. | Registro aparece una sola vez en la fecha seleccionada con número e importe esperados. |
| DIA-03 | P1 | Crear registros seguidos rápidamente, incluidos dos intentos concurrentes si el ambiente lo permite. | No se duplica el número por fecha; se conserva unicidad y el error de conflicto se trata claramente. |
| DIA-04 | P1 | Registrar diferentes servicios, tipo Pc/Laptop, más de un equipo y “Otros” con detalle. | Datos se conservan; el importe respeta la regla aprobada del negocio y el detalle requerido de “Otros” no queda vacío. |
| DIA-05 | P1 | Cambiar nombre, CI, teléfono, cantidad, método, servicio, pago, estado de entrega y observaciones; salir del campo y recargar. | Cada cambio persiste en la columna/campos correctos; no se pierden cambios por actualizar otro campo. |
| DIA-06 | P1 | Marcar pagado y luego pendiente; cambiar entrega entre Pendiente, Entregado y No recogido. | Estados y fechas de entrega concuerdan con la regla del producto; al revertir entrega se elimina o ajusta la fecha según regla aprobada. |
| DIA-07 | P1 | Buscar por nombre, CI, celular, número, servicio, método o estado; limpiar búsqueda y cambiar fecha. | Coincidencias correctas; contador refleja filtrados; no quedan resultados de la fecha anterior. |
| DIA-08 | P1 | Importar Excel válido de varias filas con tildes, campos opcionales, fechas y distintos pagos. Revisar vista previa y confirmar. | Previsualización representa filas; confirmar inserta una sola vez; lista y fechas se actualizan. |
| DIA-09 | P1 | Importar archivo vacío, corrupto, encabezados no reconocidos, fecha/importes/servicios/métodos inválidos y fila con pagado sin método. | Se informa error concreto; no se inserta ninguna fila parcial cuando la validación falla. |
| DIA-10 | P1 | Descargar plantilla y completar una copia sin alterar los encabezados; volver a importarla. | Plantilla abre y puede importarse siguiendo el formato documentado. |
| DIA-11 | P1 | Exportar registros, abrir el Excel y comparar datos, cantidades y estados con la fecha elegida. | Archivo legible, filas completas y valores correctos; exportación no altera registros. |
| DIA-12 | P0 | Borrar registro como Administrador; cancelar confirmación y repetir confirmando. Como Encargada/Consulta, intentar borrar. | Cancelar conserva fila; confirmar elimina solo el registro seleccionado; roles sin permiso no pueden borrarlo por UI ni RLS. |
| DIA-13 | P1 | Como QA-Operador, probar móvil: agregar, abrir “Editar detalles”, editar equipo/servicio y estado, usar el teléfono y eliminar conforme al permiso. | Tarjeta y tabla muestran el mismo dato; no hay desbordamiento horizontal; acciones no quedan detrás de navegación fija. |

### C. Movimientos de caja

| ID | Pri. | Caso y pasos | Resultado esperado |
|---|---|---|---|
| MOV-01 | P1 | En movimiento manual, guardar ingreso válido con actividad, concepto, responsable, monto y método. | Se crea un único movimiento con relaciones e importe correctos. |
| MOV-02 | P1 | Probar egreso válido y campos opcionales vacíos. | Tipo e importe se conservan; opcionales quedan nulos/vacíos según diseño. |
| MOV-03 | P1 | Intentar enviar sin actividad, concepto/responsable o con monto cero, negativo, texto o vacío. | No se persiste; validación indica qué corregir. |
| MOV-04 | P1 | Duplicar el movimiento recién guardado, modificar monto/persona y guardar. | Se precargan los campos previstos; monto y persona relacionados se limpian según interfaz; se crea una fila nueva sin duplicar automáticamente. |
| MOV-05 | P1 | En carga rápida, pulsar “Agregar fila” varias veces, completar diferentes filas y guardar todo. | Cada pulsación añade una fila editable; guardar inserta una vez todas las filas válidas. |
| MOV-06 | P1 | En carga rápida, dejar una fila incompleta entre filas válidas y guardar todo; corregirla. | Se resaltan filas incompletas, no se inserta lote parcial; tras corregir, guardar registra lote completo una sola vez. |
| MOV-07 | P1 | Como Encargada, intentar registrar por formulario y carga rápida; como Consulta, repetir. | Encargada puede si las políticas vigentes lo permiten; Consulta no puede escribir. |
| MOV-08 | P1 | Consultar historial reciente y exportar Excel. Comparar hasta el límite mostrado. | Orden y contenido coinciden con datos; se exportan las filas descritas por la UI; error de librería/descarga se reporta. |
| MOV-09 | P0 | Como Administrador borrar un movimiento y cancelar/confirmar; probar misma acción con Encargada y Consulta. | Solo Admin puede borrar; confirmación identifica que la operación es permanente; error RLS explícito si política falta. |

### D. Control de dinero: pendientes y custodia

| ID | Pri. | Caso y pasos | Resultado esperado |
|---|---|---|---|
| CD-01 | P1 | Abrir Control de dinero directamente sin `vista`, con `vista=pendientes`, con `vista=custodia` y con valor desconocido. | Pestaña por defecto Pendientes; parámetros válidos eligen la sección correcta; desconocido cae de forma segura a Pendientes. |
| CD-02 | P1 | Cambiar entre las dos pestañas; recargar y navegar Atrás/Adelante. | Sección y URL no se contradicen; formularios y operaciones de cada módulo siguen separados. |
| PEN-01 | P1 | Crear pendiente válido con descripción y monto, con/sin actividad y responsable. | Se guarda como Pendiente con fecha de registro local y relaciones correctas. |
| PEN-02 | P1 | Crear pendiente con descripción vacía o monto <= 0/no numérico. | Validación bloquea la inserción y explica el problema. |
| PEN-03 | P1 | Filtrar todos, pendientes y pagados; marcar pendiente como pagado y confirmar. | Filtros y contador son correctos; estado y fecha_pago persisten. Marcar pagado no crea por sí solo un movimiento de custodia. |
| PEN-04 | P0 | Como Encargada crear y actualizar estado; como Consulta intentar esas acciones; como Admin intentar borrado solo si UI lo incorpora. | RLS aplica permisos; no se afirma capacidad de eliminación desde la interfaz si no existe acción. |
| CUS-01 | P1 | Como Administrador registrar Entrega, Gasto y Devolución para QA-Responsable-A; verificar orden del historial. | Cada movimiento registra tipo, persona, monto, fecha y observaciones correctos. |
| CUS-02 | P1 | Probar responsable vacío, fecha vacía y monto cero/negativo/no numérico. | La validación no permite guardar; no hay filas parciales. |
| CUS-03 | P1 | Filtrar historial por responsable, fecha desde/hasta, combinación, limpiar filtros y rango sin resultados. | Tabla muestra exclusivamente coincidencias; limpiar restaura todo; no permite rango de fechas invertido. |
| CUS-04 | P0 | Como Admin eliminar un movimiento y cancelar/confirmar; repetir con Encargada y Consulta; simular error RLS/red. | Cancelar no altera datos; confirmar elimina solo ID elegido y recarga; roles no autorizados no borran; fallos explícitos. |
| CUS-05 | P1 | Comparar saldo visible antes/después de entrega, gasto, devolución y eliminación con fórmula SQL desplegada. | Resultado coincide exactamente con definición aprobada de la vista. Bloquear si no se obtuvo la definición; no inventar saldo por devolver. |
| CUS-06 | P1 | Crear pendiente y marcarlo pagado; revisar historial y saldo de custodia. | El pendiente solo cambia de estado; no se genera entrega/devolución automática sin una especificación de negocio adicional. |

### E. Caja, catálogos e informes

| ID | Pri. | Caso y pasos | Resultado esperado |
|---|---|---|---|
| CAJ-01 | P1 | Comparar resumen con datos iniciales y movimientos QA, incluyendo pendientes activos. | Totales coinciden con definición desplegada de vistas y reglas contables documentadas; no se valida contra una fórmula asumida. |
| CAJ-02 | P2 | Mostrar/ocultar saldos cero y probar saldo responsable positivo/negativo. | Filtro visual funciona; signo y formato monetario son comprensibles; no altera la base. |
| CAT-01 | P1 | Como Admin crear, editar, activar/desactivar actividad y responsable; como Operador/Consulta intentar cambio. | Admin puede; otros roles solo lo que autorice la política; elementos inactivos no aparecen para nuevas operaciones y siguen en históricos. |
| CAT-02 | P1 | Intentar eliminar catálogo referenciado por movimientos/registros. | El sistema explica por qué no se elimina o aplica el comportamiento relacional aprobado; no deja datos huérfanos. |
| INF-01 | P1 | Informe de cobros: filtrar fecha, actividad, responsable, método y estado; comparar conteos y totales con consulta independiente. | Filtros y total general concuerdan con el conjunto mostrado; intervalos de fecha son correctos. |
| INF-02 | P1 | Informe de caja: probar Día, Semana, Mes y Año, incluidos cambio de año, domingo/lunes, filtros y año inválido. | Límites de periodo correctos para zona horaria del negocio; año inválido se valida; no mezcla fechas fuera del rango. |
| INF-03 | P1 | Generar los tipos de informes disponibles y abrir/descargar los documentos. | Documento se genera, abre y contiene el periodo, datos y totales correspondientes; errores se comunican. |
| INF-04 | P2 | Imprimir informes desde navegador. | Encabezado de navegación no aparece; tablas y totales se imprimen legibles y sin corte relevante. |
| ADM-01 | P0 | Como no administrador abrir directamente usuarios, catálogos y bitácora, además de invocar endpoints administrativos. | Acceso denegado en interfaz/servidor; ningún cambio de rol o cuenta se consigue manipulando URL. |
| AUD-01 | P1 | Con migración de bitácora aplicada, crear, editar y borrar una fila de cada tabla auditada; consultar como Admin y Consulta. | Admin ve acción/tabla/ID/usuario/campos modificados; no se exponen valores anteriores/nuevos; otros roles no consultan. |
| AUD-02 | P1 | Repetir operación con bitácora/migración no instalada o trigger fallido en ambiente de prueba. | Error operacional queda visible y se define si la transacción debe fallar atómicamente; nunca mostrar éxito si no se registró lo requerido. |

### F. Compatibilidad y resiliencia

| ID | Pri. | Caso y pasos | Resultado esperado |
|---|---|---|---|
| UI-01 | P1 | Revisar pantallas principales a 390 px, 768 px y escritorio >= 1280 px. | Sin solapamientos, scroll horizontal no intencional ni texto ilegible; tablas pueden tener scroll propio. |
| UI-02 | P1 | En móvil navegar por Día, Caja, Informes y Más; probar menú desplegable y logout. | Enlaces correctos, foco accesible y navegación inferior no tapa botones ni contenido. |
| UI-03 | P2 | Usar teclado en login, pestañas, formularios, menús y diálogos; verificar foco visible y etiquetas. | Acciones son alcanzables y el foco es perceptible; controles tienen nombre accesible. |
| ERR-01 | P1 | Simular Supabase sin conexión durante carga, inserción, actualización y borrado. | Se informa error y se permite reintentar; UI no comunica éxito ni deja datos falsos optimistas sin revertir. |
| ERR-02 | P1 | Abrir sesión expirada y ejecutar operación. | Se solicita autenticación o se informa expiración; no se pierde silenciosamente una operación. |
| ERR-03 | P1 | Refrescar durante una operación de guardado y volver a abrir. | El estado persistido es consistente; no se crean duplicados por reintento sin idempotencia o confirmación. |
| REG-01 | P1 | Tras ejecutar cambios de UI, repetir flujos clave de cobros, caja, control de dinero y reportes en escritorio y móvil. | Diseño nuevo no cambia campos, permisos, fórmulas ni resultados del flujo previo. |

## 6. Criterios de salida

- Todos los casos P0 y P1 ejecutados y aprobados; ningún defecto P0/P1 abierto.
- Los casos bloqueados por falta de migración, credenciales de prueba o definiciones SQL quedan identificados, con responsable y evidencia pendiente.
- Para cada operación financiera se contrasta UI con filas de Supabase usando ambiente de prueba, identificadores QA y total antes/después.
- Sin duplicados, escrituras parciales inesperadas, errores silenciosos ni exposición de acciones restringidas.
- `npm run lint` y `npm run build` pasan; documentar cualquier advertencia conocida de lockfiles.
- Adjuntar evidencia sin credenciales ni datos personales reales: ID de caso, ambiente, rol, pasos, resultado, captura saneada y referencia de datos QA.

## 7. Registro de ejecución

| ID | Resultado (Aprobado/Fallido/Bloqueado) | Ambiente/rol | Evidencia o defecto | Ejecutado por/fecha |
|---|---|---|---|---|
| | | | | |

## 8. Ejecución preliminar — 2026-11-05

| Comprobación | Resultado | Evidencia / limitación |
|---|---|---|
| ESLint (`npm run lint`) | Aprobado | Sin errores. |
| Build y validación de tipos (`npm run build`) | Aprobado | Un primer intento terminó con `ENOENT` para `pages-manifest.json`; al repetir la compilación sin otros procesos de build concurrentes, completó correctamente. |
| Respuesta de inicio de sesión | Aprobado | `GET /login` devolvió HTTP 200 en el servidor local de prueba. |
| Protección de rutas sin sesión | Aprobado | `/dia`, `/caja` y `/caja/control-dinero` redirigieron a `/login`. |
| Error 406 de perfil | Corregido en código; pendiente de verificar con sesión | Se cambió la lectura de perfil a `maybeSingle()` porque el layout ya contempla continuar con el correo cuando no hay perfil. No se pudo repetir la petición autenticada desde la pestaña de prueba. |
| `ChunkLoadError` observado en puerto 3000 | No reproducido en login; verificación autenticada pendiente | El error apunta a un chunk de una página protegida y a un servidor distinto del puerto de prueba inicial. Se generó un build nuevo; hay que confirmar en una sesión autenticada que el servidor sirva el chunk actualizado. |
| Inspección visual autenticada de Día | Revisión visual parcial | La captura compartida confirma una sesión QA en `/dia` a resolución de escritorio y muestra el estado vacío, fecha, búsqueda, navegación y acciones de importación/exportación. Es una inspección de captura; no demuestra que esas acciones funcionen. |
| Automatización en navegador contra la sesión autenticada | Bloqueada | La sesión de navegador accesible para las herramientas continúa redirigiendo `/dia` a `/login`; no comparte la sesión mostrada en la captura. |
| Casos transaccionales en Supabase (cobros, movimientos, pendientes, custodia, informes) | Bloqueados | No se pudieron operar los controles autenticados desde la sesión accesible; no se ejecutaron escrituras ni eliminaciones y no se modificaron datos de Supabase. |
