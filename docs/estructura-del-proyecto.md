# Estructura del Proyecto

Este documento describe la organización de carpetas y archivos en el proyecto **Control de Gastos (Expense Tracker)**, detallando la responsabilidad de cada capa arquitectónica, módulo de utilidades y componente de interfaz.

---

## 1. Árbol de Directorios

```text
expense-tracker/
├── .agents/                      # Configuración de habilidades y reglas de agentes
├── demo/                         # Archivos de prueba y demostración (PDF y CSV)
│   └── *.csv                         # Estados de cuenta de ejemplo
├── docs/                         # Documentación completa del proyecto (en español)
│   ├── arquitectura-split-brain.md
│   ├── estructura-del-proyecto.md
│   ├── herramientas-y-arquitectura.md
│   ├── instalacion-y-ejecucion.md
│   ├── privacidad-y-anonimizacion.md
│   ├── pruebas-unitarias.md
│   └── uso-del-llm-y-manejo-de-fallos.md
├── e2e/                          # Pruebas End-to-End automatizadas con Playwright
│   └── expense-tracker.spec.ts   # Suite completa desatendida del flujo y dashboard
├── public/                       # Recursos estáticos servidos por Next.js
├── src/
│   ├── app/                      # Next.js App Router (Páginas y Route Handlers)
│   │   ├── api/                  # Endpoints del lado del servidor (Node.js)
│   │   │   ├── classify-expenses/
│   │   │   │   └── route.ts      # Clasificación asistida por IA para gastos pendientes (> 10)
│   │   │   ├── config/
│   │   │   │   └── route.ts      # Consulta de configuración del servidor (umbral de pendientes)
│   │   │   ├── exchange-rate/
│   │   │   │   └── route.ts      # Consulta de tasa de cambio USD/GTQ activa
│   │   │   ├── extract-transactions/
│   │   │   │   └── route.ts      # Extracción estructurada con Gemini para bancos no compatibles
│   │   │   ├── parse-pdf/
│   │   │   │   └── route.ts      # Extracción local de PDF, parser Banco G&T y conversión USD
│   │   │   └── suggest-savings/
│   │   │       └── route.ts      # Generación de sugerencias de ahorro a partir de totales agregados
│   │   ├── favicon.ico           # Icono de la aplicación
│   │   ├── globals.css           # Estilos base y directivas de Tailwind CSS 4
│   │   ├── layout.tsx            # Plantilla raíz HTML, tema y metadatos
│   │   └── page.tsx              # Página principal: orquestador cliente, toasts y flujo al dashboard
│   ├── components/               # Componentes modulares de interfaz de usuario (React)
│   │   ├── anonymization-modal.tsx       # Modal de revisión y censura interactiva de PII
│   │   ├── batch-progress.tsx            # Indicador visual no intrusivo de procesamiento por lotes
│   │   ├── batch-upload-modal.tsx        # Modal de gestión de cola y progreso para carga múltiple
│   │   ├── category-trend-chart.tsx      # Panel 1: Curvas Bézier SVG de tendencias mensuales por categoría
│   │   ├── column-mapping-modal.tsx      # Modal para asociar columnas en CSV ambiguos
│   │   ├── consumption-patterns-chart.tsx# Panel 3: Patrones por día semana/mes con detección de atípicos
│   │   ├── custom-category-modal.tsx     # Modal para creación de nuevas categorías
│   │   ├── dashboard-view.tsx            # Dashboard de 4 paneles SVG en cuadrícula 2x2 y cabecera
│   │   ├── expense-dashboard.tsx         # [@deprecated] Métricas iniciales sustituidas por el dashboard
│   │   ├── file-upload.tsx               # Área de carga arrastrar-y-soltar con validación
│   │   ├── icons.tsx                     # Iconos SVG vectoriales basados en Lucide React
│   │   ├── savings-suggestions.tsx       # [@deprecated] Panel interactivo de sugerencias de ahorro
│   │   ├── session-reset-modal.tsx       # Modal de confirmación para reinicio selectivo o de fábrica
│   │   ├── sliding-drawer.tsx            # Drawer lateral off-canvas para inspección de transacciones
│   │   ├── theme-toggle.tsx              # Switcher de tema Claro/Oscuro con persistencia en localStorage
│   │   ├── transaction-age-chart.tsx     # Panel 4: Dona SVG interactiva de 3 segmentos y filtro de mes
│   │   ├── transaction-table.tsx         # Tabla de movimientos con filtros (categoría, moneda) y edición
│   │   └── vendor-concentration-chart.tsx# Panel 2: Barras horizontales de comercios por monto y compras
│   ├── data/
│   │   └── merchant-catalog.json # Directorio de comercios (12 categorías) de Guatemala
│   ├── lib/                      # Lógica de negocio, parsers, validadores y clientes
│   │   ├── anonymizer.ts             # Motor local de detección y sustitución de PII
│   │   ├── anonymizer.test.ts        # Pruebas de anonimización
│   │   ├── batch-processor.ts        # Orquestador de cola de archivos múltiples y estados
│   │   ├── batch-processor.test.ts   # Pruebas del orquestador por lotes
│   │   ├── csv-parser.ts             # Parser determinista de CSV (PapaParse) y monedas
│   │   ├── csv-parser.test.ts        # Pruebas de parseo CSV
│   │   ├── currency.ts               # Conversión USD/GTQ y formateo de moneda (GTQ / Q)
│   │   ├── currency.test.ts          # Pruebas de conversión y formateo de moneda
│   │   ├── deduplication.ts          # Detección y omisión de transacciones duplicadas
│   │   ├── deduplication.test.ts     # Pruebas del motor de deduplicación
│   │   ├── expense-classifier.ts     # Clasificador local por catálogo (12 cat.) y umbral (10)
│   │   ├── expense-classifier.test.ts # Pruebas del clasificador local
│   │   ├── expense-review.test.ts    # Pruebas de edición y manipulación manual
│   │   ├── file-validator.ts         # Validador de formatos permitidos (PDF/CSV)
│   │   ├── file-validator.test.ts    # Pruebas del validador de archivos
│   │   ├── llm-classifier.ts         # Integración y prompts de clasificación con Gemini
│   │   ├── llm-classifier.test.ts    # Pruebas del clasificador LLM
│   │   ├── llm-extractor.ts          # Integración y prompts de extracción con Gemini
│   │   ├── llm-extractor.test.ts     # Pruebas del extractor LLM
│   │   ├── banrural-parser.ts        # Parser local de estados de cuenta de Banrural
│   │   ├── banrural-parser.test.ts   # Pruebas del parser de Banrural
│   │   ├── bi-parser.ts              # Parser local de estados de cuenta de Banco Industrial
│   │   ├── bi-parser.test.ts         # Pruebas del parser de Banco Industrial
│   │   ├── gyt-parser.ts             # Parser local de Banco G&T Continental con soporte GTQ y USD
│   │   ├── gyt-parser.test.ts        # Pruebas del parser de Banco G&T Continental
│   │   ├── pdf-parser.ts             # Motor y despachador multi-banco de documentos PDF con pdf-parse
│   │   ├── reporting.ts              # Agregación temporal multimes, rankings, atípicos y donas
│   │   ├── reporting.test.ts         # Pruebas del motor de reportes y analítica avanzada
│   │   ├── savings-advisor.ts        # Construcción de payload y análisis de ahorro
│   │   ├── savings-advisor.test.ts   # Pruebas del asesor de ahorro
│   │   ├── storage.ts                # Persistencia, continuidad de sesión y reinicio en localStorage
│   │   └── storage.test.ts           # Pruebas de almacenamiento, continuidad y reinicio
│   └── types/
│       └── transaction.ts        # Definiciones de tipos canónicos de TypeScript
├── .env.example                  # Plantilla de variables de entorno
├── .gitignore                    # Reglas de exclusión para Git
├── AGENTS.md                     # Directrices y configuración del proyecto
├── ARCHITECTURE_DIAGRAM.md       # Descripción arquitectónica de componentes y flujos
├── architecture-diagram.html     # Diagrama de arquitectura interactivo (HTML/SVG)
├── architecture-diagram.png      # Captura visual del diagrama de arquitectura
├── DASHBOARD_IMPLEMENTATION.md   # Documento técnico de implementación del Dashboard (US-029 a US-040)
├── eslint.config.mjs             # Configuración de ESLint
├── next.config.ts                # Configuración de Next.js
├── package.json                  # Manifiesto de dependencias y scripts de npm
├── playwright.config.ts          # Configuración de pruebas E2E con Playwright
├── README.md                     # Índice principal y resumen del proyecto
└── tsconfig.json                 # Configuración del compilador de TypeScript
```

---

## 2. Descripción Detallada por Capas

### 2.1. Capa de Aplicación (`src/app/`)

* **`page.tsx`**: Es el componente principal de la aplicación cliente (`use client`). Mantiene todo el estado interactivo: transacciones acumuladas en la sesión activa, resumen de importación, categorías personalizadas, recomendaciones de ahorro y control de los modales. Orquesta la continuidad de sesión (agregando nuevos movimientos en lugar de sobreescribir) y el diálogo de reinicio de sesión.
* **`layout.tsx`**: Define la estructura visual base de la aplicación (etiquetas `html`, `body`), fuentes tipográficas y metadatos SEO.
* **`globals.css`**: Configuración de estilos globales con Tailwind CSS 4, definiendo paletas neutrales y modo oscuro.

#### Endpoints de Servidor (`src/app/api/`)

Todos los endpoints se ejecutan como **Route Handlers de Next.js** en el servidor Node.js y nunca exponen claves de API al cliente:

1. **`config/route.ts`**:
   * Expone al cliente variables de entorno operativas de forma segura, como el umbral de gastos pendientes para invocar la clasificación por IA (`UNCLASSIFIED_EXPENSES_THRESHOLD`, por defecto 10).
2. **`exchange-rate/route.ts`**:
   * Retorna la tasa de cambio vigente USD a GTQ configurada en el servidor (`USD_GTQ_EXCHANGE_RATE`, por defecto 7.85).
3. **`parse-pdf/route.ts`**:
   * Recibe el archivo PDF cargado mediante `multipart/form-data`.
   * Extrae el texto utilizando `pdf-parse` de manera 100% local.
   * Identifica si el estado de cuenta pertenece a un banco soportado (Banco G&T Continental).
   * Si es soportado, ejecuta el parser especializado extrayendo cargos tanto en Quetzales como en dólares (convirtiendo estos últimos a GTQ mediante la tasa de cambio oficial) y retorna las transacciones estructuradas con metadatos de divisa original. Si no, retorna el texto crudo y la bandera `isSupportedBank: false` para activar el flujo de anonimización local en el cliente.
4. **`extract-transactions/route.ts`**:
   * Recibe el texto sanitizado y anonimizado desde el cliente.
   * Aplica la validación estricta de servidor `validateSanitizedPayload` para impedir envíos con datos sensibles no redactados.
   * Invoca a Google Gemini Pro con un esquema de salida JSON riguroso para extraer únicamente compras y débitos en Quetzales o convertidos.
5. **`classify-expenses/route.ts`**:
   * Recibe una lista de descripciones y montos pendientes junto a las categorías disponibles.
   * Valida que no se incluya información sensible antes de invocar a Gemini Pro.
   * Se ejecuta únicamente si el total de gastos pendientes excede el umbral (10) y asigna las categorías correspondientes mediante inteligencia artificial.
6. **`suggest-savings/route.ts`**:
   * Recibe **únicamente** totales agregados por categoría y el desglose de servicios recurrentes/suscripciones.
   * Solicita a Gemini Pro recomendaciones financieras personalizadas para el usuario en Guatemala.

---

### 2.2. Componentes de Interfaz (`src/components/`)

* **`dashboard-view.tsx`**: Contenedor principal del Dashboard Financiero de 4 paneles SVG estructurado en una cuadrícula 2x2 responsiva (`grid-cols-1 lg:grid-cols-2`). Incluye la barra superior con el título `"Expense Tracker"`, switcher de tema Claro/Oscuro, botón para agregar más estados de cuenta, botón de reinicio de sesión y botón disparador para abrir el drawer de transacciones.
* **`sliding-drawer.tsx`**: Drawer lateral deslizante off-canvas con transición CSS suave desde la derecha, telón de fondo semitransparente con desenfoque (`bg-black/40 backdrop-blur-sm`), soporte para tecla `Escape` y encapsulación completa de la tabla de movimientos (`TransactionTable`).
* **`category-trend-chart.tsx`**: **Panel 1 del Dashboard (Tendencias por Categoría)**. Gráfico de líneas SVG nativo con curvas de interpolación Bézier cúbica continua, selector interactivo de categorías para aislar líneas, hit-targets circulares transparentes (`r=14`) para hover estable sin parpadeos, etiquetas de fecha en dos líneas (`Ene\n2026`) y tooltips de variación porcentual.
* **`vendor-concentration-chart.tsx`**: **Panel 2 del Dashboard (Concentración de Comercios)**. Gráfico de barras horizontales con selector dual de métricas ("Mayor monto gastado (Q)" vs "Mayor cantidad de compras"), ranking de los 5 principales comercios guatemaltecos normalizados y desglose de ticket promedio.
* **`consumption-patterns-chart.tsx`**: **Panel 3 del Dashboard (Patrones de Consumo)**. Gráfico de barras verticales con selector de vista semanal (7 días) vs mensual (31 días), cálculo de línea base estadística ($\mu, \sigma$), resaltado cromático de picos atípicos (`#f43f5e`) y banner analítico con explicaciones en español.
* **`transaction-age-chart.tsx`**: **Panel 4 del Dashboard (Antigüedad del Gasto y Financiamiento)**. Gráfico de dona SVG interactivo que particiona los gastos en 3 segmentos de decisión: Visacuotas y Financiamiento, Suscripciones Recurrentes y Compras Inmediatas. Incluye selector desplegable por mes y tarjetas de desglose sincronizadas.
* **`theme-toggle.tsx`**: Switcher accesible de tema Claro / Oscuro con modo claro por defecto, persistencia automática en `localStorage` (`theme`) y conmutación de clases Tailwind.
* **`file-upload.tsx`**: Proporciona una zona de arrastrar y soltar archivos, permitiendo seleccionar o arrastrar uno o varios archivos simultáneamente (.pdf y .csv).
* **`batch-upload-modal.tsx`**: Despliega la cola de procesamiento cuando se cargan múltiples archivos. Muestra la lista de archivos con su estado individual (`pending`, `processing`, `completed`, `error`) y una barra de progreso acumulada.
* **`batch-progress.tsx`**: Barra de progreso compacta que informa visualmente el avance del procesamiento por lotes sin bloquear la pantalla del usuario.
* **`column-mapping-modal.tsx`**: Se despliega cuando un archivo CSV posee encabezados ambiguos o no estándares, permitiendo al usuario asignar manualmente las columnas de fecha, descripción, monto y moneda.
* **`anonymization-modal.tsx`**: Muestra una vista previa interactiva del texto extraído de un estado de cuenta no soportado, destacando en tiempo real las redacciones de nombres, cuentas, DPI y teléfonos. Permite al usuario redactar palabras adicionales antes de enviar la información al LLM.
* **`transaction-table.tsx`**: Tabla integral para visualizar y gestionar transacciones. Incluye buscador por texto, filtro por categoría, filtro por moneda (Todas, Solo GTQ, Convertidas de USD), badges indicadores de montos en dólares originales, cambio de categoría individual o masivo, edición de montos y fechas, marcado/desmarcado de suscripciones y eliminación de filas.
* **`session-reset-modal.tsx`**: Modal de confirmación para reiniciar la sesión de trabajo. Permite borrar los movimientos acumulados conservando las categorías personalizadas del usuario, o marcar la casilla opcional para un restablecimiento de fábrica total.
* **`custom-category-modal.tsx`**: Permite al usuario registrar nuevas categorías con nombre y color personalizado.
* **`expense-dashboard.tsx`**: `[@deprecated]` Panel analítico con tarjetas de métricas iniciales, conservado para referencia histórica y reemplazado por `DashboardView`.
* **`savings-suggestions.tsx`**: `[@deprecated]` Panel de sugerencias de ahorro de la primera iteración, conservado para referencia histórica.
* **`icons.tsx`**: Biblioteca de iconos SVG vectoriales basados en Lucide React, garantizando una estética moderna sin emojis ni caracteres no estándares.

---

### 2.3. Módulos de Lógica de Negocio (`src/lib/`)

* **`reporting.ts`**: Motor analítico local integral. Realiza los cálculos de agregación temporal multimes (`calculateMonthlyCategoryTrends`), normalización y ranking de comercios por volumen/frecuencia (`calculateTopVendors`), agregación semanal/mensual y detección de anomalías estadísticas (`calculateConsumptionPatterns`), y segmentación en 3 compromisos de antigüedad (`calculateTransactionAgeSegments`).
* **`batch-processor.ts`**: Gestiona el ciclo de vida de la cola de procesamiento de archivos múltiples. Procesa cada documento en secuencia, captura errores aislados para no detener el lote y notifica al cliente del progreso en tiempo real.
* **`deduplication.ts`**: Compara transacciones entrantes con las existentes en la sesión y dentro del mismo lote. Si una transacción coincide exactamente en fecha, descripción normalizada y monto, se descarta silenciosamente y se computa en el contador de duplicados descartados, protegiendo las compras legítimas no duplicadas.
* **`anonymizer.ts`**: Motor central de privacidad. Ejecuta expresiones regulares y análisis heurístico para detectar y reemplazar nombres de titulares, direcciones, cuentas bancarias, IBAN, DPI, NIT, teléfonos y correos electrónicos con marcadores legibles (`[NOMBRE_REDACTADO]`, `[CUENTA_REDACTADA]`, etc.).
* **`currency.ts`**: Formateo y análisis de montos en Quetzales guatemaltecos (`GTQ` / `Q`), conversión automática de dólares estadounidenses a Quetzales (`convertUSDtoGTQ`) mediante tasa configurable y formateo de etiquetas con moneda de origen.
* **`gyt-parser.ts`**: Parser especializado para estados de cuenta de Banco G&T Continental. Filtra automáticamente pagos de tarjeta, créditos y abonos, y extrae consumos tanto en Quetzales como en dólares convirtiéndolos al tipo de cambio configurado.
* **`bi-parser.ts`**: Parser especializado para cuentas monetarias y tarjetas de crédito de Banco Industrial.
* **`banrural-parser.ts`**: Parser especializado para cuentas y estados de cuenta de Banrural, con soporte de transacciones de doble línea.
* **`pdf-parser.ts`**: Motor central y despachador multi-banco de documentos PDF con `pdf-parse`. Detecta automáticamente el banco de origen (Banco Industrial, Banrural, Banco G&T Continental, BAM) y enruta la extracción al parser especializado correspondiente de manera 100% local.
* **`storage.ts`**: Administra la persistencia segura en `localStorage` (`expense_tracker_session_v1` y `expense_tracker_categories_v1`), soportando continuidad incremental de sesiones, recuperación ante datos corruptos y borrado selectivo preservando categorías personalizadas.
* **`llm-extractor.ts`**: Construcción de prompts del sistema y usuario, validación de payloads y procesamiento de respuestas JSON para la extracción de transacciones con Gemini.
* **`llm-classifier.ts`**: Lógica de integración con Gemini para clasificar transacciones pendientes mediante prompts estructurados y fallback de modelos.
* **`savings-advisor.ts`**: Constructor del payload agregado de ahorro y parser de recomendaciones financieras devueltas por Gemini.
* **`file-validator.ts`**: Validación técnica de extensiones y tipos MIME de archivos.

---

### 2.4. Datos y Catálogos (`src/data/`)

* **`merchant-catalog.json`**: Base de conocimiento local con comercios populares en Guatemala agrupados en 12 categorías: Supermercado, Restaurantes y Cafés, Servicios Básicos, Transporte y Combustible, Salud y Farmacia, Entretenimiento y Compras, Suscripciones, Hogar y Mantenimiento, Educación y Librerías, Mascotas y Veterinaria, Cuidado Personal, y **Visacuotas y Financiamiento**. Contiene de 15 a 50 palabras clave por categoría y paleta de colores oficial.

---

### 2.5. Definiciones de Tipos (`src/types/`)

* **`transaction.ts`**: Contratos canónicos de TypeScript que garantizan consistencia en toda la aplicación: `Transaction`, `CSVParsingSummary`, `CSVColumnMapping`, `CustomCategory`, `BatchProcessingItem`, `BatchProgress`, `DeduplicationResult`, `MonthlyCategoryTrend`, `VendorRanking`, `ConsumptionPatterns`, `TransactionAgeSegments`, entre otros.

---

### 2.6. Automatización de Pruebas End-to-End (`e2e/`)

* **`e2e/expense-tracker.spec.ts`**: Suite completa de pruebas de extremo a extremo con Playwright. Levanta el entorno de prueba, limpia la sesión en el navegador, sube estados de cuenta PDF reales (`demo/2026-09.pdf` y `demo/2026-07.pdf`), verifica el paso directo al Dashboard, valida la interacción con los 4 paneles SVG y prueba la apertura, edición y cierre del Sliding Drawer de transacciones.
* **`playwright.config.ts`**: Configuración de ejecución headless/headed, puertos del servidor local y reporter de pruebas.

---

## Enlaces de Referencia

* [Volver al README Principal](../README.md)
* [Instalación, Configuración y Ejecución](instalacion-y-ejecucion.md)
* [Arquitectura Split-Brain](arquitectura-split-brain.md)
* [Herramientas y Arquitectura Técnica](herramientas-y-arquitectura.md)
* [Uso del LLM Externo y Manejo de Fallos](uso-del-llm-y-manejo-de-fallos.md)
* [Privacidad y Anonimización de Datos](privacidad-y-anonimizacion.md)
* [Pruebas Unitarias y Cobertura](pruebas-unitarias.md)
