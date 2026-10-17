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
│   │   ├── layout.tsx            # Plantilla raíz HTML y metadatos
│   │   └── page.tsx              # Página principal (Cliente), continuidad y orquestador
│   ├── components/               # Componentes modulares de interfaz de usuario (React)
│   │   ├── anonymization-modal.tsx   # Modal de revisión y censura interactiva de PII
│   │   ├── batch-progress.tsx        # Indicador visual no intrusivo de procesamiento por lotes
│   │   ├── batch-upload-modal.tsx    # Modal de gestión de cola y progreso para carga múltiple
│   │   ├── column-mapping-modal.tsx  # Modal para asociar columnas en CSV ambiguos
│   │   ├── custom-category-modal.tsx # Modal para creación de nuevas categorías
│   │   ├── expense-dashboard.tsx     # Métricas agregadas, porcentajes y alertas
│   │   ├── file-upload.tsx           # Área de carga arrastrar-y-soltar con validación
│   │   ├── icons.tsx                 # Iconos SVG vectoriales basados en Lucide React
│   │   ├── savings-suggestions.tsx   # Panel interactivo de sugerencias de ahorro
│   │   ├── session-reset-modal.tsx   # Modal de confirmación para reinicio selectivo o de fábrica
│   │   └── transaction-table.tsx     # Tabla de movimientos con filtros (categoría, moneda) y edición
│   ├── data/
│   │   └── merchant-catalog.json # Directorio de comercios (11 categorías) de Guatemala
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
│   │   ├── expense-classifier.ts     # Clasificador local por catálogo (11 cat.) y umbral (10)
│   │   ├── expense-classifier.test.ts # Pruebas del clasificador local
│   │   ├── expense-review.test.ts    # Pruebas de edición y manipulación manual
│   │   ├── file-validator.ts         # Validador de formatos permitidos (PDF/CSV)
│   │   ├── file-validator.test.ts    # Pruebas del validador de archivos
│   │   ├── llm-classifier.ts         # Integración y prompts de clasificación con Gemini
│   │   ├── llm-classifier.test.ts    # Pruebas del clasificador LLM
│   │   ├── llm-extractor.ts          # Integración y prompts de extracción con Gemini
│   │   ├── llm-extractor.test.ts     # Pruebas del extractor LLM
│   │   ├── pdf-parser.ts             # Parser local con pdf-parse, G&T y conversión de dólares
│   │   ├── pdf-parser.test.ts        # Pruebas del parser PDF
│   │   ├── reporting.ts              # Agregación de métricas, totales, porcentajes y filtros
│   │   ├── reporting.test.ts         # Pruebas del motor de reportes
│   │   ├── savings-advisor.ts        # Construcción de payload y análisis de ahorro
│   │   ├── savings-advisor.test.ts   # Pruebas del asesor de ahorro
│   │   ├── storage.ts                # Persistencia, continuidad de sesión y reinicio en localStorage
│   │   └── storage.test.ts           # Pruebas de almacenamiento, continuidad y reinicio
│   └── types/
│       └── transaction.ts        # Definiciones de tipos canónicos de TypeScript
├── .env.example                  # Plantilla de variables de entorno
├── .gitignore                    # Reglas de exclusión para Git
├── AGENTS.md                     # Directrices y configuración del proyecto
├── architecture-diagram.html     # Diagrama de arquitectura interactivo (HTML/SVG)
├── architecture-diagram.png      # Captura visual del diagrama de arquitectura
├── eslint.config.mjs             # Configuración de ESLint
├── next.config.ts                # Configuración de Next.js
├── package.json                  # Manifiesto de dependencias y scripts de npm
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

* **`file-upload.tsx`**: Proporciona una zona de arrastrar y soltar archivos, permitiendo seleccionar o arrastrar uno o varios archivos simultáneamente (.pdf y .csv).
* **`batch-upload-modal.tsx`**: Despliega la cola de procesamiento cuando se cargan múltiples archivos. Muestra la lista de archivos con su estado individual (`pending`, `processing`, `completed`, `error`) y una barra de progreso acumulada.
* **`batch-progress.tsx`**: Barra de progreso compacta que informa visualmente el avance del procesamiento por lotes sin bloquear la pantalla del usuario.
* **`column-mapping-modal.tsx`**: Se despliega cuando un archivo CSV posee encabezados ambiguos o no estándares, permitiendo al usuario asignar manualmente las columnas de fecha, descripción, monto y moneda.
* **`anonymization-modal.tsx`**: Muestra una vista previa interactiva del texto extraído de un estado de cuenta no soportado, destacando en tiempo real las redacciones de nombres, cuentas, DPI y teléfonos. Permite al usuario redactar palabras adicionales antes de enviar la información al LLM.
* **`transaction-table.tsx`**: Tabla integral para visualizar y gestionar transacciones. Incluye buscador por texto, filtro por categoría, filtro por moneda (Todas, Solo GTQ, Convertidas de USD), badges indicadores de montos en dólares originales, cambio de categoría individual o masivo, edición de montos y fechas, marcado/desmarcado de suscripciones y eliminación de filas.
* **`session-reset-modal.tsx`**: Modal de confirmación para reiniciar la sesión de trabajo. Permite borrar los movimientos acumulados conservando las categorías personalizadas del usuario, o marcar la casilla opcional para un restablecimiento de fábrica total.
* **`custom-category-modal.tsx`**: Permite al usuario registrar nuevas categorías con nombre y color personalizado.
* **`expense-dashboard.tsx`**: Panel analítico con tarjetas de métricas (gasto total, número de movimientos, gasto mensual en suscripciones), barras de distribución porcentual por categoría y alertas de suscripciones activas.
* **`savings-suggestions.tsx`**: Panel que permite solicitar y desplegar sugerencias de ahorro generadas por IA, organizadas en oportunidades inmediatas, estrategias a largo plazo y análisis comparativo por categoría.
* **`icons.tsx`**: Biblioteca de iconos SVG vectoriales basados en Lucide React, garantizando una estética moderna sin emojis ni caracteres no estándares.

---

### 2.3. Módulos de Lógica de Negocio (`src/lib/`)

* **`batch-processor.ts`**: Gestiona el ciclo de vida de la cola de procesamiento de archivos múltiples. Procesa cada documento en secuencia, captura errores aislados para no detener el lote y notifica al cliente del progreso en tiempo real.
* **`deduplication.ts`**: Compara transacciones entrantes con las existentes en la sesión y dentro del mismo lote. Si una transacción coincide exactamente en fecha, descripción normalizada y monto, se descarta silenciosamente y se computa en el contador de duplicados descartados, protegiendo las compras legítimas no duplicadas.
* **`anonymizer.ts`**: Motor central de privacidad. Ejecuta expresiones regulares y análisis heurístico para detectar y reemplazar nombres de titulares, direcciones, cuentas bancarias, IBAN, DPI, NIT, teléfonos y correos electrónicos con marcadores legibles (`[NOMBRE_REDACTADO]`, `[CUENTA_REDACTADA]`, etc.).
* **`currency.ts`**: Formateo y análisis de montos en Quetzales guatemaltecos (`GTQ` / `Q`), conversión automática de dólares estadounidenses a Quetzales (`convertUSDtoGTQ`) mediante tasa configurable y formateo de etiquetas con moneda de origen.
* **`csv-parser.ts`**: Lector de archivos CSV basado en PapaParse, con capacidad de deducción automática de columnas, detección de moneda original (USD/GTQ) y normalización de fechas guatemaltecas.
* **`pdf-parser.ts`**: Parser de documentos PDF con `pdf-parse` y lógica especializada para Banco G&T Continental. Filtra automáticamente pagos de tarjeta, créditos y abonos, y extrae consumos tanto en Quetzales como en dólares convirtiéndolos al tipo de cambio configurado.
* **`expense-classifier.ts`**: Clasificador determinista que cruza cada descripción de movimiento con un catálogo en memoria de 11 categorías de comercios guatemaltecos. Identifica automáticamente suscripciones digitales (Netflix, Spotify, etc.) y evalúa el umbral de pendientes (10).
* **`reporting.ts`**: Realiza los cálculos de agregación por categoría, porcentajes del presupuesto total y filtros combinados (incluyendo filtros por tipo de divisa).
* **`storage.ts`**: Administra la persistencia segura en `localStorage` (`expense_tracker_session_v1` y `expense_tracker_categories_v1`), soportando continuidad incremental de sesiones, recuperación ante datos corruptos y borrado selectivo preservando categorías personalizadas.
* **`llm-extractor.ts`**: Construcción de prompts del sistema y usuario, validación de payloads y procesamiento de respuestas JSON para la extracción de transacciones con Gemini.
* **`llm-classifier.ts`**: Lógica de integración con Gemini para clasificar transacciones pendientes mediante prompts estructurados y fallback de modelos.
* **`savings-advisor.ts`**: Constructor del payload agregado de ahorro y parser de recomendaciones financieras devueltas por Gemini.
* **`file-validator.ts`**: Validación técnica de extensiones y tipos MIME de archivos.

---

### 2.4. Datos y Catálogos (`src/data/`)

* **`merchant-catalog.json`**: Base de conocimiento local con comercios populares en Guatemala agrupados en 11 categorías (Supermercado, Restaurantes y Cafés, Servicios Básicos, Transporte y Combustible, Salud y Farmacia, Entretenimiento y Compras, Suscripciones, Hogar y Mantenimiento, Educación y Librerías, Mascotas y Veterinaria, Cuidado Personal) con 15-50 palabras clave por categoría y definición de colores de interfaz.

---

### 2.5. Definiciones de Tipos (`src/types/`)

* **`transaction.ts`**: Contratos canónicos de TypeScript que garantizan consistencia en toda la aplicación: `Transaction`, `CSVParsingSummary`, `CSVColumnMapping`, `CustomCategory`, `BatchProcessingItem`, `BatchProgress`, `DeduplicationResult`, entre otros.

---

## Enlaces de Referencia

* [Volver al README Principal](../README.md)
* [Instalación, Configuración y Ejecución](instalacion-y-ejecucion.md)
* [Arquitectura Split-Brain](arquitectura-split-brain.md)
* [Herramientas y Arquitectura Técnica](herramientas-y-arquitectura.md)
* [Uso del LLM Externo y Manejo de Fallos](uso-del-llm-y-manejo-de-fallos.md)
* [Privacidad y Anonimización de Datos](privacidad-y-anonimizacion.md)
* [Pruebas Unitarias y Cobertura](pruebas-unitarias.md)
