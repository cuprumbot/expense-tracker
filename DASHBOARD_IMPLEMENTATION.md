# Implementación de Paneles del Dashboard Financiero (US-029 a US-039)

Este documento resume la arquitectura, algoritmos, componentes visuales SVG, gestión de ramas de Git y resultados de verificación de las Historias de Usuario **US-029 a US-039** del Gestor Financiero Personal (`SPEC.md` y `USER_STORIES_2_DASHBOARD.md`).

---

## 1. Resumen de Historias de Usuario y Ramas de Git

Cada panel del dashboard se implementó en su rama temática correspondiente, con exactamente un commit convencional por historia de usuario tras superar la verificación de compilación (`npm run build`) y las pruebas E2E automatizadas con Playwright (`npm run test:e2e`):

| Rama | Historia | Descripción | Commit |
|---|---|---|---|
| `master` | **US-029** | Andamiaje del Dashboard, Enrutamiento Condicional y Cuadrícula 2x2 | `06b5bad` |
| `master` | **US-030** | Componente de Drawer Lateral Deslizante (`SlidingDrawer`) | `837a8bf` |
| `feature/panel-1-category-trends` | **US-031** | Motor de agregación temporal de series de tiempo multimes por categoría | `3ad0677` |
| `feature/panel-1-category-trends` | **US-032** | Gráfico de líneas SVG con curvas Bézier cúbicas y filtrado interactivo | `778e61f` |
| `feature/panel-2-merchant-concentration` | **US-033** | Motor de agregación de comercios por volumen de gasto y frecuencia | `717719c` |
| `feature/panel-2-merchant-concentration` | **US-034** | Gráfico de barras horizontales con selector dual de métricas y tooltip | `789ea6f` |
| `feature/panel-3-consumption-patterns` | **US-035** | Agregación temporal por día de semana/mes y heurísticas estadísticas de atípicos | `8f3ecd1` |
| `feature/panel-3-consumption-patterns` | **US-036** | Gráfico de barras con selector 7 días / 31 días, alertas de atípicos e insight | `567d415` |
| `feature/panel-4-transaction-age` | **US-037** | Extensión del catálogo con categoría "Visacuotas y Financiamiento" | `a357157` |
| `feature/panel-4-transaction-age` | **US-038** | Agregador de 3 segmentos de antigüedad de decisión con filtro por mes | `879402c` |
| `feature/panel-4-transaction-age` | **US-039** | Gráfico de dona SVG interactivo, filtro mensual desplegable y desglose | `1f398b4` |

---

## 2. Panel 1: Tendencia de Gastos por Categoría (US-031 y US-032)

### Rama: `feature/panel-1-category-trends`
- **Motor de Agregación (`calculateMonthlyCategoryTrends` en `src/lib/reporting.ts`):**
  - Identifica todos los meses calendario únicos en formato `YYYY-MM` y los ordena cronológicamente.
  - Agrupa los gastos válidos por categoría y calcula totales mensuales en GTQ.
  - Aplica relleno con ceros (`0.00`) para categorías sin gastos en meses específicos, asegurando que todas las series tengan la misma longitud para un trazado continuo.
  - Maneja banderas de mes único (`isSingleMonth: true`) cuando solo se ha cargado un estado de cuenta.
  - Asocia dinámicamente colores de categorías oficiales y personalizadas (`CustomCategory`).
- **Componente Visual SVG (`CategoryTrendChart` en `src/components/category-trend-chart.tsx`):**
  - Curvas de interpolación Bézier cúbica continua (`M`, `C` control points) sobre coordenadas normalizadas.
  - Eje Y dinámico con escala adaptativa (`peakAmount`) y líneas de cuadrícula punteadas.
  - Puntos de datos circulares interactivos con estados de hover.
  - Filtro interactivo de categorías en la parte superior: permite activar/desactivar líneas individuales haciendo clic en las píldoras; los elementos desactivados se muestran tachados (`line-through`) y se excluyen del SVG.
  - Tooltip flotante con monto exacto en Quetzales (`Q XX,XXX.XX`) y porcentaje de variación respecto al mes anterior.
  - Mensaje contextual informativo cuando solo hay un mes cargado, invitando a subir más estados de cuenta.

---

## 3. Panel 2: Concentración de Comercios (US-033 y US-034)

### Rama: `feature/panel-2-merchant-concentration`
- **Motor de Agregación (`calculateTopVendors` en `src/lib/reporting.ts`):**
  - Normaliza descripciones de comercios limpiando prefijos bancarios comunes (`POS`, `COMPRA EN`, `ESTBL`, `GTM`, `DEBITO`, etc.), números de terminal y sufijos de sucursal.
  - Identifica marcas y cadenas reconocidas en Guatemala (e.g. *La Torre*, *Paiz*, *Walmart*, *Shell*, *Puma*, *Uber*, *Netflix*, etc.).
  - Calcula dos ordenamientos independientes con desempate determinista:
    1. **Por volumen de gasto:** Total en GTQ y porcentaje de participación sobre el gasto total.
    2. **Por frecuencia de compra:** Conteo total de transacciones y ticket promedio por visita (`totalAmountGTQ / transactionCount`).
- **Componente Visual (`VendorConcentrationChart` en `src/components/vendor-concentration-chart.tsx`):**
  - Selector dual tipo píldora: "Mayor monto gastado (Q)" (`#btn-vendor-sort-amount`) vs "Mayor cantidad de compras" (`#btn-vendor-sort-frequency`).
  - Barras de progreso proporcionales con bordes redondeados y colores correspondientes a la categoría del comercio.
  - Encabezado con número de ranking (1 al 5), nombre canónico del comercio y montos/conteos destacados.
  - Tooltip con detalle de ticket promedio y categoría principal.

---

## 4. Panel 3: Patrones de Consumo y Detección de Atípicos (US-035 y US-036)

### Rama: `feature/panel-3-consumption-patterns`
- **Motor Estadístico (`calculateConsumptionPatterns` en `src/lib/reporting.ts`):**
  - **Día de la semana:** Agrupa de Lunes a Domingo (índices 0 a 6 con parsing UTC para evitar saltos por zona horaria).
  - **Día del mes:** Agrupa en los 31 días del mes calendario (días 1 a 31).
  - **Línea base estadística:** Calcula media ($\mu$), varianza y desviación estándar ($\sigma$) para días de la semana y del mes.
  - **Detección de Atípicos:**
    - *Regla 1 (Pico general):* Días cuyo gasto supera $\mu + 1.75\sigma$ o $> 2.5\times$ la mediana semanal se marcan con `isOutlier: true` y se calcula su `anomalyScore`.
    - *Regla 2 (Anomalía intermensual):* Compara el mismo día en meses diferentes (e.g. día 16 con gasto $3\times$ mayor que el promedio habitual de esa fecha).
  - **Resúmenes en español:** Genera explicaciones contextuales detalladas (e.g. *"Se detectó un consumo extraordinario los días viernes..."*).
- **Componente Visual (`ConsumptionPatternsChart` en `src/components/consumption-patterns-chart.tsx`):**
  - Selector segmentado: "Día de la semana (7 días)" (`#btn-pattern-day-of-week`) vs "Día del mes (1 a 31)" (`#btn-pattern-day-of-month`).
  - Barras verticales estilizadas con altura proporcional al valor máximo.
  - Barras normales en tonos azules refinados; barras atípicas resaltadas en tono Rosa/Ámbar (`#f43f5e` / `#f59e0b`) con ícono de alerta parpadeante sobre la columna.
  - Banner explicativo inferior (`#consumption-anomaly-banner`) con borde coloreado y mensaje en español sobre anomalías encontradas o confirmación de distribución equilibrada.
  - Tooltip interactivo mostrando día, total en GTQ, porcentaje y cantidad de compras.

---

## 5. Panel 4: Antigüedad del Gasto y Financiamiento (US-037, US-038 y US-039)

### Rama: `feature/panel-4-transaction-age`
- **Extensión del Catálogo y Clasificador (US-037):**
  - Agregada categoría oficial `"Visacuotas y Financiamiento"` en `src/data/merchant-catalog.json` con color celeste (`#0284c7`).
  - Palabras clave guatemaltecas completas: `visacuota`, `visa cuota`, `mastercuota`, `master cuota`, `cuota`, `extrafinanciamiento`, `pago en cuotas`, `cuotas sin intereses`, `credicuota`, `financiamiento`, `pago a plazos`, `cuota no`, `plan cuotas`, etc.
  - El clasificador local asigna la categoría de forma 100% determinista sin requerir consultas a modelos de IA.
- **Agregador de 3 Segmentos (`calculateTransactionAgeSegments` en `src/lib/reporting.ts`, US-038):**
  - Partición canónica en 3 segmentos:
    1. **Visacuotas y Financiamiento:** Decisiones tomadas en meses/años pasados.
    2. **Suscripciones Recurrentes:** Compromisos domiciliados o transacciones con `isSubscription: true`.
    3. **Compras Inmediatas:** Consumos nuevos y discrecionales del período actual.
  - Soporte de filtro por mes (`selectedMonth`: `"all"` o clave `"YYYY-MM"`).
  - Garantiza que los porcentajes sumen exactamente 100.0%.
- **Componente Visual de Dona SVG (`TransactionAgeChart` en `src/components/transaction-age-chart.tsx`, US-039):**
  - Gráfico de dona SVG nativo (`size=180`, `radius=77`) utilizando circunferencias con `strokeDasharray` y `strokeDashoffset`.
  - Colores distintivos:
    - Visacuotas y Financiamiento: `#0284c7` (Sky Blue)
    - Suscripciones Recurrentes: `#6366f1` (Indigo)
    - Compras Inmediatas: `#10b981` (Emerald)
  - Centro de la dona con monto total del período formateado en Quetzales (`Q XX,XXX.XX`) y número de movimientos.
  - Selector de mes en español (`#select-transaction-age-month`) con opción por defecto "Todos los meses cargados" y opciones para cada mes detectado ("Jul 2026", "Sep 2026").
  - Tarjetas de leyenda interactivas al costado (`#legend-segment-cuotas`, `#legend-segment-suscripciones`, `#legend-segment-inmediatas`) con resaltado sincronizado al pasar el cursor.

---

## 6. Verificación de Compilación y Calidad de Código

- **Compilación de Producción (`npm run build`):**
  - 0 errores de compilación con Turbopack.
  - 0 errores de tipado con TypeScript estricto en toda la base de código.
- **Pruebas Unitarias de Lógica Local (`npm test`):**
  - **131 pruebas unitarias** pasando exitosamente (0 fallos).
  - Cobertura completa de:
    - Agregación temporal y relleno de ceros (US-031).
    - Normalización de comercios y ordenamientos por volumen y frecuencia (US-033).
    - Agregación de días de semana/mes y detección de atípicos por desviación estándar (US-035).
    - Clasificación local de palabras clave de Visacuotas (US-037).
    - Partición en 3 segmentos de antigüedad y filtro multimes (US-038).

---

## 7. Pruebas Automatizadas de Extremo a Extremo con Playwright (`npm run test:e2e`)

El archivo de prueba `e2e/expense-tracker.spec.ts` ejecuta de forma 100% desatendida y autónoma el siguiente flujo:
1. **Verificación y Gestión del Servidor:** Comprueba si `http://localhost:3000` está activo y levanta `npm run dev` automáticamente en caso contrario.
2. **Sesión Limpia:** Elimina cualquier dato residual mediante el botón "Borrar mis datos" y confirma en el modal.
3. **Carga Programática de Archivos:** Sube `demo/2026-09.pdf` y `demo/2026-07.pdf` mediante eventos de archivo sin interacción humana.
4. **Navegación al Dashboard (US-029):** Entra automáticamente al dashboard financiero al detectar menos de 10 pendientes.
5. **Verificación del Panel 1 (US-031 y US-032):** Valida la presencia del SVG de líneas, ejes con "Jul 2026" y "Sep 2026", trazado de curvas y alternancia de píldoras de categorías.
6. **Verificación del Panel 2 (US-033 y US-034):** Valida el gráfico de barras de comercios, alterna entre ordenamiento por monto en Quetzales y ordenamiento por cantidad de compras.
7. **Verificación del Panel 3 (US-035 y US-036):** Valida las barras de patrones de consumo, etiquetas de días ("Lun", "Vie"), banner de anomalías y alternancia entre vista semanal y vista mensual (1 a 31).
8. **Verificación del Panel 4 (US-037, US-038 y US-039):** Valida el gráfico de dona SVG, total en Quetzales en el centro, selector de meses y las 3 tarjetas de leyenda (Cuotas, Suscripciones, Inmediatas).
9. **Validación del Drawer Deslizante (US-030):** Abre el drawer, crea la categoría `"Testing"`, clasifica los pendientes restantes, prueba el cierre con botón y con tecla `Escape`, y verifica la reactividad del dashboard.
10. **Finalización Controlada:** Detiene limpiamente el proceso de desarrollo de Next.js al terminar.
