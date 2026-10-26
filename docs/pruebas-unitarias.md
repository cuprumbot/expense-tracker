# Pruebas Unitarias y Automatización E2E

La confiabilidad de **Control de Gastos (Expense Tracker)** está respaldada por una completa suite de pruebas unitarias automatizadas que verifican la integridad de cada módulo, parser, validador de seguridad y componente de la arquitectura Split-Brain, complementada con pruebas de extremo a extremo (E2E) con Playwright.

---

## 1. Cómo Ejecutar las Pruebas Unitarias

El proyecto utiliza el **Node.js Test Runner nativo** (`node:test` y `node:assert`) junto con `tsx` para ejecutar los archivos TypeScript directamente a máxima velocidad sin necesidad de transpilaciones lentas ni frameworks pesados de terceros.

### Comando Estándar

Para ejecutar toda la suite de pruebas unitarias del proyecto:

```bash
npm test
```

Este comando ejecuta internamente el script definido en `package.json`:

```bash
node --import tsx --test src/**/*.test.ts
```

### Ejecutar un Archivo de Prueba Específico

Si deseas ejecutar únicamente las pruebas de un módulo en particular durante el desarrollo:

```bash
# Ejemplo: Probar únicamente el motor de anonimización
node --import tsx --test src/lib/anonymizer.test.ts

# Ejemplo: Probar el parser de Banco G&T Continental
node --import tsx --test src/lib/gyt-parser.test.ts

# Ejemplo: Probar los cálculos avanzados de analítica y series de tiempo
node --import tsx --test src/lib/reporting.test.ts
```

### Resultados de la Suite

La suite completa consta de **14 archivos de prueba**, **31 suites temáticas** y **131 pruebas unitarias**, ejecutándose en aproximadamente 2.9 segundos:

```text
# tests 131
# suites 31
# pass 131
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

---

## 2. Detalle de Cobertura por Módulo

A continuación se detalla cada uno de los archivos de prueba y los escenarios críticos que validan:

### 2.1. Validación de Archivos (`src/lib/file-validator.test.ts`)
* **Detección de formato PDF**: Valida archivos `.pdf` y tipo MIME `application/pdf`.
* **Detección de formato CSV**: Valida archivos `.csv` y tipo MIME `text/csv`.
* **Insensibilidad a mayúsculas**: Comprueba que extensiones como `.PDF` o `.CSV` se reconozcan correctamente.
* **Rechazo de formatos no permitidos**: Bloquea extensiones no admitidas (ej. `.xlsx`, `.txt`, `.docx`, `.png`) arrojando errores informativos en español.

### 2.2. Formato, Conversión y Parseo Monetario (`src/lib/currency.test.ts`)
* **Formateo en Quetzales (GTQ / Q)**: Verifica la representación correcta con prefijo `"Q"`, separador de miles con comas y dos decimales (ej. `1500.5` -> `"Q 1,500.50"`).
* **Manejo de montos negativos**: Comprueba que números negativos adopten el formato `"-Q 45.00"`.
* **Conversión de divisas (USD a GTQ)**: Valida la conversión matemática precisa de dólares estadounidenses a Quetzales utilizando la tasa configurable (`USD_GTQ_EXCHANGE_RATE`, por defecto 7.85) con redondeo a dos decimales.
* **Formateo con moneda de origen**: Genera etiquetas explicativas cuando una transacción fue convertida de moneda extranjera (ej. `"Q 78.50 ($10.00)"`).
* **Extracción de divisa y monto**: Identifica el símbolo de moneda en cadenas de texto (`$` -> `USD`, `Q` -> `GTQ`) y retorna el valor numérico limpio.
* **Parseo de cadenas monetarias**: Convierte textos contables y variantes con símbolos a números de JavaScript (ej. `"Q 1,234.56"` -> `1234.56`, `"(50.00)"` -> `-50`).
* **Valores vacíos o inválidos**: Garantiza el retorno seguro de `0` ante valores nulos o no numéricos.

### 2.3. Parser de Archivos CSV (`src/lib/csv-parser.test.ts`)
* **Detección automática de encabezados**: Deduce columnas de fecha (`fecha`, `date`), descripción (`descripcion`, `concepto`, `comercio`), monto (`monto`, `debito`, `monto_gtq`) y moneda (`moneda`, `currency`).
* **Manejo de delimitadores**: Procesa archivos separados por comas y puntos y comas.
* **Detección de ambigüedad**: Activa el indicador `needsMapping: true` cuando los encabezados son desconocidos o ambiguos para invocar el modal interactivo.
* **Parseo con mapeo personalizado**: Verifica la conversión correcta de transacciones cuando el usuario asigna manualmente las columnas.
* **Detección de transacciones en dólares en CSV**: Identifica columnas o montos rotulados en dólares y asigna automáticamente `originalCurrency: "USD"` calculando la conversión a GTQ.

### 2.4. Parser de Banco G&T Continental (`src/lib/gyt-parser.test.ts`)
* **Detección de Banco**: Identifica correctamente **Banco G&T Continental** mediante palabras clave (`g&t continental`, `gtc.com.gt`, `plaza continental`) y clasifica otros bancos como no soportados.
* **Filtrado de créditos y pagos**: Descarta débitos erróneos, abonos, pagos por internet (`PAGO POR INTERNET`) y créditos de cashback (`CREDITO CASH BACK`).
* **Extracción y conversión de consumos en dólares**: Extrae consumos facturados en dólares estadounidenses (`$`), preserva el monto en divisa original (`originalAmount` y `originalCurrency: "USD"`) y los convierte a Quetzales al tipo de cambio oficial.
* **Prueba de integración con archivos reales**: Ejecuta la extracción completa sobre los documentos de prueba `demo/demo1.pdf` y `demo/demo2.pdf`, verificando que la suma total coincida con la sumatoria real de compras y débitos del estado de cuenta incluyendo transacciones en dólares convertidas.

### 2.5. Anonimización y Privacidad (`src/lib/anonymizer.test.ts`)
* **Cuentas bancarias e IBAN**: Reemplaza cuentas bancarias guatemaltecas e IBANs por `[CUENTA_REDACTADA]`.
* **Tarjetas de crédito/débito**: Censura números de 16 dígitos y tarjetas con números enmascarados (`XXXX XXXX XXXX 1234`).
* **DPI (CUI) y NIT**: Reemplaza identificaciones guatemaltecas por `[IDENTIFICACION_REDACTADA]`.
* **Contactos y teléfonos**: Redacta números de teléfono locales, PBX y correos electrónicos por `[CONTACTO_REDACTADO]`.
* **Direcciones residenciales**: Redacta nomenclaturas de avenidas, calles, zonas, colonias y municipios por `[DIRECCION_REDACTADA]`.
* **Detección heurística del titular**: Identifica el nombre del propietario en las cabeceras del estado de cuenta y lo reemplaza por `[NOMBRE_REDACTADO]`.
* **Palabras personalizadas**: Aplica redacciones de términos específicos ingresados por el usuario como `[DATO_REDACTADO]`.

### 2.6. Clasificación Local de Comercios (`src/lib/expense-classifier.test.ts`)
* **Emparejamiento con catálogo (12 categorías)**: Asocia descripciones comerciales con sus categorías en `merchant-catalog.json` (ej. `"Supermercados La Torre"` -> `Supermercado`, `"Gasolinera Shell"` -> `Transporte y Combustible`, `"Cruz Verde"` -> `Salud y Farmacia`, `"Cemaco"` -> `Hogar y Mantenimiento`).
* **Normalización de texto**: Asegura coincidencia insensible a mayúsculas, tildes y caracteres de puntuación.
* **Reglas de desempate y puntuación**: Asigna mayor prioridad a palabras clave completas y prefijos de marca sobre coincidencias parciales.
* **Detección de suscripciones**: Marca automáticamente consumos recurrentes (Netflix, Spotify) e integra el cálculo del compromiso mensual acumulado.
* **Clasificación local de Visacuotas y Financiamiento (US-037)**: Valida que descripciones con palabras clave guatemaltecas de cuotas (`visacuota`, `mastercuota`, `cuotas sin intereses`, `extrafinanciamiento`, `pago a plazos`, `cuota no.`) se asignen 100% de forma determinista a la categoría `"Visacuotas y Financiamiento"` sin invocar al LLM.

### 2.7. Edición y Manipulación de Gastos (`src/lib/expense-review.test.ts`)
* **Edición manual de transacciones**: Valida la actualización de descripciones, fechas y montos recalculando las sumas totales.
* **Asignación masiva de categorías**: Permite actualizar múltiples transacciones simultáneamente.
* **Eliminación individual y múltiple**: Confirma el recalculo de totales y conteos tras remover transacciones erróneas o duplicadas.

### 2.8. Integración con LLM: Clasificador (`src/lib/llm-classifier.test.ts`)
* **Validación de seguridad del payload**: Rechaza objetos que contengan PII no redactada o esquemas malformados.
* **Construcción del prompt**: Garantiza que se envíen únicamente identificadores, descripciones de comercios y categorías disponibles.
* **Parseo de respuestas JSON**: Procesa arreglos JSON del modelo, limpia bloques de código markdown (````json ... ````) y maneja respuestas anidadas.
* **Manejo de errores por clave ausente**: Comprueba que la ausencia de `GEMINI_API_KEY` arroje un error claro y controlado sin romper el servidor.

### 2.9. Integración con LLM: Extractor (`src/lib/llm-extractor.test.ts`)
* **Validación de frontera (`validateSanitizedPayload`)**: Rechaza textos que contengan patrones de IBAN, cuentas bancarias, DPI o emails sin censurar.
* **Formateo del system prompt**: Certifica que el prompt ordene la extracción exclusiva de gastos en Quetzales y formato de fecha `YYYY-MM-DD`.
* **Parseo y normalización**: Valida la transformación de la salida del modelo a objetos `Transaction` tipados.

### 2.10. Reportes, Analítica Avanzada y Paneles del Dashboard (`src/lib/reporting.test.ts`)
* **Distribución por categorías**: Calcula el total gastado por categoría y su porcentaje relativo sobre el gasto total.
* **Detección de estado pendiente**: Identifica cuándo existen gastos sin categorizar en el resumen.
* **Filtrado combinado**: Comprueba el filtrado simultáneo por término de búsqueda y categoría seleccionada de forma insensible a mayúsculas.
* **Filtrado por divisa**: Valida el filtrado preciso por moneda (`all`, `GTQ`, `USD`), permitiendo aislar transacciones convertidas de dólares frente a moneda local.
* **Series de tiempo multimes por categoría (US-031)**: Valida la agregación cronológica en formato `YYYY-MM`, relleno determinista de ceros (`0.00`) para meses sin actividad y asociación dinámica de colores de categorías oficiales y personalizadas.
* **Normalización y ranking de comercios (US-033)**: Valida la limpieza exhaustiva de prefijos bancarios (`POS`, `COMPRA EN`, `ESTBL`, `GTM`), números de terminal y sufijos de sucursal, calculando ordenamientos por volumen de gasto en Quetzales y por frecuencia de visitas con ticket promedio.
* **Patrones de consumo y detección de atípicos (US-035)**: Valida la agregación semanal (Lunes a Domingo con parsing UTC) y mensual (días 1 a 31), el cálculo de línea base ($\mu, \sigma$) y la identificación de anomalías con explicaciones detalladas en español.
* **Segmentación de antigüedad del gasto (US-038)**: Valida la partición exacta en 3 segmentos canónicos (Cuotas y Financiamiento, Suscripciones, Compras Inmediatas) asegurando que los porcentajes sumen 100.0%, junto con el soporte de filtrado por mes seleccionado.

### 2.11. Asesor de Ahorro y Recomendaciones (`src/lib/savings-advisor.test.ts`)
* **Construcción del payload agregado (`buildSavingsPayload`)**: Verifica que solo se incluyan totales agregados por categoría y el desglose de suscripciones recurrentes, excluyendo compras individuales.
* **Rechazo de PII en servicios recurrentes**: Asegura que cualquier mención accidental de datos sensibles en suscripciones sea detectada y rechazada.
* **Parseo estructurado de recomendaciones**: Convierte la respuesta JSON de Gemini en oportunidades inmediatas, estrategias a largo plazo y diagnóstico por categoría.

### 2.12. Persistencia en LocalStorage y Continuidad (`src/lib/storage.test.ts`)
* **Guardado y recuperación de sesión**: Valida la serialización y deserialización correcta de `expense_tracker_session_v1`.
* **Continuidad de sesión incremental**: Comprueba que nuevas transacciones cargadas se anexen preservando los movimientos existentes categorizados previamente.
* **Reinicio de sesión selectivo (US-027)**: Verifica que `clearStoredSessionOnly()` elimine los movimientos y transacciones de la sesión pero conserve intactas las categorías personalizadas del usuario.
* **Reinicio de fábrica total (US-027)**: Comprueba que al activar la opción de borrado completo (`wipeCategories: true`), se eliminen tanto la sesión como las categorías personalizadas.
* **Resiliencia ante datos corruptos**: Comprueba que ante un JSON malformado o alterado manualmente en el navegador, la aplicación limpie la clave y se recupere limpiamente sin colapsar.
* **Persistencia de categorías personalizadas**: Valida que las categorías creadas por el usuario persistan de forma independiente a los estados de cuenta.
* **Límites de cuota de almacenamiento**: Simula excepciones de tipo `QuotaExceededError` verificando un manejo controlado con alertas informativas.

### 2.13. Orquestador de Carga por Lotes (`src/lib/batch-processor.test.ts`)
* **Cola de procesamiento secuencial**: Encola múltiples archivos PDF y CSV procesándolos de manera ordenada.
* **Transición de estados**: Valida el ciclo de vida de cada ítem (`pending` -> `processing` -> `completed` / `error`).
* **Progreso acumulado**: Comprueba el cálculo porcentual de avance y el reporte reactivo de eventos a la interfaz.
* **Aislamiento de fallos**: Demuestra que un archivo corrupto o inválido genera un error individual sin abortar el procesamiento de los demás documentos del lote.

### 2.14. Deduplicación de Transacciones (`src/lib/deduplication.test.ts`)
* **Detección de duplicados exactos**: Identifica y descarta compras que comparten fecha, descripción idéntica y mismo monto.
* **Preservación de coincidencias parciales**: Protege compras legítimas que comparten solo fecha, solo monto o nombres similares pero montos diferentes.
* **Deduplicación frente a sesión activa**: Valida que transacciones ya existentes en la sesión no se dupliquen al cargar un segundo archivo con registros solapados.
* **Conteo y métricas de descarte**: Informa con precisión la cantidad de transacciones omitidas para mantener la transparencia ante el usuario.

---

## 3. Pruebas de Extremo a Extremo con Playwright (`npm run test:e2e`)

Para verificar que todos los componentes integrados operen a la perfección en un navegador real, el proyecto cuenta con una suite automatizada End-to-End en `e2e/expense-tracker.spec.ts`.

### Cómo Ejecutar las Pruebas E2E

```bash
npm run test:e2e
```

### Escenarios Validados Desatendidamente

1. **Gestión Autónoma del Servidor**: Comprueba la disponibilidad de `http://localhost:3000` y lanza el servidor de desarrollo en caso de no estar activo.
2. **Reinicio Limpio de Sesión**: Ejecuta el modal de confirmación y borra datos residuales para garantizar aislamiento total entre corridas.
3. **Carga y Deduplicación Multi-Archivo**: Carga en lote los estados de cuenta reales `demo/2026-09.pdf` y `demo/2026-07.pdf`.
4. **Navegación Directa al Dashboard**: Verifica el ingreso inmediato a `DashboardView` sin bloqueos ni pantallas intermedias.
5. **Panel 1 (Tendencias)**: Valida la renderización del SVG de curvas Bézier, presencia de ejes temporales y filtrado por píldoras.
6. **Panel 2 (Comercios)**: Valida barras horizontales, conmutación entre orden por monto y por cantidad de compras, y tooltips.
7. **Panel 3 (Patrones y Atípicos)**: Valida vista semanal (7 días), vista mensual (31 días), resaltado de barras atípicas y banner analítico.
8. **Panel 4 (Antigüedad y Cuotas)**: Valida la dona SVG, monto en el centro en Quetzales, selector desplegable de mes y tarjetas de leyenda.
9. **Sliding Drawer de Transacciones**: Abre el drawer con el botón de la cabecera, crea una categoría personalizada `"Testing"`, clasifica pendientes, prueba cierre con botón y con tecla `Escape`, y confirma la reactividad inmediata del dashboard.

---

## Enlaces de Referencia

* [Volver al README Principal](../README.md)
* [Instalación, Configuración y Ejecución](instalacion-y-ejecucion.md)
* [Estructura del Proyecto](estructura-del-proyecto.md)
* [Arquitectura Split-Brain](arquitectura-split-brain.md)
* [Herramientas y Arquitectura Técnica](herramientas-y-arquitectura.md)
* [Uso del LLM Externo y Manejo de Fallos](uso-del-llm-y-manejo-de-fallos.md)
* [Privacidad y Anonimización de Datos](privacidad-y-anonimizacion.md)
