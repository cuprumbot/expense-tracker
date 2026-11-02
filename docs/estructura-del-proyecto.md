# Estructura del Proyecto

Este documento describe la organización de carpetas y archivos en el proyecto **Control de Gastos (Expense Tracker)**, detallando la responsabilidad de cada capa arquitectónica, módulo de utilidades y componente de interfaz.

---

## 1. Árbol de Directorios

```text
expense-tracker/
├── .agents/                      # Configuración de habilidades y reglas de agentes (skills)
├── demo/                         # Estados de cuenta de prueba (.pdf y .csv) para 7 bancos
├── docs/                         # Documentación técnica completa (en español)
│   ├── dev/                      # Especificaciones de iteración, historias de usuario y roadmaps
│   ├── screenshots/              # Capturas de pantalla de alta resolución de la aplicación
│   ├── arquitectura-split-brain.md
│   ├── estructura-del-proyecto.md
│   ├── herramientas-y-arquitectura.md
│   ├── instalacion-y-ejecucion.md
│   ├── privacidad-y-anonimizacion.md
│   ├── pruebas-unitarias.md
│   └── uso-del-llm-y-manejo-de-fallos.md
├── e2e/                          # Pruebas End-to-End automatizadas con Playwright
│   ├── budget-tool.spec.ts       # Suite E2E completa del módulo de presupuestos (12 pruebas)
│   ├── expense-tracker.spec.ts   # Suite E2E completa de ingestión, dashboard y drawer
│   ├── panel-resize.spec.ts      # Suite E2E de redimensionamiento de paneles
│   ├── capture-all-screenshots.spec.ts # Generador de capturas para documentación
│   └── capture-diagram.spec.ts   # Generador de captura del diagrama de arquitectura
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
│   │   │   │   └── route.ts      # Despachador multi-banco local de PDF (7 bancos de Guatemala)
│   │   │   └── suggest-savings/
│   │   │       └── route.ts      # Generación de sugerencias de ahorro a partir de totales agregados
│   │   ├── favicon.ico           # Icono de la aplicación
│   │   ├── globals.css           # Estilos base y directivas de Tailwind CSS 4
│   │   ├── layout.tsx            # Plantilla raíz HTML, tema y metadatos
│   │   └── page.tsx              # Página principal: orquestador cliente, toasts, vistas y navegación
│   ├── components/               # Componentes modulares de interfaz de usuario (React)
│   │   ├── anonymization-modal.tsx       # Modal de revisión y censura interactiva de PII
│   │   ├── batch-progress.tsx            # Indicador visual no intrusivo de procesamiento por lotes
│   │   ├── batch-upload-modal.tsx        # Modal de gestión de cola y progreso para carga múltiple
│   │   ├── budget-tool-view.tsx          # Vista dedicada del módulo de presupuestos (Builder, Comparativa, Sugerencias)
│   │   ├── category-trend-chart.tsx      # Panel 1: Curvas Bézier SVG de tendencias mensuales por categoría
│   │   ├── column-mapping-modal.tsx      # Modal para asociar columnas en CSV ambiguos
│   │   ├── consumption-patterns-chart.tsx# Panel 3: Patrones por día semana/mes con detección de atípicos
│   │   ├── custom-category-modal.tsx     # Modal para creación de nuevas categorías
│   │   ├── dashboard-view.tsx            # Dashboard de 4 paneles SVG en cuadrícula 2x2 y cabecera
│   │   ├── file-upload.tsx               # Área de carga arrastrar-y-soltar con selector y lista rápida
│   │   ├── icons.tsx                     # Iconos SVG vectoriales basados en Lucide React (sin emojis)
│   │   ├── resizable-panel.tsx           # Contenedor para ajuste bidimensional de paneles
│   │   ├── session-reset-modal.tsx       # Modal de confirmación para reinicio selectivo o de fábrica
│   │   ├── simple-list-modal.tsx         # Modal para escribir/pegar listas rápidas en texto libre
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
│   │   ├── bac-parser.ts             # Parser especializado de tarjeta de crédito BAC Credomatic
│   │   ├── bac-parser.test.ts        # Pruebas del parser de BAC Credomatic
│   │   ├── bam-parser.ts             # Parser especializado de tarjeta de crédito Banco Agromercantil (BAM)
│   │   ├── bam-parser.test.ts        # Pruebas del parser de BAM
│   │   ├── banrural-parser.ts        # Parser especializado de tarjeta de crédito Banrural
│   │   ├── banrural-parser.test.ts   # Pruebas del parser de Banrural
│   │   ├── batch-processor.ts        # Orquestador de cola de archivos múltiples y estados
│   │   ├── batch-processor.test.ts   # Pruebas del orquestador por lotes
│   │   ├── bi-parser.ts              # Parser especializado de tarjeta de crédito Banco Industrial (BI)
│   │   ├── bi-parser.test.ts         # Pruebas del parser de Banco Industrial
│   │   ├── budget-engine.ts          # Motor de presupuestos: metas por niveles, comparativas, rachas y causas raíz
│   │   ├── budget-engine.test.ts     # Pruebas unitarias del motor de presupuestos (35 tests)
│   │   ├── csv-parser.ts             # Parser determinista de CSV (PapaParse) y monedas
│   │   ├── csv-parser.test.ts        # Pruebas de parseo CSV
│   │   ├── currency.ts               # Conversión USD/GTQ y formateo de moneda (GTQ / Q)
│   │   ├── currency.test.ts          # Pruebas de conversión y formateo de moneda
│   │   ├── cuscatlan-parser.ts       # Parser especializado de tarjeta de crédito Banco Cuscatlán
│   │   ├── cuscatlan-parser.test.ts  # Pruebas del parser de Banco Cuscatlán
│   │   ├── deduplication.ts          # Detección y omisión de transacciones duplicadas
│   │   ├── deduplication.test.ts     # Pruebas del motor de deduplicación
│   │   ├── expense-classifier.ts     # Clasificador local por catálogo (12 cat.) y umbral (10)
│   │   ├── expense-classifier.test.ts # Pruebas del clasificador local
│   │   ├── expense-review.test.ts    # Pruebas de edición y manipulación manual
│   │   ├── ficohsa-parser.ts         # Parser especializado de tarjeta de crédito Banco FICOHSA
│   │   ├── ficohsa-parser.test.ts    # Pruebas del parser de Banco FICOHSA
│   │   ├── file-validator.ts         # Validador de formatos permitidos (PDF/CSV)
│   │   ├── file-validator.test.ts    # Pruebas del validador de archivos
│   │   ├── gyt-parser.ts             # Parser especializado de tarjeta de crédito Banco G&T Continental
│   │   ├── gyt-parser.test.ts        # Pruebas del parser de Banco G&T Continental
│   │   ├── llm-classifier.ts         # Integración y prompts de clasificación con Gemini
│   │   ├── llm-classifier.test.ts    # Pruebas del clasificador LLM
│   │   ├── llm-extractor.ts          # Integración y prompts de extracción con Gemini
│   │   ├── llm-extractor.test.ts     # Pruebas del extractor LLM
│   │   ├── pdf-parser.ts             # Despachador multi-banco y extractor con pdf-parse
│   │   ├── reporting.ts              # Agregación temporal multimes, rankings, atípicos y donas
│   │   ├── reporting.test.ts         # Pruebas del motor de reportes y analítica avanzada
│   │   ├── resizable-panel.test.ts   # Pruebas de persistencia y límites de paneles redimensionables
│   │   ├── savings-advisor.ts        # Construcción de payload y análisis de ahorro
│   │   ├── savings-advisor.test.ts   # Pruebas del asesor de ahorro
│   │   ├── storage.ts                # Persistencia, continuidad de sesión y presupuestos en localStorage
│   │   ├── storage.test.ts           # Pruebas de almacenamiento, continuidad y reinicio
│   │   ├── text-list-parser.ts       # Parser de lista rápida con desambiguación numérica de comercios
│   │   └── text-list-parser.test.ts  # Pruebas de lista rápida y comercios numéricos
│   └── types/                    # Definiciones TypeScript de entidades y contratos
│       ├── budget.ts                 # Interfaces del módulo de presupuestos, metas y estadísticas
│       ├── classifier.ts             # Tipos de clasificación de comercios y fuentes
│       ├── transaction.ts            # Entidad Transaction y metadatos de moneda
│       └── ...
├── ARCHITECTURE_DIAGRAM.md       # Especificación completa de arquitectura y flujos
├── architecture-diagram.html     # Diagrama visual interactivo (HTML+SVG con exportador PNG/PDF)
├── architecture-diagram.png      # Captura visual de alta resolución del diagrama
├── BUDGET_IMPLEMENTATION.md      # Reporte detallado de implementación y QA del módulo de presupuestos
├── PROPOSED_QUESTIONS.md         # Encuesta de 10 preguntas para evaluación de producto con usuarios
└── README.md                     # Resumen ejecutivo y guía rápida de inicio
```

---

## 2. Descripción de Capas y Módulos

### 2.1. Capa de Presentación (`src/components/`)
* **`dashboard-view.tsx` y paneles asociados**: Visualización financiera en 4 cuadrantes SVG (Tendencias, Concentración, Patrones y Antigüedad) con controles interactivos y diseño adaptable a modo claro y oscuro.
* **`budget-tool-view.tsx`**: Administra el ciclo completo de presupuestos: pestaña de configuración con botones de ajuste rápido (`+Q 50`, `+Q 100`), comparativa mensual con barras de progreso y semáforos, y panel de diagnóstico de sobregiros.
* **`simple-list-modal.tsx`**: Proporciona un área de texto intuitiva para anotar gastos rápidos sin subir archivos, mostrando el desglose en tiempo real.
* **`sliding-drawer.tsx` y `transaction-table.tsx`**: Interfaz off-canvas para realizar búsquedas, triage y filtrado por moneda y categoría sin abandonar el dashboard.

### 2.2. Capa de Lógica de Negocio y Parsers (`src/lib/`)
* **Parsers Bancarios Especializados**: Módulos dedicados para cada institución financiera que interpretan los formatos de estados de cuenta de tarjetas de crédito guatemaltecas, eliminando cobros internos, pagos a tarjeta y comisiones no atribuibles a consumo.
* **`text-list-parser.ts`**: Interpreta compras escritas en orden libre (`monto comercio` o `comercio monto`), reconociendo comercios con números (ej. *Super 24*) de forma contextual.
* **`budget-engine.ts`**: Motor puramente determinista que calcula metas alcanzables (95% esenciales, 85% discrecionales), analiza causas de desvío y evalúa rachas de 4 semanas de calendario.
* **`currency.ts`**: Asegura que todos los cálculos operen en Quetzales guatemaltecos (GTQ / Q), convirtiendo transacciones en dólares estadounidenses al tipo de cambio configurado.

### 2.3. Capa de Servicios del Servidor (`src/app/api/`)
* **Route Handlers**: Endpoints en Node.js que actúan como frontera de seguridad. Aíslan las credenciales de la API de Gemini y validan exhaustivamente los datos antes de permitir cualquier llamada a la nube.
