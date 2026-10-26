# User Stories: Personal Expense Tracker (Control de Gastos) - Iteration 3: UI/UX Refinement & Interactive Analytics

This document outlines the user stories, implementation phases, and testable acceptance criteria for the **Third Iteration** of the Personal Expense Tracker application, as specified in the "Third Iteration" section of `SPEC.md`.

It details the UI/UX enhancements, session button consolidation, collapsible panel architecture, contextual tutorial modals, interactive graph drill-downs, vendor dismissal mechanics, preference persistence, and color accessibility audits, strictly following the **Split-Brain Architecture** described in `SPEC.md`, `DESCRIPTION.md`, and `AGENTS.md`.

---

## Architecture Summary & Split-Brain Boundaries (Iteration 3)

- **Client / Local Engine (100% Local in Browser & Next.js Client Components):**
  - **Zero LLM Dependency for UI/UX Operations:** All interactive enhancements—minimizing panels, opening tutorial dialogs, drill-down filtering in the sliding drawer, vendor dismissal rolling windows, and color palette refinements—operate 100% locally with zero external network requests.
  - **Multi-Dimensional Sliding Drawer Filtering:** Extends the sliding transaction drawer (`SlidingDrawer` / `TransactionTable`) to support direct cross-filtering from chart interactions:
    - By month and category (from Panel 1 data point clicks).
    - By day of the week or day of the month (from Panel 3 bar clicks).
  - **Local State & Preference Persistence:** Persists user interface preferences in browser `localStorage` across page visits:
    - Active vendor ranking metric in Panel 2 (`"amount"` vs. `"frequency"`).
    - Active consumption pattern mode in Panel 3 (`"dayOfMonth"` default vs. `"dayOfWeek"`).
  - **Safe Session Management:** Eliminates dangerous unconfirmed session reset paths and consolidates session wipe actions into a single, user-confirmed modal dialog with category preservation options.
  - **Dynamic Layout Reflow:** Implements responsive panel collapse and expansion ensuring fluid upward and downward movement of panels in both 2x2 grid and single-column viewports.
  - **Accessibility & Contrast:** Refines the 3-segment decision age palette in Panel 4 for maximum visual distinction and color-blindness accessibility in light and dark themes.

- **Cloud Engine (Google Gemini Pro):**
  - No LLM routes or cloud dependencies are involved in Iteration 3. All logic, filtering, state management, and visual interactions execute strictly on the client side.

---

## Phase 20: Session Safety & Button Consolidation (General UI/UX)

### [x] US-041: Session Reset Consolidation & Removal of Dangerous Actions
- **As a** user managing my bank statements,
- **I want** clear, safe session controls that never erase my data without explicit confirmation,
- **So that** I do not accidentally lose my uploaded statements, custom categories, or active progress.
- **Split-Brain Boundary:** 100% Local (Client state and `localStorage` session management).
- **Acceptance Criteria:**
  - [x] In the dashboard header (`src/components/dashboard-view.tsx`), removes the redundant "Borrar mis datos" button, retaining only "Reiniciar sesión".
  - [x] The "Reiniciar sesión" button in the dashboard opens the confirmation modal with the option to preserve or wipe custom categories (retaining categories by default).
  - [x] In the file upload / saved session banner (`src/app/page.tsx`), removes the dangerous "Nueva carga de estado de cuenta" button (`handleStartFresh`) that previously wiped active session state without asking for user confirmation.
  - [x] In the file upload / saved session banner (`src/app/page.tsx`), replaces the "Borrar mis datos" button with "Reiniciar sesión", invoking the same confirmation modal with category preservation options.
  - [x] In the transaction table header (`src/components/transaction-table.tsx`), removes redundant "Borrar mis datos" triggers to ensure a consistent, non-redundant session reset workflow across the application.
  - [x] All confirmation dialogues, buttons, and helper tooltips are 100% in Spanish with no emojis.

---

## Phase 21: Modular Panel Controls: Minimization & Contextual Tutorials (All Panels)

### [x] US-042: Collapsible Panel Architecture & Dynamic Layout Reordering
- **As a** user analyzing my financial dashboard,
- **I want to** minimize any of the four dashboard panels to a compact title chip and restore it on demand,
- **So that** I can declutter my workspace and prioritize the visualizations most relevant to me.
- **Split-Brain Boundary:** 100% Local (Client React state and CSS layout transitions).
- **Acceptance Criteria:**
  - [x] Adds a small minimize button in the upper right corner of each of the four dashboard panel headers (Panel 1, Panel 2, Panel 3, and Panel 4).
  - [x] When the minimize button is clicked, the panel body (charts, controls, legends) hides smoothly, leaving only a compact chip/title header visible.
  - [x] The minimized chip displays the panel title, an expand/restore icon, and an accessible tooltip ("Restaurar panel").
  - [x] Clicking anywhere on the minimized chip/title restores the panel to its fully expanded state.
  - [x] Dynamic layout reflow: When a panel is minimized, the panels located below it in the layout automatically move up to take advantage of available vertical space. When restored, panels smoothly push back down.
  - [x] Minimization state is tracked independently for each panel without resetting chart filters or underlying data calculations.
  - [x] Maintains full responsiveness across desktop 2x2 grid, landscape tablet, and single-column mobile viewports without visual artifacts.

### [x] US-043: Contextual Panel Information & Quick Tutorial Modals
- **As a** user exploring my financial analytics,
- **I want** an `Info` button on each dashboard panel that displays a concise tutorial guide,
- **So that** I understand how to interpret the data and how to use the interactive features of each panel.
- **Split-Brain Boundary:** 100% Local (Client UI and static Spanish copy).
- **Acceptance Criteria:**
  - [x] Adds an `Info` button (using an SVG info icon and Spanish tooltip "Información") in the upper right header of each panel, positioned beside the minimize button.
  - [x] Clicking the `Info` button opens a clean, lightweight tutorial popover or card with concise explanatory text for that specific panel:
    - **Panel 1 (Histórico por categoría):** "Muestra la evolución mensual de tus gastos por categoría. Haz clic en una línea para aislarla o en un punto para inspeccionar los movimientos de ese mes en el panel lateral."
    - **Panel 2 (¿A dónde va mi dinero?):** "Visualiza tus comercios con mayor gasto o compras más frecuentes. Haz clic en un comercio para descartarlo temporalmente y explorar el resto de tus gastos."
    - **Panel 3 (Patrones de consumo):** "Analiza tus hábitos según el día del mes o de la semana para detectar gastos atípicos. Haz clic en una barra para ver los movimientos de ese día."
    - **Panel 4 (Antigüedad del gasto):** "Compara tus compromisos previos (cuotas y suscripciones) frente a compras inmediatas para evaluar cuánto de tu dinero ya estaba comprometido antes de iniciar el mes."
  - [x] The tutorial popover includes a clear dismiss/close action, closes upon clicking outside or pressing `Escape`, and matches the neutral light/dark theme tokens.
  - [x] Content is structured so that additional informational copy can be seamlessly added in the future without altering layout.

---

## Phase 22: Panel 1 Interactive Deep-Dive: Point Filtering & Category Isolation (Category Trends)

### [x] US-044: Interactive Data-Point Transaction Drill-Down in Category Trends
- **As a** user reviewing my category spending over time,
- **I want to** click any data point on the trend chart to open the sliding drawer filtered to that specific month and category,
- **So that** I can instantly inspect the individual transactions that comprise that month's spending.
- **Split-Brain Boundary:** 100% Local (Client event dispatching and drawer filtering).
- **Acceptance Criteria:**
  - [x] All coordinate data points (circles) rendered on the SVG trend lines are interactive, featuring hover enlargement, cursor pointer styling, and accessible button roles.
  - [x] Clicking any point captures both its category identifier and its corresponding month key (e.g., `"Supermercado"` and `"2026-06"`).
  - [x] Automatically opens the sliding transaction drawer (`SlidingDrawer`).
  - [x] Filters the `TransactionTable` to display only transactions belonging to that specific category AND dated within that calendar month.
  - [x] The sliding drawer header displays a clear, removable active filter indicator (e.g., "Filtrado por: Supermercado · Junio 2026" with transaction count).
  - [x] Provides a "Quitar filtro" / "Mostrar todas" button inside the drawer that resets filters and restores the full transaction list.

### [x] US-045: Single-Category Focus Isolation & "Mostrar todo" Toggle
- **As a** user analyzing a busy multi-category trend chart,
- **I want to** click directly on a category's line to isolate it and hide all other lines,
- **So that** I can focus exclusively on that category's historical trajectory without visual distractions.
- **Split-Brain Boundary:** 100% Local (Client SVG path interaction and state management).
- **Acceptance Criteria:**
  - [x] Clicking directly on a category's SVG trend line (`<path>`) isolates that line, immediately hiding all other category lines on the chart.
  - [x] When a category is isolated, a small, accessible chip button appears with the text "Mostrar todo" within the panel controls.
  - [x] Clicking "Mostrar todo" unhides all category lines and removes the chip.
  - [x] Category isolation and the appearance of the "Mostrar todo" chip are triggered exclusively upon mouse click, never upon mouse hover or cursor movement.
  - [x] Hovering over a trend line retains standard tooltip preview behavior without isolating the line or displaying the "Mostrar todo" chip.
  - [x] The category legend pills reflect the isolated state, visually dimming non-isolated categories while keeping the active one highlighted.

---

## Phase 23: Panel 2 Vendor Dismissal & Preference Persistence (Top Vendors)

### [x] US-046: Interactive Vendor Dismissal & Rolling Top-5 Display
- **As a** user inspecting where my money goes,
- **I want to** click on a vendor in either metric view to dismiss it and have the next highest vendor move into view,
- **So that** I can explore long-tail merchant expenses beyond the dominant top 5 while always keeping 5 vendors visible.
- **Split-Brain Boundary:** 100% Local (Client-side ranking array slicing and animations).
- **Acceptance Criteria:**
  - [x] In both views of Panel 2 ("Mayor monto gastado" and "Mayor cantidad de compras"), clicking on any vendor bar or row dismisses that vendor from the active display.
  - [x] The dismissed vendor stops displaying, remaining vendors move up smoothly, and the next vendor in ranking order appears.
  - [x] The view continuously maintains exactly 5 visible vendors at a time (unless the user has dismissed so many vendors that fewer than 5 remain in total).
  - [x] Whenever one or more vendors are dismissed, a prominent chip button appears with the label "Mostrar todo".
  - [x] Clicking "Mostrar todo" clears all dismissed vendors, restoring the original top 5 merchants and hiding the chip.
  - [x] Vendor rows animate smoothly during dismissal and reordering using subtle CSS transitions without layout flickering.

### [ ] US-047: Vendor Concentration Metric Tab Persistence
- **As a** user who frequently sorts vendors by purchase count,
- **I want** the dashboard to remember whether I last viewed "Mayor monto gastado" or "Mayor cantidad de compras",
- **So that** my preferred ranking mode is automatically restored whenever I return to the dashboard.
- **Split-Brain Boundary:** 100% Local (`window.localStorage` persistence).
- **Acceptance Criteria:**
  - [ ] Saves the user's active tab selection (`"amount"` vs. `"frequency"`) in `localStorage` under a dedicated key (e.g., `expense_tracker_vendor_metric_tab`).
  - [ ] When Panel 2 mounts, it reads the stored preference from `localStorage` and initializes the active tab accordingly.
  - [ ] If no preference is stored in `localStorage`, it defaults cleanly to `"amount"` ("Mayor monto gastado").
  - [ ] Gracefully handles restricted storage environments (incognito/private browsing) without throwing exceptions.
  - [ ] Switching between tabs preserves or cleanly recalculates dismissal state according to the selected metric.

---

## Phase 24: Panel 3 Temporal Drill-Down & Default Tab Configuration (Consumption Patterns)

### [ ] US-048: Default Tab Configuration & Temporal View Persistence
- **As a** user analyzing spending habits,
- **I want** Panel 3 to default to the "Día del mes" tab and remember my last selected tab,
- **So that** I immediately see my monthly calendar cycle upon opening the dashboard.
- **Split-Brain Boundary:** 100% Local (`window.localStorage` preference).
- **Acceptance Criteria:**
  - [ ] Updates the initial default view mode of Panel 3 from "Día de la semana" to "Día del mes (1 a 31)".
  - [ ] Whenever the user switches between "Día de la semana" and "Día del mes", the active mode is saved to `window.localStorage` under key `expense_tracker_pattern_view_mode`.
  - [ ] On component mount, reads the stored preference and sets the active tab.
  - [ ] If no stored preference is present, it defaults to `"dayOfMonth"` ("Día del mes").
  - [ ] The segmented toggle control visually reflects the restored mode immediately upon page load.

### [ ] US-049: Temporal Bar Click Transaction Drill-Down
- **As a** user noticing a spending spike on a particular day of the week or date of the month,
- **I want to** click on any bar in Panel 3 to open the sliding drawer filtered to that specific day,
- **So that** I can examine the exact transactions contributing to that day's total or outlier spend.
- **Split-Brain Boundary:** 100% Local (Client filtering and drawer coordination).
- **Acceptance Criteria:**
  - [ ] Each bar in both "Día de la semana" and "Día del mes" charts is interactive with hover highlights, cursor pointer styling, and keyboard accessibility.
  - [ ] In "Día de la semana" mode: Clicking a bar (e.g., "Viernes") opens the sliding drawer and filters transactions to only those that occurred on that specific weekday across all uploaded statements.
  - [ ] In "Día del mes" mode: Clicking a bar (e.g., "Día 15") opens the sliding drawer and filters transactions to only those with that day of the month across all statements.
  - [ ] The sliding drawer opens automatically with a clear filter header banner (e.g., "Filtrado por: Viernes (12 movimientos)" or "Filtrado por: Día 15 del mes (5 movimientos)").
  - [ ] A "Quitar filtro" button in the drawer header resets temporal filters and restores all transactions.

---

## Phase 25: Panel 4 Palette Refinement & Comprehensive UI Audit (Transaction Age & Verification)

### [ ] US-050: High-Contrast Color Palette for Decision Age Donut Chart
- **As a** user reviewing my transaction age breakdown,
- **I want** the three donut chart segments and legend items to use easily distinguishable, high-contrast colors,
- **So that** I can clearly tell apart past installment financing, recurring subscriptions, and immediate purchases in both light and dark themes.
- **Split-Brain Boundary:** 100% Local (Color tokens and SVG styling).
- **Acceptance Criteria:**
  - [ ] Audits and updates the three segment color tokens in `TRANSACTION_AGE_COLORS` (`src/lib/reporting.ts`) and `src/components/transaction-age-chart.tsx`:
    - **Visacuotas y Financiamiento:** High-contrast Sky Blue / Cyan (e.g., `#0284c7`).
    - **Suscripciones Recurrentes:** Distinct Vibrant Purple / Violet (e.g., `#8b5cf6` or `#a855f7`), replacing colors too close to blue.
    - **Compras Inmediatas:** Distinct Emerald / Teal (e.g., `#10b981`).
  - [ ] Ensures colors achieve strong contrast against light (`bg-white` / `bg-zinc-50`) and dark (`bg-zinc-950` / `bg-zinc-900`) backgrounds.
  - [ ] Verifies visual differentiation for users with color vision deficiencies (protanopia, deuteranopia, tritanopia).
  - [ ] Donut slices, legend badges, and hover focus rings all reflect the unified, refined color palette consistently.

### [ ] US-051: End-to-End Third Iteration Integration & Regression Verification
- **As a** user,
- **I want** all Third Iteration features to work harmoniously with existing bank parsers, batch ingestion, and dashboard visualizations,
- **So that** the entire application is robust, responsive, accessible, and completely error-free.
- **Split-Brain Boundary:** 100% Local verification.
- **Acceptance Criteria:**
  - [ ] All four panels collapse and expand cleanly with fluid layout reflow across desktop 2x2 grid, landscape tablet, and stacked mobile screens.
  - [ ] All `Info` tutorial popovers render concise Spanish descriptions and close properly on user interaction.
  - [ ] Data point click drill-downs from Panel 1 and bar click drill-downs from Panel 3 open the sliding drawer with accurate transaction subsets and working reset controls.
  - [ ] Category line isolation in Panel 1 works on click only and restores cleanly via the "Mostrar todo" chip.
  - [ ] Vendor dismissal in Panel 2 maintains 5 visible vendors and restores cleanly via "Mostrar todo".
  - [ ] `localStorage` preference persistence functions correctly for Panel 2 tab, Panel 3 tab, and session resets.
  - [ ] 100% of user-facing UI labels, tooltips, chips, and modals are in Spanish.
  - [ ] Zero emojis are used across all views; all icons use standard SVG icons from `Icons`.
  - [ ] Monetary amounts are strictly formatted in Guatemalan Quetzales (`Q` / `GTQ`).
  - [ ] `npm test` runs and passes all unit tests with zero regressions.
  - [ ] `npm run build` compiles with zero TypeScript errors or Turbopack warnings.
