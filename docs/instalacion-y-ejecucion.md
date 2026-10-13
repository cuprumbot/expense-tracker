# Guía de Instalación, Configuración y Ejecución

Esta guía detalla los pasos necesarios para instalar, configurar, ejecutar y desplegar el proyecto **Control de Gastos (Expense Tracker)** en un entorno local y en producción.

---

## 1. Requisitos Previos

Antes de comenzar, asegúrate de contar con las siguientes herramientas instaladas en tu sistema:

* **Node.js**: Versión `20.x` o superior (se recomienda Node.js 22 LTS).
* **npm**: Versión `10.x` o superior (gestor de paquetes oficial del proyecto).
* **Git**: Para el clonado y control de versiones del repositorio.
* **Clave de API de Google Gemini**: Se requiere una API Key obtenida a través de [Google AI Studio](https://aistudio.google.com/) para las funciones asistidas por inteligencia artificial (extracción de bancos no soportados, clasificación de gastos pendientes y sugerencias de ahorro).

---

## 2. Instalación Paso a Paso

### Paso 1: Clonar el Repositorio

Clona el repositorio desde GitHub y accede al directorio del proyecto:

```bash
git clone https://github.com/tu-usuario/expense-tracker.git
cd expense-tracker
```

### Paso 2: Instalar Dependencias

Instala los paquetes necesarios utilizando `npm`:

```bash
npm install
```

Este comando instalará dependencias clave como:
* Next.js 16 (App Router)
* React 19
* Tailwind CSS 4
* `@google/genai` (SDK oficial de Google AI Studio)
* `pdf-parse` (procesamiento local de documentos PDF)
* `papaparse` (procesamiento local de archivos CSV)
* `lucide-react` (iconografía de interfaz)
* `tsx` y TypeScript 5 (entorno de desarrollo y ejecución de pruebas)

---

## 3. Configuración de Variables de Entorno

El proyecto incluye un archivo de plantilla llamado `.env.example`.

Crea una copia de este archivo con el nombre `.env.local` en la raíz del proyecto:

```bash
# En Windows (PowerShell)
Copy-Item .env.example .env.local

# En Linux / macOS
cp .env.example .env.local
```

### Variables Disponibles

Edita el archivo `.env.local` con tu editor de preferencia:

```env
# Clave de API de Google Gemini Pro (obtenida en Google AI Studio)
# Esta clave es accedida de manera segura ÚNICAMENTE desde el servidor en Route Handlers
GEMINI_API_KEY=tu_clave_de_gemini_aqui

# (Opcional) Modelo preferido de Gemini
# Por defecto se utiliza gemini-3.8-flash con fallback a gemini-2.5-flash
GEMINI_MODEL=gemini-3.8-flash
```

> [!IMPORTANT]
> **Seguridad de la clave de API**: La clave `GEMINI_API_KEY` se consume de forma estrictamente del lado del servidor (en los Route Handlers de Next.js bajo `src/app/api/`). Nunca se expone en el código cliente del navegador.

---

## 4. Ejecución del Proyecto

### 4.1. Modo Desarrollo

Para iniciar el servidor de desarrollo local con recarga en caliente (Hot Reload):

```bash
npm run dev
```

Una vez iniciado, abre tu navegador web en [http://localhost:3000](http://localhost:3000).

### 4.2. Compilación para Producción

Para compilar y optimizar la aplicación para un entorno de producción:

```bash
npm run build
```

Este proceso valida tipos de TypeScript, ejecuta el empaquetado de Next.js con Turbopack y genera los artefactos estáticos y dinámicos optimizados.

### 4.3. Inicio en Modo Producción

Una vez compilada la aplicación con `npm run build`, puedes ejecutar el servidor en modo producción localmente:

```bash
npm start
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

---

## 5. Verificación de Código y Calidad

### Análisis Estático (Linter)

Para revisar el cumplimiento de las reglas de estilo y buenas prácticas con ESLint:

```bash
npm run lint
```

### Pruebas Unitarias

Para ejecutar la suite completa de pruebas unitarias mediante el Node.js Test Runner:

```bash
npm test
```

Para más detalles sobre los escenarios cubiertos y el funcionamiento de las pruebas, consulta la guía de [Pruebas Unitarias y Cobertura](pruebas-unitarias.md).

---

## 6. Despliegue en Producción (Vercel)

El proyecto está diseñado y optimizado para ser desplegado de manera nativa en [Vercel](https://vercel.com/):

1. **Vincular Repositorio**: Conecta tu repositorio de GitHub a tu cuenta de Vercel.
2. **Framework Preset**: Vercel detectará automáticamente **Next.js**.
3. **Variables de Entorno**:
   * En la sección de configuración del proyecto en Vercel (*Settings > Environment Variables*), agrega la variable `GEMINI_API_KEY` con tu clave de producción.
   * Opcionalmente, define `GEMINI_MODEL=gemini-3.8-flash`.
4. **Desplegar**: Haz clic en **Deploy**. Cada `push` a la rama principal actualizará automáticamente el despliegue en producción.

---

## Enlaces de Referencia

* [Volver al README Principal](../README.md)
* [Estructura del Proyecto](estructura-del-proyecto.md)
* [Arquitectura Split-Brain](arquitectura-split-brain.md)
* [Herramientas y Arquitectura Técnica](herramientas-y-arquitectura.md)
* [Uso del LLM Externo y Manejo de Fallos](uso-del-llm-y-manejo-de-fallos.md)
* [Privacidad y Anonimización de Datos](privacidad-y-anonimizacion.md)
* [Pruebas Unitarias y Cobertura](pruebas-unitarias.md)
