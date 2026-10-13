# Control de Gastos Personales (Expense Tracker)

Aplicación web moderna y privada para el control y reducción de gastos mensuales a partir de estados de cuenta bancarios (PDF) o archivos de movimientos (CSV), adaptada para usuarios en **Guatemala** y operando en **Quetzales guatemaltecos (GTQ / Q)**.

La aplicación implementa una arquitectura **Split-Brain (Cerebro Dividido)**: todos los datos personales y el procesamiento principal se gestionan de forma local, utilizando inteligencia artificial externa (Google Gemini Pro) únicamente sobre datos previamente anonimizados o métricas agregadas para clasificar gastos pendientes y generar recomendaciones de ahorro.

---

## 1. ¿Qué hace la aplicación?

* **Importación Flexible de Movimientos**:
  * **Estados de Cuenta en PDF**: Extrae el texto de manera local. Si el documento proviene de un banco con parser propio (**Banco G&T Continental**), procesa los consumos automáticamente filtrando pagos de tarjeta, créditos y cargos en dólares. Si proviene de otro banco, anonimiza localmente el texto y utiliza Gemini Pro para extraer las transacciones en formato estructurado.
  * **Archivos CSV**: Permite cargar hojas de cálculo de movimientos mediante **PapaParse**. Si las columnas son ambiguas, ofrece un asistente visual para mapear fecha, descripción y monto.
* **Privacidad Estricta (Split-Brain)**:
  * Redacta de forma local nombres del titular, transferencias ACH, números de cuenta, IBAN, números de tarjeta, DPI (CUI), NIT, direcciones físicas, correos electrónicos y teléfonos antes de cualquier llamada externa.
  * Cuenta con un **modal interactivo de censura** donde el usuario valida el texto redactado y puede agregar términos personalizados antes de autorizar su envío al LLM.
* **Clasificación Inteligente y Adaptativa**:
  * Cruza las transacciones con un **catálogo local de comercios de Guatemala** (`merchant-catalog.json`), reconociendo de inmediato supermercados, gasolineras, restaurantes, servicios básicos y suscripciones.
  * Si quedan más de 5 gastos sin categorizar, consulta a Gemini Pro para sugerir categorías. Si son 5 o menos, evita llamadas innecesarias para ahorrar costos y permite clasificación manual.
* **Detección Automática de Suscripciones**:
  * Detecta cobros periódicos (Netflix, Spotify, membresías, etc.), calcula el compromiso mensual en Quetzales y alerta al usuario sobre servicios activos.
* **Gestión y Personalización Completa**:
  * Tabla interactiva con búsqueda en tiempo real, filtros por categoría, edición de montos y fechas, asignación masiva, borrado de movimientos y creación de categorías personalizadas con colores propios.
* **Panel de Estadísticas y Reportes**:
  * Visualización de distribución de gastos por categoría, porcentajes del presupuesto total y comparativas financieras.
* **Sugerencias de Ahorro con IA**:
  * Envía **únicamente** totales consolidados por categoría y el listado de suscripciones para que Gemini Pro genere oportunidades inmediatas de ahorro, estrategias a largo plazo y diagnóstico por categoría adaptadas a Guatemala.
* **Persistencia Local Segura**:
  * Guarda automáticamente la sesión activa y las categorías personalizadas en el `localStorage` del navegador. **No requiere registro de usuario ni utiliza bases de datos remotas.**

---

## 2. Flujo de Usuario Simplificado (User Flow)

El siguiente diagrama ilustra el flujo de ejecución del sistema, tal como se define en la especificación técnica (`SPEC.md`):

```mermaid
flowchart TD
    A[Start] --> B[Upload PDF/CSV]
    B --> |CSV| C[Identify columns]
    B --> |PDF from known bank| D[Extract data]
    B --> |PDF from unknown bank| E[Anonymize]
    E --> F[Extract using LLM]
    C --> G[Structure data]
    D --> G
    F --> G
    G --> H[Classify expenses locally]
    H --> |Unclassified <= 5| I[Customization]
    H --> |Unclassified > 5| J[Classify using LLM]
    J --> I
    I --> K[Data reporting]
    K --> |Aggregated data| L[Get suggestions using LLM]
```

### Descripción del Flujo

1. **Carga**: El usuario sube su estado de cuenta en PDF o un archivo CSV.
2. **Detección de Formato**:
   * Si es **CSV**, se identifican las columnas localmente.
   * Si es **PDF de banco conocido** (Banco G&T), se extraen los consumos de forma local y determinista.
   * Si es **PDF de banco no soportado**, se ejecuta la **anonimización local de PII**, el usuario confirma el texto censurado y Gemini Pro extrae las transacciones.
3. **Estructuración**: Los movimientos se estandarizan en un objeto JSON en memoria; a partir de este punto, el archivo original no se vuelve a utilizar.
4. **Clasificación Local**: Se categorizan los gastos usando el catálogo de comercios de Guatemala.
5. **Evaluación de Pendientes**:
   * Si quedan `<= 5` gastos sin clasificar, se pasa directo a la personalización manual (ahorro de llamadas de IA).
   * Si quedan `> 5` gastos sin clasificar, Gemini Pro clasifica los pendientes de forma asistida.
6. **Revisión y Personalización**: El usuario revisa, ajusta o añade categorías personalizadas.
7. **Reportes y Sugerencias**: Se generan gráficos y métricas consolidadas. Opcionalmente, se envían únicamente los totales agregados al LLM para obtener recomendaciones de ahorro.

---

## 3. Instalación, Configuración y Ejecución Rápida

### Requisitos Previos
* **Node.js**: v20+ o v22+ LTS recomendado.
* **npm**: v10+.
* **Clave de API de Gemini**: Obtenida en [Google AI Studio](https://aistudio.google.com/).

### Pasos Rápidos

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

# 5. Ejecutar la suite de pruebas unitarias
npm test
```

Abre tu navegador en [http://localhost:3000](http://localhost:3000).

> Para obtener instrucciones completas sobre compilación para producción (`npm run build`), linters y despliegue en Vercel, consulta la [Guía de Instalación y Ejecución](docs/instalacion-y-ejecucion.md).

---

## 4. Índice de Documentación del Proyecto

La documentación detallada se encuentra organizada en la carpeta [`docs/`](docs/) para facilitar su lectura y navegación en GitHub:

1. 🚀 **[Guía de Instalación, Configuración y Ejecución](docs/instalacion-y-ejecucion.md)**  
   *Requisitos previos, configuración de variables de entorno, comandos de compilación, ejecución y despliegue en Vercel.*

2. 📁 **[Estructura del Proyecto](docs/estructura-del-proyecto.md)**  
   *Árbol completo de directorios, capas de la aplicación (App Router, componentes, librerías, catálogos) y responsabilidades de cada módulo.*

3. 🧠 **[Arquitectura Split-Brain (Cerebro Dividido)](docs/arquitectura-split-brain.md)**  
   *Explicación conceptual de la arquitectura, tablas comparativas de procesamiento local vs. LLM externo y las 4 razones de diseño: Privacidad, Costo, Latencia y Completitud.*

4. 🛠️ **[Herramientas y Arquitectura Técnica](docs/herramientas-y-arquitectura.md)**  
   *Tablas detalladas de responsabilidades (Navegador, Servidor Next.js, Gemini API), pila tecnológica completa y diagrama de arquitectura del sistema.*

5. 🤖 **[Uso del LLM Externo y Manejo de Fallos](docs/uso-del-llm-y-manejo-de-fallos.md)**  
   *Para qué se usa exactamente el LLM, estructura de payloads, cascada de modelos de fallback y cómo la aplicación continúa operando al 100% ante fallos de conexión o cuota.*

6. 🔒 **[Privacidad y Anonimización de Datos](docs/privacidad-y-anonimizacion.md)**  
   *Filosofía de privacidad por diseño, fragmentos de código de expresiones regulares, heurística de detección de titular, validación estricta de servidor y censura interactiva.*

7. 🧪 **[Pruebas Unitarias y Cobertura](docs/pruebas-unitarias.md)**  
   *Cómo ejecutar las pruebas con Node.js Test Runner y desglose exhaustivo de los 12 archivos de prueba (18 suites, 79 pruebas unitarias).*

---

## 5. Diagrama de Arquitectura Técnica

El proyecto cuenta con un diagrama arquitectónico exhaustivo:

* **Imagen Estática**: [architecture-diagram.png](architecture-diagram.png)
* **Diagrama Interactivo**: [architecture-diagram.html](architecture-diagram.html)
* **Documento Técnico**: [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md)

---

## 6. Pila Tecnológica

* **Framework Full-Stack**: [Next.js 16](https://nextjs.org/) (App Router, Route Handlers)
* **Biblioteca de UI**: [React 19](https://react.dev/)
* **Lenguaje**: [TypeScript 5](https://www.typescriptlang.org/)
* **Estilos**: [Tailwind CSS 4](https://tailwindcss.com/)
* **Inteligencia Artificial**: [Google Gen AI SDK (`@google/genai`)](https://www.npmjs.com/package/@google/genai)
* **Procesamiento de Documentos**: [pdf-parse](https://www.npmjs.com/package/pdf-parse) y [PapaParse](https://www.papaparse.com/)
* **Iconografía**: [Lucide React](https://lucide.dev/)
* **Testing**: Node.js Test Runner con [tsx](https://github.com/privatenumber/tsx)
* **Hosting**: [Vercel](https://vercel.com/)
