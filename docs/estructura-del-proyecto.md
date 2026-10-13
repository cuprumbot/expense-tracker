# Estructura del Proyecto

Este documento describe la organización de carpetas y archivos en el proyecto **Control de Gastos (Expense Tracker)**, detallando la responsabilidad de cada capa arquitectónica, módulo de utilidades y componente de interfaz.

---

## 1. Árbol de Directorios

```text
expense-tracker/
├── .agents/                      # Configuración de habilidades y reglas de agentes
├── demo/                         # Archivos de prueba y demostración (PDF y CSV)
│   ├── demo1.pdf                 # Estado de cuenta real Banco G&T Continental (anonimizado)
│   ├── demo2.pdf                 # Estado de cuenta real Banco G&T Continental (anonimizado)
│   ├── sample-expenses.csv       # Archivo CSV de ejemplo con columnas de gastos
│   └── unsupported-bank-statement.txt # Extracto de texto de banco no soportado
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
│   │   │   │   └── route.ts      # Clasificación asistida por IA para gastos pendientes
│   │   │   ├── extract-transactions/
│   │   │   │   └── route.ts      # Extracción estructurada con Gemini para bancos no compatibles
│   │   │   ├── parse-pdf/
│   │   │   │   └── route.ts      # Extracción de texto y parser local de Banco G&T
│   │   │   └── suggest-savings/
│   │   │       └── route.ts      # Generación de sugerencias de ahorro a partir de totales agregados
│   │   ├── favicon.ico           # Icono de la aplicación
│   │   ├── globals.css           # Estilos base y directivas de Tailwind CSS 4
│   │   ├── layout.tsx            # Plantilla raíz HTML y metadatos
│   │   └── page.tsx              # Página principal (Cliente) y orquestador de estado
│   ├── components/               # Componentes modulares de interfaz de usuario (React)
│   │   ├── anonymization-modal.tsx   # Modal de revisión y censura interactiva de PII
│   │   ├── column-mapping-modal.tsx  # Modal para asociar columnas en CSV ambiguos
│   │   ├── custom-category-modal.tsx # Modal para creación de nuevas categorías
│   │   ├── expense-dashboard.tsx     # Métricas agregadas, porcentajes y alertas
│   │   ├── file-upload.tsx           # Área de carga arrastrar-y-soltar con validación
│   │   ├── icons.tsx                 # Iconos SVG vectoriales basados en Lucide React
│   │   ├── savings-suggestions.tsx   # Panel interactivo de sugerencias de ahorro
│   │   └── transaction-table.tsx     # Tabla de movimientos con filtros y edición
│   ├── data/
│   │   └── merchant-catalog.json # Directorio de comercios y categorías de Guatemala
│   ├── lib/                      # Lógica de negocio, parsers, validadores y clientes
│   │   ├── anonymizer.ts             # Motor local de detección y sustitución de PII
│   │   ├── anonymizer.test.ts        # Pruebas de anonimización
│   │   ├── csv-parser.ts             # Parser determinista de CSV (PapaParse)
│   │   ├── csv-parser.test.ts        # Pruebas de parseo CSV
│   │   ├── currency.ts               # Utilidades de moneda (GTQ / Q)
│   │   ├── currency.test.ts          # Pruebas de formateo de moneda
│   │   ├── expense-classifier.ts     # Clasificador local por catálogo y suscripciones
│   │   ├── expense-classifier.test.ts # Pruebas del clasificador local
│   │   ├── expense-review.test.ts    # Pruebas de edición y manipulación manual
│   │   ├── file-validator.ts         # Validador de formatos permitidos (PDF/CSV)
│   │   ├── file-validator.test.ts    # Pruebas del validador de archivos
│   │   ├── llm-classifier.ts         # Integración y prompts de clasificación con Gemini
│   │   ├── llm-classifier.test.ts    # Pruebas del clasificador LLM
│   │   ├── llm-extractor.ts          # Integración y prompts de extracción con Gemini
│   │   ├── llm-extractor.test.ts     # Pruebas del extractor LLM
│   │   ├── pdf-parser.ts             # Parser local con pdf-parse y soporte Banco G&T
│   │   ├── pdf-parser.test.ts        # Pruebas del parser PDF
│   │   ├── reporting.ts              # Agregación de métricas, totales y porcentajes
│   │   ├── reporting.test.ts         # Pruebas del motor de reportes
│   │   ├── savings-advisor.ts        # Construcción de payload y análisis de ahorro
│   │   ├── savings-advisor.test.ts   # Pruebas del asesor de ahorro
│   │   ├── storage.ts                # Persistencia y recuperación en localStorage
│   │   └── storage.test.ts           # Pruebas de resiliencia de almacenamiento local
│   └── types/
│       └── transaction.ts        # Definiciones de tipos canónicos de TypeScript
├── .env.example                  # Plantilla de variables de entorno
├── .gitignore                    # Reglas de exclusión para Git
├── architecture-diagram.html     # Diagrama de arquitectura interactivo (HTML/SVG)
├── architecture-diagram.png      # Captura visual del diagrama de arquitectura
├── ARCHITECTURE_DIAGRAM.md       # Descripción técnica de la arquitectura
├── DESCRIPTION.md                # Especificaciones funcionales del proyecto
├── eslint.config.mjs             # Configuración de ESLint
├── next.config.ts                # Configuración de Next.js
├── package.json                  # Manifiesto de dependencias y scripts de npm
├── README.md                     # Índice principal y resumen del proyecto
├── SPEC.md                       # Especificación técnica original y flujo de usuario
├── tsconfig.json                 # Configuración del compilador de TypeScript
└── USER_STORIES.md               # Historias de usuario y seguimiento de desarrollo
```

---

## 2. Descripción Detallada por Capas

### 2.1. Capa de Aplicación (`src/app/`)

* **`page.tsx`**: Es el componente principal de la aplicación cliente (`use client`). Mantiene todo el estado interactivo: transacciones activas, resumen de importación, categorías personalizadas, recomendaciones de ahorro y control de los modales. Además, orquesta la persistencia automática en `localStorage` y las transiciones del flujo.
* **`layout.tsx`**: Define la estructura visual base de la aplicación (etiquetas `html`, `body`), fuentes tipográficas y metadatos SEO.
* **`globals.css`**: Configuración de estilos globales con Tailwind CSS 4, definiendo paletas neutrales y modo oscuro.

#### Endpoints de Servidor (`src/app/api/`)

Todos los endpoints se ejecutan como **Route Handlers de Next.js** en el servidor Node.js y nunca exponen claves de API al cliente:

1. **`parse-pdf/route.ts`**:
   * Recibe el archivo PDF cargado mediante `multipart/form-data`.
   * Extrae el texto utilizando `pdf-parse` de manera 100% local.
   * Identifica si el estado de cuenta pertenece a un banco soportado (Banco G&T Continental).
   * Si es soportado, ejecuta el parser especializado y retorna las transacciones estructuradas. Si no, retorna el texto crudo y la bandera `isSupportedBank: false` para activar el flujo de anonimización local en el cliente.
2. **`extract-transactions/route.ts`**:
   * Recibe el texto sanitizado y anonimizado desde el cliente.
   * Aplica la validación estricta de servidor `validateSanitizedPayload` para impedir envíos con datos sensibles no redactados.
   * Invoca a Google Gemini Pro con un esquema de salida JSON riguroso para extraer únicamente compras y débitos en Quetzales.
3. **`classify-expenses/route.ts`**:
   * Recibe una lista de descripciones y montos pendientes junto a las categorías disponibles.
   * Valida que no se incluya información sensible antes de invocar a Gemini Pro.
   * Asigna las categorías correspondientes mediante inteligencia artificial.
4. **`suggest-savings/route.ts`**:
   * Recibe **únicamente** totales agregados por categoría y el desglose de servicios recurrentes/suscripciones.
   * Solicita a Gemini Pro recomendaciones financieras personalizadas para el usuario en Guatemala.

---

### 2.2. Componentes de Interfaz (`src/components/`)

* **`file-upload.tsx`**: Proporciona una zona de arrastrar y soltar archivos, botones de selección y validación inmediata del formato (`.pdf` y `.csv`).
* **`column-mapping-modal.tsx`**: Se despliega cuando un archivo CSV posee encabezados ambiguos o no estándares, permitiendo al usuario asignar manualmente las columnas de fecha, descripción y monto.
* **`anonymization-modal.tsx`**: Muestra una vista previa interactiva del texto extraído de un estado de cuenta no soportado, destacando en tiempo real las redacciones de nombres, cuentas, DPI y teléfonos. Permite al usuario redactar palabras adicionales antes de enviar la información al LLM.
* **`transaction-table.tsx`**: Tabla integral para visualizar y gestionar transacciones. Incluye buscador por texto, filtro por categoría, cambio de categoría individual o masivo, edición de montos y fechas, marcado/desmarcado de suscripciones y eliminación de filas.
* **`custom-category-modal.tsx`**: Permite al usuario registrar nuevas categorías con nombre y color personalizado.
* **`expense-dashboard.tsx`**: Panel analítico con tarjetas de métricas (gasto total, número de movimientos, gasto mensual en suscripciones), barras de distribución porcentual por categoría y alertas de suscripciones activas.
* **`savings-suggestions.tsx`**: Panel que permite solicitar y desplegar sugerencias de ahorro generadas por IA, organizadas en oportunidades inmediatas, estrategias a largo plazo y análisis comparativo por categoría.
* **`icons.tsx`**: Biblioteca de iconos SVG vectoriales basados en Lucide React, garantizando una estética moderna sin emojis ni caracteres no estándares.

---

### 2.3. Módulos de Lógica de Negocio (`src/lib/`)

* **`anonymizer.ts`**: Motor central de privacidad. Ejecuta expresiones regulares y análisis heurístico para detectar y reemplazar nombres de titulares, direcciones, cuentas bancarias, IBAN, DPI, NIT, teléfonos y correos electrónicos con marcadores legibles (`[NOMBRE_REDACTADO]`, `[CUENTA_REDACTADA]`, etc.).
* **`currency.ts`**: Formateo y análisis de montos en Quetzales guatemaltecos (`GTQ` / `Q`), contemplando separadores de miles, decimales y signos contables.
* **`csv-parser.ts`**: Lector de archivos CSV basado en PapaParse, con capacidad de deducción automática de columnas y normalización de fechas guatemaltecas.
* **`pdf-parser.ts`**: Parser de documentos PDF con `pdf-parse` y lógica especializada para Banco G&T Continental. Filtra automáticamente pagos de tarjeta, créditos, abonos y transacciones en dólares estadounidenses.
* **`expense-classifier.ts`**: Clasificador determinista que cruza cada descripción de movimiento con un catálogo en memoria de comercios guatemaltecos. Identifica automáticamente suscripciones digitales (Netflix, Spotify, etc.) y evalúa el umbral de pendientes (5).
* **`reporting.ts`**: Realiza los cálculos de agregación por categoría, porcentajes del presupuesto total y filtros combinados.
* **`storage.ts`**: Administra la persistencia segura en `localStorage` (`expense_tracker_session_v1` y `expense_tracker_categories_v1`), con detección de cuotas y recuperación ante datos corruptos.
* **`llm-extractor.ts`**: Construcción de prompts del sistema y usuario, validación de payloads y procesamiento de respuestas JSON para la extracción de transacciones con Gemini.
* **`llm-classifier.ts`**: Lógica de integración con Gemini para clasificar transacciones pendientes mediante prompts estructurados y fallback de modelos.
* **`savings-advisor.ts`**: Constructor del payload agregado de ahorro y parser de recomendaciones financieras devueltas por Gemini.
* **`file-validator.ts`**: Validación técnica de extensiones y tipos MIME de archivos.

---

### 2.4. Datos y Catálogos (`src/data/`)

* **`merchant-catalog.json`**: Base de conocimiento local con comercios populares en Guatemala agrupados por categoría (e.g., Walmart, La Torre, Paiz, Shell, Uno, San Martín, McDonald's, EEGSA, Empagua, Tigo, Claro, Netflix, etc.) y definición de colores de interfaz.

---

### 2.5. Definiciones de Tipos (`src/types/`)

* **`transaction.ts`**: Contratos canónicos de TypeScript que garantizan consistencia en toda la aplicación: `Transaction`, `CSVParsingSummary`, `CSVColumnMapping`, `CustomCategory`, entre otros.

---

## Enlaces de Referencia

* [Volver al README Principal](../README.md)
* [Instalación, Configuración y Ejecución](instalacion-y-ejecucion.md)
* [Arquitectura Split-Brain](arquitectura-split-brain.md)
* [Herramientas y Arquitectura Técnica](herramientas-y-arquitectura.md)
* [Uso del LLM Externo y Manejo de Fallos](uso-del-llm-y-manejo-de-fallos.md)
* [Privacidad y Anonimización de Datos](privacidad-y-anonimizacion.md)
* [Pruebas Unitarias y Cobertura](pruebas-unitarias.md)
