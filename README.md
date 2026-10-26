# Expense Tracker — Control de Gastos Personales

Aplicación web moderna para el control, análisis y optimización de gastos personales a partir de estados de cuenta bancarios (PDF) y archivos de movimientos (CSV). Diseñada para operar en Quetzales (GTQ) con procesamiento local que protege la privacidad de tu información financiera.

![Dashboard Principal de Expense Tracker](docs/screenshots/dashboard-overview.png)

---

## 1. ¿Qué hace la aplicación?

Expense Tracker simplifica la administración de tus finanzas personales transformando documentos bancarios dispersos en información visual, interactiva y accionable.

### Visualización y Analítica en Tiempo Real (Dashboard 4 Paneles)
* **Tendencia Histórica por Categoría**: Visualiza la evolución mensual de tus gastos con curvas continuas y selector interactivo de categorías para aislar tendencias o comparar períodos.
* **¿A dónde va mi dinero?**: Identifica con rapidez los comercios donde más gastas o compras con mayor frecuencia, con cálculo automático de ticket promedio.
* **Patrones de Consumo y Alertas**: Descubre hábitos de gasto en vistas de 7 días (día de la semana) o 31 días (día del mes), con detección estadística automática de gastos inusuales o atípicos.
* **Antigüedad del Gasto y Financiamiento**: Gráfico interactivo que segmenta tus consumos en compras inmediatas, suscripciones recurrentes y financiamiento o Visacuotas, con selector por mes.

### Carga Inteligente de Estados de Cuenta
* **Soporte Multi-Banco**: Procesamiento directo de estados de cuenta en PDF de los principales bancos de Guatemala (**Banco G&T Continental**, **Banco Industrial** y **Banrural**) y archivos CSV de cualquier institución.
* **Carga por Lotes**: Sube uno o varios archivos simultáneamente (.pdf y .csv) con monitor de progreso en segundo plano.
* **Deduplicación Automática**: Descarta de forma inteligente transacciones idénticas repetidas para evitar duplicar gastos en tu historial.
* **Conversión de Moneda (USD a GTQ)**: Detecta cargos en dólares estadounidenses y los convierte automáticamente a Quetzales según la tasa de cambio oficial, conservando la divisa original para consulta y filtrado.

### Categorización Asistida y Personalizada
* **Catálogo Local de Guatemala**: Clasificación inmediata contra comercios populares del país (supermercados, restaurantes, servicios básicos, transporte, farmacias, suscripciones y más).
* **Asistencia Inteligente**: Identificación asistida por inteligencia artificial para categorizar automáticamente comercios no reconocidos.
* **Categorías a Medida**: Crea y personaliza tus propias categorías con nombres y colores distintivos.

### Gestión Dinámica de Movimientos (Sliding Drawer)
* **Panel Lateral Deslizante**: Consulta, busca por texto, filtra por categoría o moneda y edita transacciones sin salir de la vista analítica.
* **Interacción Directa (Drill-Down)**: Haz clic en cualquier barra o punto de los gráficos para filtrar automáticamente las transacciones relacionadas en el panel lateral.

### Suscripciones y Consejos de Ahorro
* **Monitoreo de Suscripciones**: Detección automática de cobros periódicos para visualizar compromisos mensuales fijos.
* **Recomendaciones de Ahorro**: Sugerencias personalizadas basadas en tus patrones de consumo para ayudarte a reducir gastos prescindibles.

### Privacidad y Seguridad por Diseño
* **Procesamiento Seguro**: Todo el análisis sensible de tus estados de cuenta se ejecuta de forma local en tu navegador y servidor propio. Tus datos personales y bancarios nunca se comparten ni se almacenan en servidores externos.

### Experiencia Visual Moderna
* **Tema Claro y Oscuro**: Interfaz adaptable con soporte completo para modo claro y modo oscuro, con persistencia automática de preferencias.

---

## 2. Vistas de la Aplicación

### Dashboard Analítico (Tema Claro)
Vista consolidada de los 4 paneles financieros con métricas en Quetzales, acceso al cajón de transacciones y selector de estados de cuenta.

![Dashboard en Modo Claro](docs/screenshots/dashboard-overview.png)

### Dashboard Analítico (Tema Oscuro)
Diseño estilizado para entornos con poca luz con paleta cromática de alto contraste.

![Dashboard en Modo Oscuro](docs/screenshots/dashboard-dark.png)

### Panel Lateral de Movimientos (Sliding Drawer)
Explora en detalle cada transacción, realiza filtros cruzados por moneda y categoría, o edita descripciones y montos.

![Panel Lateral de Transacciones](docs/screenshots/dashboard-drawer.png)

---

## 3. Flujo de Uso

1. **Carga tus documentos**: Arrastra o selecciona uno o varios estados de cuenta en PDF o archivos CSV.
2. **Visualiza tus finanzas**: Accede de inmediato al dashboard analítico interactivo de 4 paneles.
3. **Explora y categoriza**: Despliega el panel lateral para inspeccionar transacciones o ajustar categorías.
4. **Optimiza tu presupuesto**: Revisa tus suscripciones activas y oportunidades sugeridas de ahorro.

---

## 4. Instalación, Configuración y Ejecución

### Requisitos Previos
* **Node.js**: v20+ o v22+ LTS recomendado.
* **npm**: v10+.
* **Clave de API de Gemini**: Opcional, para la asistencia inteligente en bancos no reconocidos y sugerencias de ahorro (obtenida en [Google AI Studio](https://aistudio.google.com/)).

### Pasos de Instalación

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

Edita `.env.local` con tu configuración:

```env
GEMINI_API_KEY=tu_clave_de_gemini_aqui
USD_GTQ_EXCHANGE_RATE=7.85
UNCLASSIFIED_EXPENSES_THRESHOLD=10
```

```bash
# 4. Iniciar el servidor de desarrollo
npm run dev

# 5. Ejecutar suite de pruebas unitarias
npm test

# 6. Ejecutar pruebas End-to-End con Playwright
npm run test:e2e
```

Abre tu navegador en [http://localhost:3000](http://localhost:3000).

---

## 5. Índice de Documentación Técnica

Para conocer los detalles de implementación interna, arquitectura y guías de desarrollo, consulta los siguientes documentos:

1. **[Guía de Instalación, Configuración y Ejecución](docs/instalacion-y-ejecucion.md)**  
   Requisitos previos, variables de entorno, compilación para producción y despliegue en Vercel.

2. **[Estructura del Proyecto](docs/estructura-del-proyecto.md)**  
   Organización de directorios, capas de aplicación (App Router, componentes, utilidades) y responsabilidades de cada módulo.

3. **[Herramientas y Arquitectura Técnica](docs/herramientas-y-arquitectura.md)**  
   División de responsabilidades entre cliente, servidor y servicios en la nube, junto al diagrama de arquitectura.

4. **[Arquitectura de Procesamiento y Privacidad](docs/arquitectura-split-brain.md)**  
   Detalle técnico sobre el modelo de separación de procesamiento local frente a servicios externos y fronteras de seguridad.

5. **[Privacidad y Anonimización de Datos](docs/privacidad-y-anonimizacion.md)**  
   Reglas de detección y redacción de datos sensibles (PII), censura interactiva y validaciones de servidor.

6. **[Uso del LLM Externo y Manejo de Fallos](docs/uso-del-llm-y-manejo-de-fallos.md)**  
   Esquemas de interacción con Gemini, cascada de modelos de fallback y continuidad de operación ante errores de conexión.

7. **[Pruebas Unitarias y Automatización E2E](docs/pruebas-unitarias.md)**  
   Guía de ejecución para las 131 pruebas unitarias y pruebas de integración de navegador con Playwright.

8. **[Resumen de Implementación UI/UX](UI_UX_IMPLEMENTATION.md)**  
   Historial técnico de las mejoras visuales, controles colapsables, tutoriales interactivos y drill-down en paneles.

---

## 6. Stack de Tecnologías

* **Framework Full-Stack**: [Next.js 16](https://nextjs.org/) (App Router, Route Handlers)
* **Biblioteca de UI**: [React 19](https://react.dev/)
* **Lenguaje**: [TypeScript 5](https://www.typescriptlang.org/)
* **Estilos**: [Tailwind CSS 4](https://tailwindcss.com/)
* **Inteligencia Artificial**: [Google Gen AI SDK (`@google/genai`)](https://www.npmjs.com/package/@google/genai)
* **Procesamiento de Documentos**: [pdf-parse](https://www.npmjs.com/package/pdf-parse) y [PapaParse](https://www.papaparse.com/)
* **Iconografía**: [Lucide React](https://lucide.dev/)
* **Testing Unitario**: Node.js Test Runner con [tsx](https://github.com/privatenumber/tsx)
* **Testing E2E**: [Playwright](https://playwright.dev/)
* **Hosting**: [Vercel](https://vercel.com/)
