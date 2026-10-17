# User Stories: Personal Expense Tracker (Control de Gastos) - Iteration 2: Dashboard & Visualizations

This document outlines the user stories, implementation phases, and testable acceptance criteria for the **Product Improvements** subsection of the Second Iteration of the Personal Expense Tracker application, as specified in `SPEC.md`.

It details the transition from the initial reporting cards to a comprehensive, full-screen **4-Panel Financial Dashboard**, an off-canvas **Sliding Transaction Drawer**, and deep analytics for multi-month statements, merchant concentration, consumption patterns, and installment age analysis.

---

## Architecture Summary & Split-Brain Boundaries (Dashboard & Analytics)

- **Client / Local Engine (100% Local in Browser & Next.js Client Components):**
  - **Zero LLM Dependency for Analytics:** All mathematical aggregations, time-series calculations, vendor ranking, outlier detection heuristics, and SVG charting operate 100% locally with zero external network requests.
  - **Component Deprecation:** Deprecates the initial stat cards, category progress list (`expense-dashboard.tsx`), and the savings suggestions panel (`savings-suggestions.tsx`, `savings-advisor.ts`) with clear `@deprecated` documentation tags without deleting source files.
  - **Condition to Show Dashboard:** When unclassified expenses are under the threshold (`unclassifiedExpenses.length < 10`), the system automatically presents the Dashboard as the primary post-ingestion view.
  - **Sliding Transaction Drawer:** The full transaction table is hidden by default and accessible via an off-canvas slide-over drawer toggled by an unintrusive action button.
  - **Native SVG Visualizations:** Custom, responsive SVG chart components built with React and Tailwind CSS 4, avoiding bulky external dependencies and guaranteeing dark mode and theme consistency.
  - **Installment Financing Classification:** Introduces the `Visacuotas / Mastercuotas / Extrafinanciamiento` category into `merchant-catalog.json` for deterministic local detection of past decision commitments.

- **Cloud Engine (Google Gemini Pro):**
  - **Saving Suggestions Deprecation:** The `/api/suggest-savings` feature is deprecated in favor of the analytical dashboard. No LLM calls are involved in the generation, rendering, or interaction of the Dashboard panels.

---

## Phase 14: Dashboard Foundation, Deprecation & Sliding Drawer (Product Improvements)

### [x] US-029: Dashboard Layout Scaffold, Conditional Routing & Component Deprecation
- **As a** user who has imported bank statements with 10 or fewer unclassified expenses,
- **I want to** see a modern, full-screen financial dashboard instead of the previous stat cards and savings suggestions,
- **So that** I have a high-impact, consolidated command center for analyzing my spending habits.
- **Split-Brain Boundary:** 100% Local (Client UI and conditional flow).
- **Acceptance Criteria:**
  - [x] When the number of unclassified expenses is `< 10` (or after manual classification reduces pending items below 10), the application automatically routes to the new Dashboard view (`dashboard-view.tsx`).
  - [x] If unclassified expenses count is `>= 10`, the application continues to prioritize the Review & Classification screen until resolved.
  - [x] The previous stat cards, recurring expenses list, and suggested savings panel in `src/components/expense-dashboard.tsx` and `src/components/savings-suggestions.tsx` are documented with a prominent `@deprecated` JSDoc comment explaining their replacement by the new Dashboard panels, keeping the files intact for historical reference.
  - [x] The "Sugerencias de ahorro" (Savings Suggestions) button and modal are safely hidden/disabled in the new dashboard flow.
  - [x] The Dashboard container takes 100% of the viewport width and height on desktop displays and landscape-oriented tablets (`min-h-screen`, structured 2x2 grid), with no unnecessary vertical page scrolling required to view the four panels.
  - [x] Dashboard header presents a clean bar featuring:
    - Period overview title (e.g., "Panel de Control Financiero").
    - "Agregar más estados de cuenta" action button (retaining US-026 batch capability).
    - "Reiniciar sesión" button with confirmation modal (retaining US-027 capability).
    - "Ver transacciones" toggle button with an SVG table/list icon to open the sliding drawer.
  - [x] All typography uses standard modern fonts, neutral dark/light theme tokens, and 100% Spanish text with zero emojis.

### [x] US-030: Sliding Transaction Drawer Component
- **As a** user viewing the financial dashboard,
- **I want to** toggle a sliding drawer from the edge of the screen to inspect, filter, or edit my transactions without navigating away from the dashboard,
- **So that** I can reference detailed line items whenever needed while keeping the main screen focused on visual analytics.
- **Split-Brain Boundary:** 100% Local (Client React state and CSS transitions).
- **Acceptance Criteria:**
  - [x] The transaction list (`TransactionTable`) is hidden from the main viewport by default when the dashboard is active.
  - [x] Clicking the "Ver transacciones" button in the header triggers a smooth sliding drawer animation entering from the right side of the screen.
  - [x] The drawer renders over an unobtrusive semi-transparent dark backdrop overlay (`bg-black/40` with subtle blur).
  - [x] The sliding drawer contains the complete `TransactionTable` with all existing functionality:
    - Search bar and category filters.
    - Currency filter ("Todas", "Solo GTQ", "Convertidas de USD") and USD original badges.
    - Inline category assignment and custom category creation.
    - Transaction editing (amount, date, description) and individual deletion.
  - [x] The drawer header includes a clear "Ocultar transacciones" / "Cerrar" button with an SVG close icon.
  - [x] The drawer closes smoothly when clicking the close button, clicking the backdrop overlay, or pressing the `Escape` key.
  - [x] When transactions are edited or deleted inside the drawer, dashboard statistics and charts reactively update in real time without page reload.
  - [x] Uses hardware-accelerated CSS transforms (`translate-x-0` / `translate-x-full`) with a duration of 300ms for smooth 60fps performance.

---

## Phase 15: Panel 1 - Category Trends Over Time (Basic Information)

### [x] US-031: Multi-Month Category Time-Series Aggregation Engine
- **As a** developer,
- **I want** an aggregation module that groups multi-month transactions into chronological monthly series per category,
- **So that** the trend line chart receives clean, normalized data points regardless of how many statements have been loaded.
- **Split-Brain Boundary:** 100% Local (Client-side pure mathematical aggregation).
- **Acceptance Criteria:**
  - [x] Creates a dedicated reporting utility function `calculateMonthlyCategoryTrends(transactions: Transaction[], customCategories?: CustomCategory[])`.
  - [x] Identifies all distinct calendar months present in the transactions, sorted in chronological order (e.g., `["2026-05", "2026-06", "2026-07"]`).
  - [x] For single-month uploads, partitions data by calendar weeks or displays the single monthly total per category with clear visual indicators.
  - [x] For each month and each active category, computes the exact sum of expenses in Guatemalan Quetzales (`GTQ`).
  - [x] Returns structured trend data:
    ```typescript
    interface CategoryMonthlyTrend {
      categoryId: string;
      categoryName: string;
      color: string;
      monthlyTotals: Array<{
        monthKey: string;      // "2026-06"
        monthLabel: string;    // "Jun 2026"
        totalAmount: number;   // 1450.50
      }>;
    }
    ```
  - [x] Excludes credit refunds, payments, and filtered transactions.
  - [x] Includes comprehensive unit tests in `src/lib/reporting.test.ts` validating single-month, multi-month, missing-month zero fills, and sorting.

### [x] US-032: Category Trend Line Chart with Interactive Filtering
- **As a** user reviewing my basic spending information,
- **I want to** see an interactive multi-line chart showing the evolution of each category over time with the ability to toggle individual categories,
- **So that** I can track whether my spending in specific categories is rising, falling, or stable across months.
- **Split-Brain Boundary:** 100% Local (Native SVG chart rendering).
- **Acceptance Criteria:**
  - [x] Panel 1 of the dashboard renders an interactive SVG Line Chart titled "Tendencia de Gastos por Categoría" (Panel 1: Información Básica).
  - [x] Horizontal X-axis displays sorted month labels (e.g., "Ene 2026", "Feb 2026", "Mar 2026").
  - [x] Vertical Y-axis scales dynamically to the peak category spending, formatted in Quetzales (e.g., "Q 0", "Q 2,500", "Q 5,000").
  - [x] Each active category is rendered as an independent smooth SVG path (`<path d="..." />`) with circular data points at each month coordinate using its catalog color.
  - [x] An interactive category filter bar / pill legend allows users to click any category to hide or show its line on the chart.
  - [x] Hidden categories are visually dimmed in the legend; active categories remain brightly highlighted.
  - [x] Hovering over or tapping any data point reveals a crisp tooltip card showing:
    - Month and Year (e.g., "Julio 2026").
    - Category name with a colored dot indicator.
    - Total spent in Quetzales (`Q 1,845.20`).
    - Percentage change relative to the previous month (if prior month exists).
  - [x] If only one month of data is present, displays a clear message informing the user that uploading additional months will plot full trends, while showing the single-month category distribution.

---

## Phase 16: Panel 2 - Merchant Concentration ("Where is my money going?")

### [x] US-033: Vendor Aggregation Engine by Spend Volume & Transaction Frequency
- **As a** developer,
- **I want** an analytics utility that aggregates transactions by merchant to rank top vendors by total spend and by transaction count,
- **So that** the merchant concentration bar chart can toggle seamlessly between financial volume and purchase frequency.
- **Split-Brain Boundary:** 100% Local (Pure TypeScript algorithm).
- **Acceptance Criteria:**
  - [x] Implements a merchant aggregation function `calculateTopVendors(transactions: Transaction[], limit?: number)`.
  - [x] Normalizes vendor descriptions by stripping branch IDs, card terminal numbers, dates, and common bank prefixes (`POS`, `COMPRA EN`, `ESTBL`, `GTM`).
  - [x] Computes two ranking metrics for each merchant:
    1. `totalAmountGTQ`: Sum of all purchases at this vendor in Quetzales.
    2. `transactionCount`: Total number of individual transactions at this vendor.
  - [x] Computes the percentage share of each vendor relative to total period spending.
  - [x] Returns sorted lists for both criteria (defaulting to Top 5 or Top 8 merchants).
  - [x] Includes unit tests covering merchant name normalization, tie-breaking, and ranking accuracy.

### [x] US-034: Top Vendors Bar Chart with Dual Metric Selector
- **As a** user asking "Where is my money going?",
- **I want to** explore a bar chart of my top merchants and switch between "Highest spend amount" and "Most frequent transactions",
- **So that** I can see both where the largest sums of money flow and which businesses I frequent most often.
- **Split-Brain Boundary:** 100% Local (Native SVG Bar Chart and UI state).
- **Acceptance Criteria:**
  - [x] Panel 2 renders an interactive bar chart titled "¿A dónde se va mi dinero?" (Panel 2: Comercios Principales).
  - [x] Includes a segmented toggle selector at the top of the panel:
    - Option 1: "Mayor monto gastado (Q)"
    - Option 2: "Mayor cantidad de compras"
  - [x] When "Mayor monto gastado" is selected:
    - Bars represent top vendors by Quetzales spent.
    - Labels display the merchant name and formatted amount (e.g., "Supermercados La Torre — Q 4,820.00 (24.5%)").
  - [x] When "Mayor cantidad de compras" is selected:
    - Bars represent top vendors by frequency of visits.
    - Labels display the merchant name and purchase count (e.g., "Café Barista — 18 compras (Total: Q 640.00)").
  - [x] Bars render with rounded caps, smooth width transition animations (300ms ease), and color coding matching the vendor's primary category.
  - [x] Hovering over any bar displays a tooltip with average ticket size (`Monto promedio por compra: Q XX.XX`).

---

## Phase 17: Panel 3 - Spending Patterns & Outlier Detection (Consumption Patterns)

### [x] US-035: Day-of-Week & Day-of-Month Temporal Aggregation & Anomaly Heuristics
- **As a** developer,
- **I want** a statistical calculation engine that breaks down spending by day of the week and day of the month and identifies statistical outliers,
- **So that** the consumption pattern panel can pinpoint unusual spikes in user expenditure.
- **Split-Brain Boundary:** 100% Local (Pure statistical logic, zero external AI).
- **Acceptance Criteria:**
  - [x] Implements temporal aggregation utility `calculateConsumptionPatterns(transactions: Transaction[])`:
    - **Day of Week:** Aggregates spending across 7 days: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo.
    - **Day of Month:** Aggregates spending across days 1 to 31 of calendar months.
  - [x] Computes statistical baseline: mean daily spend ($\mu$) and standard deviation ($\sigma$).
  - [x] Outlier Detection Rule 1 (Overall Spike): Any day with total spending exceeding $\mu + 1.75\sigma$ (or $> 2.5\times$ median) is flagged as an `outlierDay` with an `anomalyScore`.
  - [x] Outlier Detection Rule 2 (Cross-Month Spike): Compares same-day spending across individual months (e.g., normal spending on day 15 is near zero, but one specific month recorded a high spike on day 15) and flags cross-month anomalies with specific context.
  - [x] Returns structured insight summaries in Spanish detailing identified anomalies (e.g., `hasOutliers: true, anomalyDescription: "Gasto atípico detectado el 15 de julio por compra extraordinaria..."`).
  - [x] Comprehensive unit tests verify day-of-week parsing, leap year/month-end handling, and mathematical outlier detection.

### [x] US-036: Consumption Patterns Bar Chart with Outlier Visual Indicators
- **As a** user analyzing my consumption patterns,
- **I want to** toggle between day-of-the-week and day-of-the-month bar charts and immediately see highlighted outlier days,
- **So that** I can detect recurring spending habits and identify days with abnormal financial impact.
- **Split-Brain Boundary:** 100% Local (Native SVG chart rendering and alert badges).
- **Acceptance Criteria:**
  - [x] Panel 3 renders an interactive chart titled "Patrones de Consumo" (Panel 3: Hábitos y Anomalías).
  - [x] Includes a segmented toggle selector:
    - Mode A: "Día de la semana" (7 bars: Lun, Mar, Mié, Jue, Vie, Sáb, Dom).
    - Mode B: "Día del mes" (31 bars numbered 1 to 31).
  - [x] Outlier days are visually distinguished with a contrasting alert stroke/fill (e.g., Amber/Rose highlight `#f59e0b` / `#f43f5e`) and a subtle badge indicator over the bar.
  - [x] A dedicated insight banner below the chart displays contextual explanations in Spanish when an anomaly is detected:
    - Example: "Se detectó un consumo extraordinario los días viernes (promedio Q 1,850 frente a Q 420 en días laborales)."
    - Example: "Día atípico: El día 15 de julio concentró un gasto 3 veces mayor al promedio habitual de esa fecha."
  - [x] Tooltip on each bar shows total amount, percentage of weekly/monthly total, and transaction count.

---

## Phase 18: Panel 4 - Decision Age & Installment Financing Analysis (Transaction Age)

### [x] US-037: Installment Financing Category in Merchant Catalog & Classifier Extension
- **As a** user paying off past purchases through credit installments,
- **I want** the system to recognize Visacuotas, Mastercuotas, and extrafinanciamiento transactions automatically,
- **So that** payments for past purchasing decisions are categorized separately from my current-month discretionary spending.
- **Split-Brain Boundary:** 100% Local (Catalog extension and deterministic keyword matching).
- **Acceptance Criteria:**
  - [x] Adds a new official category to `src/data/merchant-catalog.json`:
    - Name: `"Visacuotas y Financiamiento"`
    - Color: Sky Blue / Cyan (`#0284c7` or `#0ea5e9`)
    - Description: "Pagos a plazos, cuotas y extrafinanciamiento de decisiones de compra pasadas."
  - [x] Populates the category with comprehensive Guatemalan financing keywords:
    - `visacuota`, `visa cuota`, `mastercuota`, `master cuota`, `cuota`, `extrafinanciamiento`, `pago en cuotas`, `cuotas sin intereses`, `credicuota`, `financiamiento`, `pago a plazos`, `cuota no.`, `plan cuotas`.
  - [x] Updates `TransactionCategory` types and ensures local classifier assigns this category deterministically.
  - [x] Unit tests verify that sample transaction lines containing installment keywords are classified as `"Visacuotas y Financiamiento"` locally with zero LLM queries.

### [ ] US-038: Three-Segment Transaction Age Aggregator with Month Filtering
- **As a** developer,
- **I want** an analytics engine that categorizes spending into three specific decision-age buckets with multi-month filtering,
- **So that** the pie chart accurately illustrates when the user's spending commitments originated.
- **Split-Brain Boundary:** 100% Local (Pure TypeScript aggregation logic).
- **Acceptance Criteria:**
  - [ ] Implements aggregation function `calculateTransactionAgeSegments(transactions: Transaction[], selectedMonth?: string)`:
  - [ ] Partitions all expenses into exactly three canonical buckets:
    1. **Cuotas y Financiamiento:** Transactions in the `"Visacuotas y Financiamiento"` category (decisions made months/years prior).
    2. **Suscripciones y Servicios Recurrentes:** Transactions tagged with `isSubscription: true` or category `"Suscripciones"` (standing monthly commitments).
    3. **Compras Inmediatas:** All other transactions made in the current period (immediate discretionary and essential purchases).
  - [ ] Supports an optional `selectedMonth` filter argument (`"all"` or `"YYYY-MM"`) allowing calculations for all uploaded statements or for a single month.
  - [ ] Returns totals in Quetzales, percentage distribution, and transaction counts for all 3 segments.
  - [ ] Unit tests in `src/lib/reporting.test.ts` verify segment totals sum to 100% of the filtered spending.

### [ ] US-039: Transaction Age Donut / Pie Chart & Interactive Breakdown
- **As a** user viewing "Transaction Age",
- **I want to** see a clean Donut/Pie chart contrasting past installment commitments, recurring subscriptions, and immediate purchases with a month filter,
- **So that** I understand how much of my paycheck is already committed to past choices versus fresh monthly spending.
- **Split-Brain Boundary:** 100% Local (Native SVG Donut Chart and local filtering).
- **Acceptance Criteria:**
  - [ ] Panel 4 renders an interactive Donut Chart titled "Antigüedad del Gasto" (Panel 4: Compromisos vs Compras Inmediatas).
  - [ ] Top control features a month filter dropdown in Spanish:
    - "Todos los meses cargados" (default).
    - Individual options for each uploaded month (e.g., "Mayo 2026", "Junio 2026").
  - [ ] Renders 3 SVG donut slices with distinct colors:
    - Visacuotas / Financiamiento: `#0284c7` (Sky Blue)
    - Suscripciones Recurrentes: `#6366f1` (Indigo)
    - Compras Inmediatas: `#10b981` (Emerald)
  - [ ] Center of the donut displays the total expenditure for the selected period in Quetzales (`Q XX,XXX.XX`).
  - [ ] Legend card alongside the chart displays:
    - Segment name and colored badge.
    - Total amount in Quetzales.
    - Percentage of total spending.
  - [ ] Hovering over any slice highlights the segment and displays a tooltip with details and purchase count.

---

## Phase 19: Comprehensive Dashboard Integration, Responsiveness & Verification

### [ ] US-040: Unified 4-Panel Dashboard Assembly & Landscape Tablet Layout
- **As a** user accessing the application on a desktop computer or landscape-oriented tablet,
- **I want** all four dashboard panels arranged in a balanced, cohesive layout fitting the entire screen,
- **So that** I get an executive-level financial summary at a single glance with zero clutter.
- **Split-Brain Boundary:** 100% Local (Client layout integration).
- **Acceptance Criteria:**
  - [ ] Assembles the four panels into a unified responsive layout:
    - **Top Left (Panel 1):** Información Básica (Tendencia mensual por categoría - US-032).
    - **Top Right (Panel 2):** ¿A dónde se va mi dinero? (Comercios principales con selector de métrica - US-034).
    - **Bottom Left (Panel 3):** Patrones de Consumo (Día de semana / Día de mes y detección de anomalías - US-036).
    - **Bottom Right (Panel 4):** Antigüedad del Gasto (Donut chart de cuotas, suscripciones y compras inmediatas con filtro de mes - US-039).
  - [ ] Desktop and landscape tablet layouts present a unified 2x2 grid that fits cleanly within the screen without forced page scrolling.
  - [ ] Portrait tablet and mobile screens gracefully stack panels vertically with clean scroll snapping and responsive SVG viewBox scaling.
  - [ ] The "Ver transacciones" action button remains easily accessible in the header at all times, opening the sliding drawer cleanly over the dashboard.
  - [ ] `npm run build` succeeds with zero TypeScript or Turbopack errors.
  - [ ] `npm test` passes all unit tests for monthly trends, vendor ranking, outlier heuristics, and transaction age segments.
