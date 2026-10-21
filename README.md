# Control de Gastos Personales (Expense Tracker)

Aplicación para el control y reducción de gastos mensuales a partir de estados de cuenta bancarios (PDF) o archivos de movimientos (CSV).

La aplicación implementa una arquitectura **Split-Brain (Cerebro Dividido)**: todos los datos personales y el procesamiento principal se gestionan de forma local, utilizando inteligencia artificial externa (Google Gemini Pro) únicamente sobre datos previamente anonimizados o métricas agregadas para clasificar gastos pendientes y generar recomendaciones de ahorro.

---

## 1. ¿Qué hace la aplicación?

* **Importación y Carga por Lotes de Estados de Cuenta**:
  * **Carga Múltiple y Cola por Lotes**: Permite cargar uno o varios archivos simultáneamente (.pdf y .csv). Un modal de gestión muestra la cola de procesamiento, estado individual de cada documento y progreso global acumulado.
  * **Deduplicación Inteligente**: Descarta de forma automática transacciones exactamente duplicadas (misma fecha, descripción idéntica y mismo monto) tanto dentro del lote como frente a la sesión activa, protegiendo compras legítimas con datos similares y notificando al usuario con transparencia.
  * **Conversión Multi-Moneda (USD a GTQ)**: Extrae transacciones en dólares estadounidenses (`$`) tanto de estados de cuenta PDF de Banco G&T como de archivos CSV, convirtiéndolas automáticamente a Quetzales según la tasa de cambio oficial (por defecto Q 7.85 por USD) y conservando la divisa original en metadatos para visualización y filtrado.
  * **Estados de Cuenta en PDF**: Extrae el texto de manera local. Si el documento proviene de un banco con parser propio (**Banco G&T Continental**), procesa los consumos automáticamente filtrando pagos de tarjeta y créditos. Si proviene de otro banco, anonimiza localmente el texto y utiliza Gemini Pro para extraer las transacciones en formato estructurado.
  * **Archivos CSV**: Permite cargar hojas de cálculo de movimientos mediante **PapaParse**. Si las columnas son ambiguas, ofrece un asistente visual para mapear fecha, descripción, monto y divisa.
* **Privacidad Estricta (Split-Brain)**:
  * Redacta de forma local nombres del titular, transferencias ACH, números de cuenta, IBAN, números de tarjeta, DPI (CUI), NIT, direcciones físicas, correos electrónicos y teléfonos antes de cualquier llamada externa.
  * Cuenta con un **modal interactivo de censura** donde el usuario valida el texto redactado y puede agregar términos personalizados antes de autorizar su envío al LLM.
* **Clasificación Inteligente y Adaptativa**:
  * Cruza las transacciones con un **catálogo local de 11 categorías de comercios de Guatemala** (`merchant-catalog.json`), reconociendo de inmediato supermercados, restaurantes, gasolineras, servicios básicos, salud, hogar, educación, mascotas y suscripciones.
  * Si quedan más de 10 gastos sin categorizar, consulta a Gemini Pro para sugerir categorías. Si son 10 o menos, evita llamadas innecesarias para ahorrar costos y permite clasificación manual.
* **Dashboard Analítico Financiero (Cuadrícula 2x2)**:
  * **Panel 1: Tendencia Histórica por Categoría**: Gráfico de líneas SVG con curvas Bézier cúbicas, filtrado interactivo por píldoras de categoría, escala vertical adaptativa, áreas de hover estables y etiquetas de fecha multilínea optimizadas.
  * **Panel 2: ¿A dónde va mi dinero?**: Gráfico de barras horizontales de los 5 comercios principales con selector dual: por volumen total gastado (Q) o por frecuencia de visitas con ticket promedio.
  * **Panel 3: Patrones de Consumo**: Gráfico de barras temporales con alternancia entre 7 días de la semana y 31 días del mes, con heurísticas estadísticas ($\mu + 1.75\sigma$) para detección de consumos atípicos.
  * **Panel 4: Antigüedad del Gasto**: Gráfico de dona SVG interactivo que particiona los consumos en 3 segmentos de decisión (*Visacuotas y Financiamiento*, *Suscripciones Recurrentes* y *Compras Inmediatas*), con selector de mes.
* **Drawer Lateral de Movimientos (Sliding Drawer)**:
  * Panel lateral deslizante que permite buscar, filtrar por categoría y editar o categorizar transacciones sin salir del dashboard analítico, actualizando las métricas en tiempo real.
* **Experiencia de Usuario Moderna**:
  * **Tema Claro y Oscuro**: Selector de tema (`ThemeToggle`) persistente en `localStorage`, inicializado en tema claro por defecto.
  * **Transición Directa**: Acceso inmediato al dashboard financiero sin pantallas intermedias de bloqueo.
  * **Chips Reactivos**: Indicador de clasificación con IA (`#chip-classifying-expenses`) y chip de atención animado (`animate-pulse`) cuando restan más de 10 transacciones por categorizar.
  * **Notificaciones Flotantes (Toasts)**: Avisos no intrusivos en la esquina inferior para duplicados, confirmación de lotes y clasificación asistida con auto-cierre tras 7 segundos.
* **Detección Automática de Suscripciones**:
  * Detecta cobros periódicos (Netflix, Spotify, etc.), calcula el compromiso mensual en Quetzales y alerta al usuario sobre servicios activos.
* **Gestión, Filtrado y Personalización Completa**:
  * Búsqueda en tiempo real, filtros por categoría y por moneda (Todas, Solo GTQ, Convertidas de USD con badges explicativos), edición de montos y fechas, asignación masiva, borrado de movimientos y creación de categorías personalizadas con colores propios.
* **Sugerencias de Ahorro con IA**:
  * Envía **únicamente** totales consolidados por categoría y el listado de suscripciones para que Gemini Pro genere oportunidades inmediatas de ahorro, estrategias a largo plazo y diagnóstico por categoría adaptadas a Guatemala.
* **Continuidad de Sesión y Reinicio Selectivo**:
  * Mantiene la sesión activa incremental en el `localStorage` del navegador (nuevos archivos agregan compras sin sobreescribir). Dispone de un modal explícito de reinicio que permite limpiar las transacciones conservando las categorías personalizadas del usuario, o realizar un restablecimiento de fábrica total.

---

## 2. Flujo de Ejecución

El siguiente diagrama ilustra el flujo de ejecución del sistema:

```mermaid
flowchart TD
    A[Start] --> B[Upload PDF/CSV batch]
    B --> |Deduplicate| C[Discard exact duplicates]
    C --> |CSV| D[Identify columns & currency]
    C --> |PDF from known bank| E[Extract data & convert USD]
    C --> |PDF from unknown bank| F[Anonymize PII locally]
    F --> G[Extract using LLM]
    D --> H[Structure data JSON]
    E --> H
    G --> H
    H --> I[Classify expenses locally - 11 categories]
    I --> |Pending <= 10| J[Direct to 4-Panel Dashboard]
    I --> |Pending > 10| K[Classify using LLM & Attention Chip]
    K --> J
    J --> L[Sliding Drawer: Inspection & Triage]
    J --> M[AI Savings Suggestions]
```

### Descripción del Flujo

1. **Carga y Deduplicación**: El usuario sube uno o múltiples estados de cuenta en PDF o archivos CSV. El sistema descarta duplicados exactos frente a compras previas y alerta con un pop-up flotante prioritario.
2. **Detección de Formato y Conversión Multi-Moneda**:
   * Si es **CSV**, se identifican las columnas y la divisa localmente.
   * Si es **PDF de banco conocido** (Banco G&T), se extraen los consumos en GTQ y se convierten a Quetzales los consumos en USD (7.85) de forma local y determinista.
   * Si es **PDF de banco no soportado**, se ejecuta la anonimización local de PII, el usuario confirma el texto censurado y Gemini Pro extrae las transacciones.
3. **Estructuración**: Los movimientos se estandarizan en un objeto JSON en memoria; a partir de este punto, el archivo original no se vuelve a utilizar.
4. **Clasificación Local**: Se categorizan los gastos usando el catálogo de 11 categorías de comercios de Guatemala.
5. **Evaluación de Pendientes y Navegación Directa**:
   * El usuario pasa inmediatamente al **Dashboard Financiero de 4 paneles**.
   * Si restan `> 10` gastos pendientes, se muestra el chip de clasificación con IA y se ejecuta en segundo plano. Si quedan pendientes tras clasificar, el chip se anima sutilmente para llamar la atención.
6. **Inspección en Drawer Lateral**: El usuario puede desplegar el sliding drawer en cualquier momento para inspeccionar la tabla de movimientos, editar registros o añadir categorías sin abandonar los gráficos.
7. **Sugerencias de Ahorro**: Opcionalmente, se envían únicamente los totales agregados y suscripciones a Gemini Pro para obtener recomendaciones de ahorro.

---

## 3. Instalación, Configuración y Ejecución

### Requisitos Previos
* **Node.js**: v20+ o v22+ LTS recomendado.
* **npm**: v10+.
* **Clave de API de Gemini**: Obtenida en [Google AI Studio](https://aistudio.google.com/).

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/expense-tracker.git
cd expense-tracker

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# (En Windows PowerShell: Copy-Item .env.example .env.local)
```

Edita `.env.local` y añade tu clave:

```env
GEMINI_API_KEY=tu_clave_de_gemini_aqui
```

```bash
# 4. Iniciar el servidor de desarrollo
npm run dev

# 5. Ejecutar la suite de pruebas unitarias (131 pruebas)
npm test

# 6. Ejecutar la suite de pruebas E2E con Playwright
npm run test:e2e
```

Abre tu navegador en [http://localhost:3000](http://localhost:3000).

> Para obtener instrucciones completas sobre compilación para producción (`npm run build`), linters y despliegue en Vercel, consulta la [Guía de Instalación y Ejecución](docs/instalacion-y-ejecucion.md).

---

## 4. Índice de Documentación del Proyecto

La documentación detallada se encuentra organizada en la carpeta [`docs/`](docs/) y archivos especializados:

1. **[Implementación del Dashboard Financiero](DASHBOARD_IMPLEMENTATION.md)**  
   *Detalle técnico de la arquitectura de 4 paneles SVG (US-029 a US-040), sliding drawer, motor de series de tiempo, atípicos estadísticos y segmentación de antigüedad.*

2. **[Guía de Instalación, Configuración y Ejecución](docs/instalacion-y-ejecucion.md)**  
   *Requisitos previos, configuración de variables de entorno, comandos de compilación, ejecución y despliegue en Vercel.*

3. **[Estructura del Proyecto](docs/estructura-del-proyecto.md)**  
   *Árbol completo de directorios, capas de la aplicación (App Router, componentes, librerías, catálogos) y responsabilidades de cada módulo.*

4. **[Arquitectura Split-Brain (Cerebro Dividido)](docs/arquitectura-split-brain.md)**  
   *Explicación conceptual de la arquitectura, tablas comparativas de procesamiento local vs. LLM externo y las 4 razones de diseño: Privacidad, Costo, Latencia y Completitud.*

5. **[Herramientas y Arquitectura Técnica](docs/herramientas-y-arquitectura.md)**  
   *Tablas detalladas de responsabilidades (Navegador, Servidor Next.js, Gemini API), pila tecnológica completa y diagrama de arquitectura del sistema.*

6. **[Uso del LLM Externo y Manejo de Fallos](docs/uso-del-llm-y-manejo-de-fallos.md)**  
   *Para qué se usa exactamente el LLM, estructura de payloads, cascada de modelos de fallback y cómo la aplicación continúa operando al 100% ante fallos de conexión o cuota.*

7. **[Privacidad y Anonimización de Datos](docs/privacidad-y-anonimizacion.md)**  
   *Filosofía de privacidad por diseño, fragmentos de código de expresiones regulares, heurística de detección de titular, validación estricta de servidor y censura interactiva.*

8. **[Pruebas Unitarias y E2E](docs/pruebas-unitarias.md)**  
   *Cómo ejecutar las pruebas con Node.js Test Runner (31 suites, 131 pruebas unitarias) y automatización End-to-End con Playwright.*

---

## 5. Stack de Tecnologías

* **Framework Full-Stack**: [Next.js 16](https://nextjs.org/) (App Router, Route Handlers)
* **Biblioteca de UI**: [React 19](https://react.dev/)
* **Lenguaje**: [TypeScript 5](https://www.typescriptlang.org/)
* **Estilos**: [Tailwind CSS 4](https://tailwindcss.com/)
* **Inteligencia Artificial**: [Google Gen AI SDK (`@google/genai`)](https://www.npmjs.com/package/@google/genai)
* **Procesamiento de Documentos**: [pdf-parse](https://www.npmjs.com/package/pdf-parse) y [PapaParse](https://www.papaparse.com/)
* **Iconografía**: [Lucide React](https://lucide.dev/)
* **Testing Unitario**: Node.js Test Runner nativo con [tsx](https://github.com/privatenumber/tsx)
* **Testing E2E**: [Playwright](https://playwright.dev/)
* **Hosting**: [Vercel](https://vercel.com/)
