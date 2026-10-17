# Implementación de Panel de Control (Dashboard) y Drawer Lateral

Este documento resume la implementación, arquitectura y resultados de pruebas de las Historias de Usuario **US-029** y **US-030**, correspondientes a la Fase 14 de Mejoras de Producto (Iteración 2) del Gestor Financiero Personal (`SPEC.md`).

---

## 1. Resumen de Historias de Usuario Ejecutadas

| Historia | Descripción | Estado | Commits |
|---|---|---|---|
| **US-029** | Andamiaje del Dashboard, Enrutamiento Condicional y Deprecación de Componentes | Completada | `06b5bad` (`feat(dashboard): scaffold 4-panel dashboard and conditional routing (US-029)`) |
| **US-030** | Componente de Drawer Lateral Deslizante (`SlidingDrawer`) | Completada | `837a8bf` (`feat(dashboard): implement sliding transaction drawer component (US-030)`) |

---

## 2. Detalle de Implementación: US-029

### Objetivo
Sustituir las tarjetas de estadísticas iniciales por un panel de control consolidado a pantalla completa (4 paneles en cuadrícula responsiva 2x2) cuando los gastos pendientes de clasificar sean menores a 10 (`pendingTransactionsCount < 10`).

### Criterios de Aceptación Cumplidos
1. **Enrutamiento Condicional:**
   - Si `pendingTransactionsCount < 10` tras la ingesta o clasificación manual, la aplicación transiciona automáticamente a `DashboardView` (`src/components/dashboard-view.tsx`).
   - Si `pendingTransactionsCount >= 10`, se mantiene la pantalla de revisión y clasificación inicial (`TransactionTable` con tarjetas de triaje).
2. **Deprecación Documentada:**
   - Se agregaron comentarios JSDoc `@deprecated` prominentes en `src/components/expense-dashboard.tsx` y `src/components/savings-suggestions.tsx` explicando su reemplazo por el nuevo dashboard analítico y manteniendo los archivos para referencia histórica.
   - El botón y modal de sugerencias de ahorro por IA quedan ocultos de forma segura en el flujo principal del dashboard.
3. **Estructura y Dimensiones:**
   - Contenedor con `min-h-screen`, `w-full`, cuadrícula responsiva 2x2 (`grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 auto-rows-fr`) sin scrolls verticales innecesarios en pantallas desktop.
   - 4 secciones estructuradas con títulos, subtítulos, códigos de color e íconos:
     - **Panel 1:** Tendencia de Gastos por Categoría (Información Básica).
     - **Panel 2:** Concentración de Comercios (¿A dónde se va mi dinero?).
     - **Panel 3:** Patrones de Consumo (Patrones de Gasto y atípicos).
     - **Panel 4:** Antigüedad del Gasto (Compromisos vs Compras Inmediatas).
4. **Barra Superior de Control:**
   - Título general ("Panel de Control Financiero") y metadatos del período (cantidad de movimientos y total en GTQ `Q`).
   - Botón "Agregar más estados de cuenta" (`#btn-dashboard-add-statements`), conectado al modal de ingesta por lotes de US-026.
   - Botón "Reiniciar sesión" (`#btn-dashboard-reset-session`), conectado al modal de confirmación de US-027.
   - Botón "Borrar mis datos" (`#btn-dashboard-clear-data`), conectado al modal de eliminación permanente de datos (US-011).
   - Botón "Ver transacciones" (`#btn-toggle-transactions-drawer`) con ícono SVG y contador total de transacciones.
5. **Estilo y Localización:**
   - Tipografía moderna neutral (Inter/Geist), tokens de Tailwind CSS en modo claro y oscuro, 100% en español y sin emojis.

---

## 3. Detalle de Implementación: US-030

### Objetivo
Proveer un drawer lateral deslizante fuera del lienzo (`SlidingDrawer`) para consultar, buscar, filtrar y editar transacciones sin salir del dashboard.

### Criterios de Aceptación Cumplidos
1. **Ocultamiento por Defecto:**
   - La tabla completa de transacciones (`TransactionTable`) está oculta de la vista principal cuando el dashboard está activo.
2. **Animación y Renderizado:**
   - Animación de entrada fluida desde el borde derecho con transiciones aceleradas por hardware (`translate-x-0` / `translate-x-full`, `duration-300`, `ease-in-out`).
   - Fondo oscuro semitransparente (`bg-black/40` con desenfoque suave `backdrop-blur-xs`).
3. **Funcionalidad Completa Preservada:**
   - Dentro del drawer se renderiza `TransactionTable` con todas sus capacidades: buscador por descripción/comercio (`#search-transactions-input`), filtros por moneda (GTQ / USD), filtros por categoría, creación de categorías personalizadas, edición en línea y asignación masiva de categorías.
4. **Cierre Fluido:**
   - Botón visible "Ocultar transacciones" (`#btn-close-sliding-drawer`) con ícono SVG `X`.
   - Cierre al hacer clic en el backdrop oscurecido.
   - Cierre automático al presionar la tecla `Escape`.
   - Bloqueo del scroll del body cuando el drawer está abierto (`document.body.style.overflow = "hidden"`).
5. **Actualizaciones Reactivas en Tiempo Real:**
   - Al clasificar transacciones dentro del drawer (e.g. asignándolas a una nueva categoría "Testing"), el estado global se actualiza inmediatamente sin recarga de página y los contadores del dashboard reflejan el cambio en tiempo real.

---

## 4. Verificación de Compilación y Tipos (`npm run build`)

Se ejecutó `npm run build` con Turbopack y verificación estricta de TypeScript:
- **Rutas compiladas:** `/`, `/_not-found`, `/api/classify-expenses`, `/api/config`, `/api/exchange-rate`, `/api/extract-transactions`, `/api/parse-pdf`, `/api/suggest-savings`.
- **Errores de compilación:** 0.
- **Errores de tipos TypeScript:** 0.

---

## 5. Pruebas Automatizadas End-to-End con Playwright (`npm run test:e2e`)

Se ejecutó la suite automatizada E2E con Playwright en Chromium (`e2e/expense-tracker.spec.ts`):
1. **Gestión del Servidor de Desarrollo:**
   - Verificó si `http://localhost:3000/` estaba activo; al no estarlo, inició automáticamente `npm run dev`.
2. **Sesión Limpia:**
   - Verificó y limpió cualquier sesión previa usando "Borrar mis datos" y confirmando en el modal.
3. **Ingesta Programática sin Interacción:**
   - Adjuntó `demo/2026-09.pdf` y `demo/2026-07.pdf` vía `setInputFiles`.
   - Confirmó el procesamiento por lotes (`#btn-confirm-routing`).
   - Se procesaron exitosamente 140 transacciones totales (con 9 transacciones pendientes de clasificar).
4. **Navegación al Dashboard (US-029):**
   - Como 9 < 10, la aplicación enrutó directamente a `#dashboard-root`.
   - Verificó la presencia del título "Panel de Control Financiero", los 4 paneles en cuadrícula 2x2 y la botonera de control.
5. **Validación del Drawer Deslizante (US-030):**
   - Comprobó el estado inicial cerrado (`translate-x-full`).
   - Hizo clic en "Ver transacciones", verificó la animación de entrada (`translate-x-0`).
   - Creó una nueva categoría `"Testing"` desde el drawer.
   - Filtró las 9 transacciones pendientes, las seleccionó en bloque y las reclasificó como `"Testing"`.
   - Probó el cierre mediante el botón "Ocultar transacciones" (`translate-x-full`).
   - Reabrió el drawer y probó el cierre mediante la tecla `Escape` (`translate-x-full`).
   - Verificó la reactividad del dashboard con las 140 transacciones analizadas.
6. **Finalización Elegante:**
   - El teardown global detuvo el proceso de `npm run dev` y liberó el puerto 3000 sin procesos huérfanos.

**Resultado de las pruebas E2E:** `1 passed (12.8s)`.
**Resultado de las pruebas unitarias (`npm run test`):** `117 passed, 0 failed`.

---

## 6. Historial de Commits

```text
837a8bf feat(dashboard): implement sliding transaction drawer component (US-030)
06b5bad feat(dashboard): scaffold 4-panel dashboard and conditional routing (US-029)
```
