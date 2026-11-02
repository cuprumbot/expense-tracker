# Pruebas Unitarias y Automatización E2E

La confiabilidad y estabilidad de **Control de Gastos (Expense Tracker)** está respaldada por una exhaustiva suite de pruebas automatizadas que verifican la integridad de cada módulo, parser bancario, validador de seguridad, motor presupuestario y componente de la arquitectura Split-Brain, complementada con pruebas de extremo a extremo (E2E) con Playwright.

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
# Probar el motor de presupuestos (builder, comparativas, rachas y causas raíz)
node --import tsx --test src/lib/budget-engine.test.ts

# Probar el parser de lista rápida con desambiguación numérica
node --import tsx --test src/lib/text-list-parser.test.ts

# Probar el parser de BAC Credomatic
node --import tsx --test src/lib/bac-parser.test.ts

# Probar el motor de anonimización
node --import tsx --test src/lib/anonymizer.test.ts
```

### Resultados de la Suite

La suite completa consta de **291 pruebas unitarias** agrupadas en **58 suites temáticas**, ejecutándose en aproximadamente 5.6 segundos:

```text
# tests 291
# suites 58
# pass 291
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms ~5600ms
```

---

## 2. Detalle de Cobertura por Módulo

A continuación se detalla cada uno de los archivos de prueba y los escenarios críticos que validan:

### 2.1. Motor de Presupuestos (`src/lib/budget-engine.test.ts`)
* **Creación desde Cero con Presets por Niveles**: Valida la inicialización de metas divididas en *Esenciales* (`Supermercado`, `Servicios Básicos`, `Salud`, `Transporte`) y *Estilo de vida* (`Restaurantes`, `Entretenimiento`, `Suscripciones`).
* **Generador de Metas Realistas**: Comprueba la ponderación histórica (95% para esenciales, 85% para discrecionales) y el redondeo limpio a múltiplos de Q 5, Q 10 o Q 25.
* **Motor de Comparativa Mensual**: Evalúa el cálculo de gastos reales frente al límite, ahorro neto o sobregiro, porcentaje de utilización y semáforos de estado (`under`, `near`, `over`, `way_over`).
* **Gamificación y Rachas Semanales**: Valida la partición mensual en 4 semanas de calendario, el cálculo de rachas continuas bajo presupuesto y la selección de la "Mejor categoría del mes".
* **Diagnóstico de Causas Raíz**: Verifica la detección heurística de sobregiros (`compra_unica_alta`, `alta_frecuencia`, `concentracion_fechas`, `monto_total_elevado`).
* **Trayectoria Multi-Mes y Coaching**: Evalúa las reglas de sugerencia según la persistencia del sobregiro (1-2 meses vs. 3+ meses).

### 2.2. Parser de Lista Rápida en Texto Libre (`src/lib/text-list-parser.test.ts`)
* **Orden Directo e Inverso**: Parsea líneas donde el comercio precede al monto (`"Walmart 150"`) y donde el monto precede al comercio (`"150 Burger King"`).
* **Desambiguación Numérica Contextual**: Identifica correctamente números pertenecientes al nombre de comercios guatemaltecos frente al monto real gastado (`"40 super 24"` y `"super 24 20"`).
* **Manejo de Monedas y Decimales**: Acepta decimales (`125.50`) y prefijos (`Q`, `$`, `GTQ`, `USD`), asignando GTQ por defecto.
* **Resiliencia ante Líneas Inválidas**: Omite líneas en blanco o con formato incorrecto reportando el resumen de líneas descartadas.

### 2.3. Parsers Bancarios Especializados de Tarjetas de Crédito
* **Banco G&T Continental (`gyt-parser.test.ts`)**: Extracción de cargos en Quetzales y Dólares convertidos a GTQ (7.85), filtrado de abonos y validación contra archivos reales `demo1.pdf` y `demo2.pdf`.
* **Banco Industrial (`bi-parser.test.ts`)**: Identificación por encabezados y dominios (`bi.com.gt`), parseo de fechas de corte y consumo, y descarte de pagos de tarjeta.
* **Banrural (`banrural-parser.test.ts`)**: Detección de estados de cuenta de Banrural, extracción multimoneda y normalización de descripciones.
* **BAC Credomatic (`bac-parser.test.ts`)**: Normalización de formatos de fecha MMM/DD y DD/MMM, ajuste de año en transacciones previas al corte y preservación de Visacuotas.
* **Banco Agromercantil BAM (`bam-parser.test.ts`)**: Detección de marcas BAM, extracción de transacciones con descripción multi-línea y conversión cambiaria.
* **Banco FICOHSA (`ficohsa-parser.test.ts`)**: Limpieza de códigos de autorización interna de POS y filtrado de devoluciones de cashback.
* **Banco Cuscatlán (`cuscatlan-parser.test.ts`)**: Parseo de consumos locales e internacionales, normalización de conceptos y fechas.

### 2.4. Anonimización y Privacidad (`src/lib/anonymizer.test.ts`)
* **Cuentas Bancarias e IBAN**: Reemplazo por `[CUENTA_REDACTADA]`.
* **Tarjetas de Crédito**: Censura de números de 16 dígitos y tarjetas con numeración enmascarada (`XXXX XXXX XXXX 1234`).
* **DPI (CUI) y NIT**: Reemplazo por `[IDENTIFICACION_REDACTADA]`.
* **Contactos y Teléfonos**: Redacción de teléfonos locales, PBX y correos por `[CONTACTO_REDACTADO]`.
* **Direcciones Físicas**: Redacción de zonas, avenidas, calles y colonias por `[DIRECCION_REDACTADA]`.
* **Prueba de Integración con `demo3.pdf`**: Verifica que ningún dato de identidad sensible sobreviva al proceso de sanitización.

### 2.5. Validación de Archivos y CSV (`file-validator.test.ts`, `csv-parser.test.ts`)
* Valida formatos admitidos (`.pdf`, `.csv`), insensibilidad a mayúsculas y rechazo de formatos no permitidos con mensajes claros en español.
* Inferencia automática de columnas de fecha, descripción, monto y divisa en CSVs, con soporte para delimitadores coma y punto y coma.

### 2.6. Persistencia y Almacenamiento (`storage.test.ts`, `resizable-panel.test.ts`)
* **Persistencia de Sesión y Categorías**: Guardado, recuperación y reinicio selectivo o de fábrica en `localStorage`.
* **Versionado de Presupuestos**: Almacenamiento bajo la clave `expense_tracker_budget_v1` y resolución temporal multi-versión con `getBudgetForMonth`.
* **Tolerancia a Corrupción (Self-Healing)**: Recuperación automática sin interrupción de la aplicación ante JSON corrupto o cuotas excedidas en el navegador.
* **Dimensiones de Paneles 2D**: Persistencia de anchos y altos redimensionados con límites estrictos de contención.

---

## 3. Pruebas End-to-End (E2E) con Playwright

Las pruebas de extremo a extremo automatizan la interacción con navegadores reales mediante Playwright para asegurar que los flujos de usuario se completen con éxito.

### Ejecución de Pruebas E2E

```bash
# Ejecutar todas las pruebas E2E
npm run test:e2e

# Ejecutar únicamente las pruebas del módulo de presupuestos
npx playwright test e2e/budget-tool.spec.ts
```

### Escenarios E2E Clave
* **`e2e/budget-tool.spec.ts` (12 pruebas)**: Creación de presupuestos desde cero, generación realista desde movimientos cargados, modal de confirmación de alcance histórico, comparativa mensual, estadísticas de rachas y panel de diagnóstico de causas raíz.
* **`e2e/expense-tracker.spec.ts`**: Carga múltiple por lotes de PDFs reales, deduplicación automática, reactividad de los 4 paneles del dashboard, apertura del cajón lateral y cambio de tema claro/oscuro.
