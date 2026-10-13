# Pruebas Unitarias y Cobertura

La confiabilidad de **Control de Gastos (Expense Tracker)** está respaldada por una completa suite de pruebas unitarias automatizadas que verifican la integridad de cada módulo, parser, validador de seguridad y componente de la arquitectura Split-Brain.

---

## 1. Cómo Ejecutar las Pruebas

El proyecto utiliza el **Node.js Test Runner nativo** (`node:test` y `node:assert`) junto con `tsx` para ejecutar los archivos TypeScript directamente a máxima velocidad sin necesidad de transpilaciones lentas ni frameworks pesados de terceros.

### Comando Estándar

Para ejecutar toda la suite de pruebas del proyecto:

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

# Ejemplo: Probar el parser de PDF y estados de cuenta G&T
node --import tsx --test src/lib/pdf-parser.test.ts
```

### Resultados de la Suite

La suite completa consta de **12 archivos de prueba**, **18 suites temáticas** y **79 pruebas unitarias**, ejecutándose en aproximadamente 3.5 segundos:

```text
# tests 79
# suites 18
# pass 79
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

### 2.2. Formato y Parseo Monetario (`src/lib/currency.test.ts`)
* **Formateo en Quetzales (GTQ / Q)**: Verifica la representación correcta con prefijo `"Q"`, separador de miles con comas y dos decimales (ej. `1500.5` -> `"Q 1,500.50"`).
* **Manejo de montos negativos**: Comprueba que números negativos adopten el formato `"-Q 45.00"`.
* **Parseo de cadenas monetarias**: Convierte textos contables y variantes con símbolos a números de JavaScript (ej. `"Q 1,234.56"` -> `1234.56`, `"(50.00)"` -> `-50`).
* **Valores vacíos o inválidos**: Garantiza el retorno seguro de `0` ante valores nulos o no numéricos.

### 2.3. Parser de Archivos CSV (`src/lib/csv-parser.test.ts`)
* **Detección automática de encabezados**: Deduce columnas de fecha (`fecha`, `date`), descripción (`descripcion`, `concepto`, `comercio`) y monto (`monto`, `debito`, `monto_gtq`).
* **Manejo de delimitadores**: Procesa archivos separados por comas y puntos y comas.
* **Detección de ambigüedad**: Activa el indicador `needsMapping: true` cuando los encabezados son desconocidos o ambiguos para invocar el modal interactivo.
* **Parseo con mapeo personalizado**: Verifica la conversión correcta de transacciones cuando el usuario asigna manualmente las columnas.

### 2.4. Parser de PDF y Estados de Cuenta (`src/lib/pdf-parser.test.ts`)
* **Detección de Banco**: Identifica correctamente **Banco G&T Continental** mediante palabras clave (`g&t continental`, `gtc.com.gt`, `plaza continental`) y clasifica otros bancos como no soportados.
* **Filtrado de créditos y pagos**: Descarta débitos erróneos, abonos, pagos por internet (`PAGO POR INTERNET`) y créditos de cashback (`CREDITO CASH BACK`).
* **Filtrado de transacciones en moneda extranjera**: Ignora consumos facturados en dólares estadounidenses (`$`) para concentrarse en la moneda local (`GTQ`).
* **Prueba de integración con archivos reales**: Ejecuta la extracción completa sobre los documentos de prueba `demo/demo1.pdf` y `demo/demo2.pdf`, verificando que la suma total coincida con la sumatoria real de compras y débitos del estado de cuenta.

### 2.5. Anonimización y Privacidad (`src/lib/anonymizer.test.ts`)
* **Cuentas bancarias e IBAN**: Reemplaza cuentas bancarias guatemaltecas e IBANs por `[CUENTA_REDACTADA]`.
* **Tarjetas de crédito/débito**: Censura números de 16 dígitos y tarjetas con números enmascarados (`XXXX XXXX XXXX 1234`).
* **DPI (CUI) y NIT**: Reemplaza identificaciones guatemaltecas por `[IDENTIFICACION_REDACTADA]`.
* **Contactos y teléfonos**: Redacta números de teléfono locales, PBX y correos electrónicos por `[CONTACTO_REDACTADO]`.
* **Direcciones residenciales**: Redacta nomenclaturas de avenidas, calles, zonas, colonias y municipios por `[DIRECCION_REDACTADA]`.
* **Detección heurística del titular**: Identifica el nombre del propietario en las cabeceras del estado de cuenta y lo reemplaza por `[NOMBRE_REDACTADO]`.
* **Palabras personalizadas**: Aplica redacciones de términos específicos ingresados por el usuario como `[DATO_REDACTADO]`.

### 2.6. Clasificación Local de Comercios (`src/lib/expense-classifier.test.ts`)
* **Emparejamiento con catálogo**: Asocia descripciones comerciales con sus categorías en `merchant-catalog.json` (ej. `"Supermercados La Torre"` -> `Supermercado`, `"Gasolinera Shell"` -> `Transporte y Combustible`).
* **Normalización de texto**: Asegura coincidencia insensible a mayúsculas, tildes y caracteres de puntuación.
* **Reglas de desempate y puntuación**: Asigna mayor prioridad a palabras clave completas y prefijos de marca sobre coincidencias parciales.
* **Detección de suscripciones**: Marca automáticamente consumos recurrentes (Netflix, Spotify) e integra el cálculo del compromiso mensual acumulado.

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

### 2.10. Reportes y Métricas (`src/lib/reporting.test.ts`)
* **Distribución por categorías**: Calcula el total gastado por categoría y su porcentaje relativo sobre el gasto total.
* **Detección de estado pendiente**: Identifica cuándo existen gastos sin categorizar en el resumen.
* **Filtrado combinado**: Comprueba el filtrado simultáneo por término de búsqueda y categoría seleccionada de forma insensible a mayúsculas.

### 2.11. Asesor de Ahorro y Recomendaciones (`src/lib/savings-advisor.test.ts`)
* **Construcción del payload agregado (`buildSavingsPayload`)**: Verifica que solo se incluyan totales agregados por categoría y el desglose de suscripciones recurrentes, excluyendo compras individuales.
* **Rechazo de PII en servicios recurrentes**: Asegura que cualquier mención accidental de datos sensibles en suscripciones sea detectada y rechazada.
* **Parseo estructurado de recomendaciones**: Convierte la respuesta JSON de Gemini en oportunidades inmediatas, estrategias a largo plazo y diagnóstico por categoría.

### 2.12. Persistencia en LocalStorage (`src/lib/storage.test.ts`)
* **Guardado y recuperación de sesión**: Valida la serialización y deserialización correcta de `expense_tracker_session_v1`.
* **Resiliencia ante datos corruptos**: Comprueba que ante un JSON malformado o alterado manualmente en el navegador, la aplicación limpie la clave y se recupere limpiamente sin colapsar.
* **Persistencia de categorías personalizadas**: Valida que las categorías creadas por el usuario persistan de forma independiente a los estados de cuenta.
* **Límites de cuota de almacenamiento**: Simula excepciones de tipo `QuotaExceededError` verificando un manejo controlado con alertas informativas.

---

## Enlaces de Referencia

* [Volver al README Principal](../README.md)
* [Instalación, Configuración y Ejecución](instalacion-y-ejecucion.md)
* [Estructura del Proyecto](estructura-del-proyecto.md)
* [Arquitectura Split-Brain](arquitectura-split-brain.md)
* [Herramientas y Arquitectura Técnica](herramientas-y-arquitectura.md)
* [Uso del LLM Externo y Manejo de Fallos](uso-del-llm-y-manejo-de-fallos.md)
* [Privacidad y Anonimización de Datos](privacidad-y-anonimizacion.md)
