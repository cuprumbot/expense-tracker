# User Stories: Personal Expense Tracker (Control de Gastos) - Iteration 4: Budgeting Tool, Simple List Ingestion & Credit Card Multi-Bank Parsing Engine

This document outlines the user stories, implementation phases, and testable acceptance criteria for the **Fourth Iteration** of the Personal Expense Tracker application, as specified in the "Fourth Iteration" section of `SPEC.md` and subsequent architectural refinements.

It details the implementation of the comprehensive **Budgeting Tool** (creation from scratch with logical category tiers, realistic generation from uploaded transactions, time-versioned budget editing, monthly budget-vs-actual comparisons, gamified streak and goal statistics, and root-cause coaching insights), **Simple Expense List Ingestion** (free-text paste/write interface with context-aware numeric vendor disambiguation), and the dedicated **Credit Card Multi-Bank Parsing Engine** (automatic bank identification, deprecation of legacy checking account parsers, and specialized credit card statement parsers for **Banco Industrial**, **Banco Cuscatlán**, **BAC Credomatic**, **FICOHSA**, and **Banco Agromercantil**), strictly following the **Split-Brain Architecture** and guidelines in `SPEC.md`, `DESCRIPTION.md`, and `AGENTS.md`.

---

## Architecture Summary & Split-Brain Boundaries (Iteration 4)

- **Client / Local Engine (100% Local in Browser & Next.js Client Components):**
  - **Zero LLM Dependency for Budgeting, Text List Parsing & Credit Card Ingestion:** All budget target calculations, root-cause anomaly heuristics, multi-month improvement tracking, weekly streak computations, free-text list parsing, credit card bank detection, and credit card statement regex parsing operate 100% locally with zero external network requests.
  - **Context-Aware Simple List Parser:** Parses multi-line plain-text expense lists (`"Walmart 150"`, `"150 Burger king"`, `"40 super 24"`, `"super 24 20"`) locally using regex tokenization and merchant catalog matching to disambiguate numbers that belong to a merchant brand name (e.g., `"Super 24"`) from transaction amounts.
  - **Dedicated Full-Screen Budgeting View:** Accessible directly from both the File Upload screen (even before uploading files, to build a budget from scratch) and the Financial Dashboard header, with seamless navigation back to the active view.
  - **Smart Budget Builders:**
    - *From Zero:* Interactive category chips and tiered target amount presets where essential living categories (`Supermercado`, `Servicios Básicos`, `Transporte y Combustible`, `Salud y Farmacia`) offer higher logical suggested amounts than discretionary "for fun" categories (`Restaurantes y Cafés`, `Entretenimiento y Compras`, `Suscripciones`), supplemented by historical spend chips when transaction data is present.
    - *From Uploaded Transactions:* Computes historical monthly category averages and proposes realistic targets close to actual spending habits so goals are achievable.
  - **Time-Versioned Budget Persistence:** Stores budgets in `window.localStorage` with monthly effective snapshots (`YYYY-MM`). When a user edits an existing budget, they explicitly choose whether to apply the update retroactively to previous months or only from the current/latest month forward.
  - **Deterministic Coaching & Root-Cause Heuristics:** Analyzes over-budget categories locally to pinpoint probable causes (single high-ticket outlier purchase, high frequency of small transactions, date-clustered spending spikes, or broad excess spend) and tracks multi-month category trajectories to encourage continued improvement or suggest shifting focus to a new category once a habit is mastered.
  - **Legacy Checking Account Parser Deprecation (Scope Narrowing to Credit Cards):** Decommissions legacy checking/savings account (cuentas monetarias / ahorro) parsers for Banco Industrial and Banrural (superseding US-018 and US-019), focusing the statement ingestion engine strictly and exclusively on credit card statements.
  - **Automatic Credit Card Bank Selection & Routing:** Automatically inspects extracted PDF text headers, issuer metadata, card branding, and domains to identify whether an uploaded statement belongs to Banco Industrial, Banco Cuscatlán, BAC Credomatic, FICOHSA, or Banco Agromercantil (BAM), seamlessly dispatching to the corresponding specialized credit card parser (superseding US-017).
  - **Specialized Local Credit Card Parsers:** Dedicated parsing modules extract card purchases, convert foreign currency ($ / USD) charges to Quetzales at the active exchange rate, strip internal POS authorization and terminal codes, filter out card payments and rewards disbursements, and produce canonical `Transaction[]` records tagged with `classificationSource: 'local'`.

- **Cloud Engine (Google Gemini Pro):**
  - No LLM routes or cloud API calls are invoked for supported credit card statements, budgeting, or text list ingestion. The external LLM extraction pipeline is reserved solely as a fallback for unrecognized statement formats whose sanitized text is reviewed and confirmed by the user.

---

## Phase 26: Simple Expense List Ingestion & Context-Aware Parser (More Upload Formats)

### [x] US-052: Context-Aware Simple Expense List Parser & Numeric Merchant Disambiguation
- **As a** user who jots down quick expense lists in plain text,
- **I want** the system to accurately extract the merchant description and the Quetzal amount from each line—even when the amount comes first, comes last, or the merchant name itself contains a number (such as `Super 24`),
- **So that** my informal expense notes are converted into structured transactions without manual formatting.
- **Split-Brain Boundary:** 100% Local (Pure TypeScript text parser and merchant catalog matcher).
- **Acceptance Criteria:**
  - [x] Creates a dedicated local parser module `src/lib/text-list-parser.ts` exporting `parseSimpleExpenseList(rawText: string, uploadDate?: string, exchangeRate?: number)`.
  - [x] Ensures `"super 24"` (and common numeric Guatemalan merchants) are present in `src/data/merchant-catalog.json` under the appropriate category (e.g., `Supermercado`).
  - [x] Correctly parses lines where the vendor precedes the amount:
    - `"Walmart 150"` -> `{ description: "Walmart", amount: 150, currency: "GTQ" }`
    - `"Cemaco 200"` -> `{ description: "Cemaco", amount: 200, currency: "GTQ" }`
    - `"gasolina 90"` -> `{ description: "gasolina", amount: 90, currency: "GTQ" }`
  - [x] Correctly parses lines where the amount precedes the vendor:
    - `"150 Burger king"` -> `{ description: "Burger king", amount: 150, currency: "GTQ" }`
    - `"50 Taco bell"` -> `{ description: "Taco bell", amount: 50, currency: "GTQ" }`
    - `"50 dollarcity"` -> `{ description: "dollarcity", amount: 50, currency: "GTQ" }`
  - [x] Context-aware numeric vendor disambiguation: When a line contains multiple numbers (e.g., `"40 super 24"` or `"super 24 20"`), uses known multi-token merchant patterns from `merchant-catalog.json` and positional context to identify which number is part of the vendor name and which is the transaction amount:
    - `"40 super 24"` -> `{ description: "super 24", amount: 40, currency: "GTQ" }`
    - `"super 24 20"` -> `{ description: "super 24", amount: 20, currency: "GTQ" }`
  - [x] Supports decimal amounts (e.g., `125.50`) and optional currency prefixes/suffixes (`Q`, `GTQ`, `$`, `USD`); when no currency symbol is present, treats the amount as Guatemalan Quetzales (`GTQ`) by default.
  - [x] When a line does not include a date, assigns the day of uploading (`YYYY-MM-DD` in local time) as the transaction `date`.
  - [x] Ignores blank lines and returns a structured parsing summary (`validTransactionsCount`, `skippedLinesCount`, `skippedLines`, `totalAmount`) alongside the canonical `Transaction[]` array.
  - [x] Includes comprehensive unit tests in `src/lib/text-list-parser.test.ts` covering all examples from `SPEC.md` (`Walmart 150`, `Cemaco 200`, `150 Burger king`, `50 Taco bell`, `50 dollarcity`, `40 super 24`, `gasolina 90`, `super 24 20`), decimals, blank lines, and invalid lines.

### [x] US-053: Simple Expense List Textbox UI & Session Ingestion Integration
- **As a** user on the upload screen or adding more data to my active session,
- **I want** a simple textbox interface where I can write or paste a list of expenses and import them directly into my session,
- **So that** I can track everyday cash or informal expenses alongside my bank statements.
- **Split-Brain Boundary:** 100% Local (Client UI component and local classification/deduplication pipeline).
- **Acceptance Criteria:**
  - [x] Adds a clear action option in the upload interface (`src/components/file-upload.tsx`) and in the "Agregar más estados de cuenta" modal (`src/app/page.tsx`) labeled "Ingresar lista rápida de gastos" / "Pegar lista de gastos".
  - [x] Clicking the option opens a clean, responsive textbox interface (`src/components/simple-list-modal.tsx` or expandable panel) featuring:
    - A multi-line `<textarea>` with placeholder examples in Spanish (`"Ejemplo:\nWalmart 150\n150 Burger King\n40 super 24"`).
    - Helper copy explaining that dates default to today and amounts default to Quetzales (`Q`).
    - A live preview or validation counter showing how many valid movements are detected as the user types or pastes.
    - "Cancelar" and "Agregar gastos" action buttons in Spanish using standard SVG icons.
  - [x] Upon submitting the list, parses the lines via `parseSimpleExpenseList`, runs them through the local expense classifier (`classifyTransactions`), and appends them to the existing session transactions (including any previously saved session in `localStorage`) so they never replace previous transactions or start a new session.
  - [x] Displays a Spanish confirmation banner summarizing the imported list items (e.g., `"Se agregaron 4 transacciones desde la lista rápida"`).
  - [x] 100% of labels, placeholders, and error states are in Spanish with zero emojis.

---

## Phase 27: Budgeting Data Model, Local Storage Persistence & Navigation Architecture

### [ ] US-054: Budget Data Structures, Historical Month Versioning & LocalStorage Persistence
- **As a** user creating and maintaining a personal budget across multiple months,
- **I want** my budget targets and historical monthly budget assignments to be reliably saved in my browser's `localStorage`,
- **So that** my budget configuration and month-by-month goals persist across reloads and accurately reflect the budget that was active for each month.
- **Split-Brain Boundary:** 100% Local (`src/types/budget.ts` and `src/lib/storage.ts` using `window.localStorage`).
- **Acceptance Criteria:**
  - [ ] Defines canonical budget TypeScript interfaces in `src/types/budget.ts` (or `src/types/transaction.ts`):
    - `CategoryBudgetTarget`: `{ categoryId: string; categoryName: string; monthlyLimitGTQ: number; isEssential?: boolean }`
    - `BudgetPlan`: `{ id: string; name?: string; targets: CategoryBudgetTarget[]; totalMonthlyBudgetGTQ: number; createdMode: "zero" | "transactions"; updatedAt: string }`
    - `StoredBudgetState`:
      - `currentBudget: BudgetPlan | null`: The default/active budget plan for current and future months.
      - `monthlyBudgets: Record<string, BudgetPlan>`: Month-keyed (`"YYYY-MM"`) budget snapshots allowing previous months to retain their historical budget when the user chooses "from now on" during edits, or to be overwritten when the user chooses "apply to previous months".
      - `effectiveFromMonth?: string | null`: The `"YYYY-MM"` threshold from which `currentBudget` applies when historical months are preserved.
  - [ ] Implements helper functions in `src/lib/budget-engine.ts` and `src/lib/storage.ts`:
    - `saveStoredBudgetState(state: StoredBudgetState): boolean` under key `STORAGE_KEY_BUDGET = "expense_tracker_budget_v1"`.
    - `loadStoredBudgetState(): StoredBudgetState | null` with structural validation and corruption recovery.
    - `clearStoredBudgetState(): boolean` integrated optionally into session reset controls.
    - `getBudgetForMonth(state: StoredBudgetState, monthKey: string): BudgetPlan | null` returning the exact `BudgetPlan` applicable to any given `"YYYY-MM"` month.
  - [ ] Includes unit tests in `src/lib/storage.test.ts` verifying serialization, corruption resilience, and accurate month-specific budget resolution.

### [ ] US-055: Dedicated Budgeting Tool View & Cross-Screen Navigation (Upload & Dashboard)
- **As a** user,
- **I want to** access the Budgeting Tool from either the initial file upload screen or the financial dashboard and return seamlessly,
- **So that** I can plan or review my budget at any point in my workflow—even before uploading a bank statement.
- **Split-Brain Boundary:** 100% Local (Client view routing and header controls).
- **Acceptance Criteria:**
  - [ ] Adds a prominent entry button/card on the File Upload / Landing screen (`src/app/page.tsx`) labeled `"Herramienta de Presupuesto"` / `"Crear o ver mi presupuesto"` with an SVG icon, allowing users to open the Budgeting Tool with or without uploaded transactions.
  - [ ] Adds a dedicated `"Presupuesto"` action button in the Dashboard header (`src/components/dashboard-view.tsx`) and Transaction Review header so users can switch to the Budgeting Tool at any time.
  - [ ] Renders a dedicated full-screen Budgeting Tool container (`src/components/budget-tool-view.tsx`) with a clean header featuring:
    - Title (`"Mi Presupuesto Mensual"`) and active status badge.
    - Navigation tabs or sections within the tool (e.g., `"Configurar Presupuesto"`, `"Comparativa Mensual y Metas"`, `"Sugerencias del Próximo Mes"`).
    - A clear return button (`"Volver al Panel"` when transactions exist, or `"Volver al Inicio"` when no transactions are loaded).
  - [ ] Preserves all active session transactions, filters, and dashboard panel states when toggling between the Upload screen, Dashboard, and Budgeting Tool.

---

## Phase 28: Budget Creation Flows (From Zero & Transaction-Based)

### [ ] US-056: Interactive "Create Budget From Zero" Builder with Tiered Category Presets
- **As a** user who wants to create a budget from scratch,
- **I want** clickable category chips to easily add categories to my budget and one-click target amount suggestions tailored to each category's importance and my past spending,
- **So that** building a complete, logical budget from zero takes only a few clicks.
- **Split-Brain Boundary:** 100% Local (Deterministic category tier presets and interactive UI).
- **Acceptance Criteria:**
  - [ ] When no budget exists (or when creating a new budget), presents two clear starting paths:
    1. `"Crear presupuesto desde cero"` (Always available).
    2. `"Generar basado en mis gastos subidos"` (Available when transactions are loaded; displays a helpful prompt to upload movements if none exist yet).
  - [ ] In the `"Crear presupuesto desde cero"` flow:
    - Displays clickable category pills/cards for all standard categories in `merchant-catalog.json` plus any user-created `CustomCategory` items, grouped or badged by priority (`"Gastos Esenciales / Hogar"` vs. `"Estilo de Vida y Ocio"`).
    - Clicking a category chip adds it to (or removes it from) the active budget builder list. Includes an `"Agregar categorías principales"` quick action for convenience.
  - [ ] For each added category, provides clickable quick-amount pills (`Q`) so the user can set or adjust the target without typing from scratch:
    - **Logical Category Tiers:** Essential living expense categories (`Supermercado`, `Servicios Básicos`, `Transporte y Combustible`, `Salud y Farmacia`, `Educación`, `Visacuotas y Financiamiento`) provide higher suggested amount chips (e.g., `Q 1,000`, `Q 2,000`, `Q 3,000`, `Q 4,500`) than discretionary / "for fun" categories (`Restaurantes y Cafés`, `Entretenimiento y Compras`, `Suscripciones`), which provide lower suggested amount chips (e.g., `Q 150`, `Q 300`, `Q 500`, `Q 800`).
    - **Historical Context Chips (when transactions exist):** If the user has uploaded transactions for that category, also displays clickable chips based on their actual history (e.g., `"Promedio: Q 1,450"`, `"Último mes: Q 1,600"`, `"Meta -10%: Q 1,300"`).
    - Also includes a clean numeric input in `Q` and quick increment/decrement buttons (`-Q 100` / `+Q 100`) for fine-tuning.
  - [ ] Displays a live summary bar showing the total monthly budget in Quetzales (`Total presupuestado: Q XX,XXX.XX`) and breakdown between essential and discretionary targets.
  - [ ] Clicking `"Guardar presupuesto"` persists the budget to `localStorage` and transitions to the Budget Comparison & Overview screen.

### [ ] US-057: Realistic "Create Budget From Transactions" Generator
- **As a** user who has already uploaded bank statements or expense lists,
- **I want** the tool to automatically generate a realistic budget based on my historical expenses where targets are close to what I actually spend,
- **So that** I start with an achievable baseline rather than an unrealistic goal that is impossible to meet.
- **Split-Brain Boundary:** 100% Local (Statistical historical average and realistic target heuristic in `src/lib/budget-engine.ts`).
- **Acceptance Criteria:**
  - [ ] Implements `generateRealisticBudgetFromTransactions(transactions: Transaction[], customCategories?: CustomCategory[]): BudgetPlan` in `src/lib/budget-engine.ts`.
  - [ ] Groups uploaded expenses by calendar month (`YYYY-MM`) and category to compute the user's average monthly expenditure per active category.
  - [ ] Sets realistic category targets that are not far from current expenses:
    - For essential/fixed categories (`Servicios Básicos`, `Suscripciones`, `Visacuotas y Financiamiento`, `Salud y Farmacia`, `Educación`), sets the recommended target to ~`100%` of the historical monthly average (rounded to the nearest `Q 25` or `Q 50`) so fixed commitments are realistically covered.
    - For variable/discretionary categories (`Supermercado`, `Restaurantes y Cafés`, `Entretenimiento y Compras`, `Transporte y Combustible`, `Transferencias y Cajeros`), sets a realistic, achievable target at `90%`–`95%` of the historical monthly average (a gentle 5%–10% optimization, never an extreme cut like 50%), rounded to clean Quetzal increments.
  - [ ] Presents the generated targets in an interactive review screen showing each category's `"Gasto promedio actual (Q)"` alongside the `"Meta realista sugerida (Q)"` and the difference in `Q` and `%`.
  - [ ] Allows the user to adjust any individual category target via clickable preset chips (e.g., `"Igualar a mi promedio"`, `"-5%"`, `"-10%"`) or manual input before clicking `"Confirmar y guardar presupuesto"`.
  - [ ] Includes unit tests in `src/lib/budget-engine.test.ts` verifying that generated targets stay within realistic bounds (`85%`–`105%` of historical monthly averages) across single-month and multi-month datasets.

---

## Phase 29: Budget Editing & Retroactive vs. Forward-Only Versioning

### [ ] US-058: Budget Editing Workflow & Historical Application Confirmation Modal
- **As a** user whose financial goals or expenses have changed,
- **I want to** edit my budget at any time and choose whether my changes apply retroactively to previous months or only from now on,
- **So that** historical month comparisons and stats remain fair and accurate according to the budget that was meant for each month.
- **Split-Brain Boundary:** 100% Local (Time-versioned state management in `src/lib/budget-engine.ts` and `localStorage`).
- **Acceptance Criteria:**
  - [ ] Provides an `"Editar presupuesto"` button in the Budgeting Tool overview that opens the interactive budget editor pre-populated with the current budget's categories and targets (allowing adding/removing categories and modifying target amounts).
  - [ ] When the user clicks `"Guardar cambios"` on an edited budget and historical months exist (or a previous budget was already saved), displays a clear confirmation modal in Spanish asking how to apply the updated budget:
    - Prompt: `"¿Cómo deseas aplicar los cambios a tu presupuesto?"`
    - **Option 1 ("Aplicar a meses anteriores y de ahora en adelante"):** Overwrites all monthly budget snapshots in `monthlyBudgets` so every uploaded month is evaluated against the newly updated budget.
    - **Option 2 ("Aplicar solo de ahora en adelante"):** Preserves the previous budget snapshots in `monthlyBudgets` for all earlier uploaded months (months prior to the latest/current month), and applies the new budget starting from the current/latest month onward.
  - [ ] Implements `applyBudgetUpdate(prevState: StoredBudgetState, updatedPlan: BudgetPlan, scope: "all_months" | "from_now_on", availableMonths: string[]): StoredBudgetState` in `src/lib/budget-engine.ts`.
  - [ ] All monthly comparison charts, category goal counters, and weekly streaks dynamically resolve each month's corresponding budget via `getBudgetForMonth(budgetState, monthKey)`.
  - [ ] Includes unit tests in `src/lib/budget-engine.test.ts` verifying that `"from_now_on"` preserves prior month targets while `"all_months"` updates all historical months, and that stats recalculate accurately under both scopes.

---

## Phase 30: Monthly Budget Comparison & Gamified Performance Stats

### [ ] US-059: Monthly Budget vs. Actual Expense Comparison Engine & Visualization
- **As a** user with an active budget and uploaded expenses,
- **I want to** compare each uploaded month's expenses against that month's applicable budget—both in total and category by category,
- **So that** I can clearly see where I stayed within budget and where I overspent in any given month.
- **Split-Brain Boundary:** 100% Local (Mathematical comparison engine and native SVG/Tailwind progress visualizations).
- **Acceptance Criteria:**
  - [ ] Implements `compareMonthAgainstBudget(transactions: Transaction[], monthKey: string, budgetPlan: BudgetPlan)` in `src/lib/budget-engine.ts` computing:
    - Total budgeted (`totalBudgetedGTQ`) vs. total spent (`totalSpentGTQ`), remaining balance (`remainingGTQ`), and overall utilization percentage.
    - Per-category comparison: `budgetedGTQ`, `actualGTQ`, `differenceGTQ`, `utilizationPercent`, and status (`"under"` when `<= 90%`, `"near"` when `> 90%` and `<= 100%`, `"over"` when `> 100%`, and `"way_over"` when `>= 125%` or exceeding target by a significant margin).
    - Unbudgeted categories warning: identifies any categories with actual spending in that month that were not included in the budget.
  - [ ] Renders a Month Selector bar allowing the user to switch between each uploaded calendar month (e.g., `"Julio 2026"`, `"Agosto 2026"`, `"Septiembre 2026"`), displaying a badge indicating which budget version is applied to that month.
  - [ ] Displays a high-level Monthly Summary Card contrasting `"Presupuesto del Mes (Q)"` vs. `"Gasto Real (Q)"` with a visual progress bar and net difference (`"Ahorro bajo presupuesto: Q XXX.XX"` in emerald or `"Exceso sobre presupuesto: Q XXX.XX"` in rose/amber).
  - [ ] Displays a Category-by-Category Comparison List/Chart with color-coded progress bars, exact amounts (`Q gastado / Q meta`), and percentage badges.

### [ ] US-060: Gamified Budget Statistics (Weekly Streaks & Category Goal Counters)
- **As a** user tracking my budget progress,
- **I want** to see motivating, fun statistics such as how many weeks in a row I have achieved my budget and how many categories met their goal,
- **So that** staying on budget feels rewarding and engaging.
- **Split-Brain Boundary:** 100% Local (Deterministic streak and goal calculation in `src/lib/budget-engine.ts`).
- **Acceptance Criteria:**
  - [ ] Implements `calculateBudgetFunStats(transactions: Transaction[], budgetState: StoredBudgetState, selectedMonthKey: string)` in `src/lib/budget-engine.ts` calculating:
    1. **Weekly Streak (`semanasEnRacha`):** Partitions uploaded transaction dates into calendar weeks (or 7-day windows across the uploaded period) and compares each week's spending against the weekly pro-rated budget (`totalMonthlyBudgetGTQ / 4.33` or `totalMonthlyBudgetGTQ / 4` per month's budget). Calculates both the current consecutive streak of weeks within budget and the best streak achieved.
    2. **Categories Met Goal (`categoriasCumplidas`):** For the selected month, counts how many budgeted categories finished at or below their target (`actualGTQ <= monthlyLimitGTQ`) out of total budgeted categories (e.g., `"5 de 7 categorías cumplidas"`).
    3. **Best Performing Category / Savings Highlight:** Identifies the category with the highest Quetzal or percentage savings under budget in the selected month.
    4. **Months Within Overall Budget:** Counts how many uploaded months achieved total spending at or below the monthly budget.
  - [ ] Renders a dedicated row of scannable, modern KPI cards in the Budgeting Tool using crisp SVG icons (`Icons.Award` / `Icons.TrendingUp` / `Icons.CheckCircle` / `Icons.Flame` or equivalent standard SVGs in `src/components/icons.tsx`):
    - Card 1: `"Racha semanal"` (e.g., `"3 semanas seguidas dentro del presupuesto"`).
    - Card 2: `"Metas por categoría"` (e.g., `"5 de 6 categorías en meta este mes"`).
    - Card 3: `"Balance del mes"` / `"Mejor categoría"`.
  - [ ] Includes unit tests in `src/lib/budget-engine.test.ts` validating weekly streak counting (consecutive pass, broken streak reset, best streak) and category goal tallies.

---

## Phase 31: Intelligent Local Coaching & Next-Month Improvement Suggestions

### [ ] US-061: Over-Budget Root-Cause Analyzer & Multi-Month Improvement Coaching Engine
- **As a** user who wants actionable guidance for next month,
- **I want** the system to analyze my transactions locally to explain why a category went over budget and recognize when I have been improving a category over one or several months,
- **So that** I receive specific, data-backed recommendations on what to focus on next month.
- **Split-Brain Boundary:** 100% Local (Deterministic root-cause & trajectory analysis in `src/lib/budget-engine.ts`).
- **Acceptance Criteria:**
  - [ ] Implements `generateNextMonthSuggestions(transactions: Transaction[], budgetState: StoredBudgetState, targetMonthKey?: string): BudgetSuggestion[]` in `src/lib/budget-engine.ts`.
  - [ ] **Rule 1 — Over-Budget Alert & Root-Cause Diagnosis:** When a category's spending is over budget (especially way over budget, e.g., `> 115%` of target or highest Quetzal overrun), generates a priority alert and inspects that month's transactions in that category to determine and explain the primary probable cause(s) in Spanish with concrete numbers:
    - *Single Expensive Purchase (`compra_unica_alta`):* One transaction accounts for `>= 45%` of the category's total spend or exceeds the entire category budget boost on its own (names the merchant, date, and amount in `Q`).
    - *Too Many Transactions (`alta_frecuencia`):* High number of transactions (e.g., `>= 8` purchases in the month with a modest average ticket), alerting the user that frequent small/medium purchases ("compras frecuentes") drove the overrun.
    - *Date Clustering (`concentracion_fechas`):* A large share of the category's spending (`>= 50%` across `>= 2` transactions) occurred on a single day or within a 3-day window, pointing out the specific date range and total spent in that cluster.
    - *High Overall Spend (`monto_total_elevado`):* Broadly elevated spending across multiple medium-sized purchases, specifying how much (`Q`) needs to be trimmed next month to return to the target.
  - [ ] **Rule 2 — Short-Term Improvement Encouragement (Some Months of Improvement):** Tracks category spending across chronological uploaded months. If a category shows improvement over **1 to 2 consecutive months** (e.g., spending decreased compared to the previous month or moved from over-budget to within-budget), generates an encouraging coaching message in Spanish motivating the user to keep up the momentum in that category (quoting the previous vs. current `Q` amounts).
  - [ ] **Rule 3 — Long-Term Mastery & Next-Target Pivot (Many Months of Improvement):** If a category shows sustained improvement or consistent goal achievement across **3 or more months** (or `>= 2` consecutive transitions of steady reduction across 3+ uploaded months), generates a milestone message congratulating the user on consolidating that habit and explicitly recommending another specific category (the one currently furthest over budget or with the highest discretionary spend) to start improving next.
  - [ ] Includes comprehensive unit tests in `src/lib/budget-engine.test.ts` testing all four over-budget root causes (expensive purchase, high transaction count, date cluster, high total) as well as short-term (1–2 months) and long-term (3+ months) improvement coaching rules.

### [ ] US-062: Next-Month Improvement Suggestions UI & Actionable Insights Panel
- **As a** user reviewing my budget performance,
- **I want** a clear, visual panel presenting next-month suggestions, root-cause alerts, and improvement encouragements in Spanish,
- **So that** I immediately know which category to prioritize next month and why.
- **Split-Brain Boundary:** 100% Local (Client React component rendering structured insights).
- **Acceptance Criteria:**
  - [ ] Renders a dedicated `"Sugerencias para el Próximo Mes"` section within the Budgeting Tool view (`src/components/budget-tool-view.tsx`).
  - [ ] Organizes suggestions with distinct visual styling and standard SVG icons:
    - **Alertas de Exceso y Causa Probable (Rose/Amber badge):** Displays the over-budget category, the excess amount in `Q`, the specific detected cause (e.g., `"Causa probable: Una compra individual elevada en Cemaco por Q 850.00 representó el 65% del gasto"`, `"Causa probable: Alta frecuencia de compras (14 transacciones en el mes)"`, or `"Causa probable: Gastos concentrados alrededor del 15 de julio (Q 620.00 en 2 días)"`), and a concrete target action for next month.
    - **Continúa Mejorando (Blue/Emerald badge):** Highlights categories with 1–2 months of improvement, showing the reduction achieved in `Q` and encouraging the user to maintain the trend next month.
    - **Hábito Consolidado — Nuevo Reto (Violet/Emerald badge):** Highlights categories with 3+ months of sustained improvement/compliance and suggests the next specific category to focus on improving.
  - [ ] When no transactions are uploaded yet, displays a helpful Spanish empty state explaining that once bank statements or expense lists are loaded, personalized monthly comparisons and root-cause suggestions will appear automatically.
  - [ ] All copy is 100% in Spanish, uses `Q` / `GTQ` currency formatting, and uses zero emojis.

---

## Phase 32: Fourth Iteration End-to-End Integration & Quality Assurance

### [ ] US-063: End-to-End Budgeting & Simple List Integration, Localization & Regression Verification
- **As a** user,
- **I want** the Budgeting Tool and Simple Expense List ingestion to integrate seamlessly with existing PDF/CSV parsers, the 4-panel dashboard, and `localStorage` persistence,
- **So that** the entire application remains fast, cohesive, accessible, and error-free.
- **Split-Brain Boundary:** 100% Local verification.
- **Acceptance Criteria:**
  - [ ] The Budgeting Tool is reachable from both the initial File Upload view and the Dashboard view, and returns cleanly to the previous screen.
  - [ ] Budgets can be created both from zero (with clickable category chips and logical tiered amount presets) and from uploaded transactions (with realistic targets).
  - [ ] Editing a budget prompts the user to apply changes to previous months or from now on, and monthly comparisons/stats honor the selected scope.
  - [ ] Simple text lists (`Walmart 150`, `150 Burger king`, `40 super 24`, `super 24 20`, etc.) parse accurately with upload-day dates, `GTQ` currency defaults, and context-aware vendor number disambiguation.
  - [ ] All budget data and imported list transactions persist in `localStorage` across page reloads.
  - [ ] 100% of user-facing UI text, labels, buttons, modals, and coaching insights are in Spanish.
  - [ ] Zero emojis are used anywhere in the UI; all icons use standard SVG components.
  - [ ] All monetary amounts are formatted in Guatemalan Quetzales (`Q` / `GTQ`).
  - [ ] `npm test` passes all existing and new unit tests with zero regressions.
  - [ ] `npm run build` succeeds with zero TypeScript or Next.js build errors.

---

## Phase 33: Legacy Checking Account Parser Deprecation (Scope Transition to Credit Cards)

### [x] US-064: Deprecation and Removal of Legacy Checking Account Parsers (Banco Industrial & Banrural)
- **As a** developer and maintainer of the expense tracking engine,
- **I want** the legacy checking and savings account (cuentas monetarias y de ahorro) parsers for Banco Industrial and Banrural to be decommissioned and removed from the active PDF statement ingestion pipeline,
- **So that** the parsing codebase is strictly focused on credit card statements, eliminating false-positive matches, conflicting account regex heuristics, and obsolete code paths.
- **Split-Brain Boundary:** 100% Local (Decommissioning legacy parsers in `src/lib/bi-parser.ts`, `src/lib/banrural-parser.ts`, and `src/lib/pdf-parser.ts`).
- **Acceptance Criteria:**
  - [x] References and supersedes legacy checking account parsing from **US-018** (Banco Industrial) and **US-019** (Banrural) in [`iteration_2/USER_STORIES_2.md`](./iteration_2/USER_STORIES_2.md).
  - [x] Removes checking account (cuenta monetaria / ahorro) table extraction patterns, deposit filters, and account balance regexes from `src/lib/bi-parser.ts`.
  - [x] Retires and removes `src/lib/banrural-parser.ts` from the statement routing logic in `src/lib/pdf-parser.ts` (Banrural is no longer supported in the credit card focus scope).
  - [x] Cleans up legacy checking-account-specific test suites (`src/lib/banrural-parser.test.ts` and checking fixtures in `src/lib/bi-parser.test.ts`) so they no longer run against decommissioned account layouts.
  - [x] Unparsed Banrural statements fall back gracefully to the unsupported bank anonymization workflow (`isSupportedBank: false`).
  - [x] Shared parser utilities (date normalizers, foreign currency conversion, merchant description cleaners, and deduplication helpers) remain completely intact and functional.
  - [x] Zero breaking changes to the general transaction model (`Transaction`), CSV parsing, or text list ingestion.
  - [x] `npm test` runs with zero failures and `npm run build` succeeds without broken imports or unresolved references.

---

## Phase 34: Credit Card Multi-Bank Identification & Specialized Statement Parsers

### [ ] US-065: Multi-Bank Identification & Automatic Bank Selection for Credit Card Statements
- **As a** user uploading a credit card statement in PDF format,
- **I want** the system to automatically inspect the document content and determine whether it originates from Banco Industrial, Banco Cuscatlán, BAC Credomatic, FICOHSA, or Banco Agromercantil (BAM),
- **So that** the document is parsed using the correct specialized local credit card parser without requiring manual bank selection or external LLM routing.
- **Split-Brain Boundary:** 100% Local (Client / Server text detection and routing in `src/lib/pdf-parser.ts`).
- **Acceptance Criteria:**
  - [ ] References and supersedes general bank detection in **US-017** ([`iteration_2/USER_STORIES_2.md`](./iteration_2/USER_STORIES_2.md)), focusing specifically on credit card statement formats.
  - [ ] Analyzes extracted PDF text headers, metadata, issuer URLs, card branding, and institution keywords 100% locally to detect the originating credit card issuer:
    - **Banco Industrial:** `Banco Industrial`, `Bi en Línea`, `bi.com.gt`, `Club Bi`, `Bi Credit`, `Corporación Bi`, `Tarjeta de Crédito Bi`.
    - **Banco Cuscatlán:** `Banco Cuscatlán`, `Cuscatlán`, `bancocuscatlan.com.gt`, `Tarjeta de Crédito Cuscatlán`, `MultiPremios Cuscatlán`.
    - **BAC Credomatic:** `BAC Credomatic`, `BAC`, `Credomatic`, `baccredomatic.com`, `bac.net`, `Puntos BAC`, `Tarjeta de Crédito BAC`, `American Express BAC`, `Mastercard BAC`, `Visa BAC`.
    - **Banco FICOHSA:** `Banco Ficohsa`, `Ficohsa`, `ficohsa.com`, `ficohsa.com.gt`, `Tarjeta de Crédito Ficohsa`, `Puntos Ficohsa`, `Cash Back Ficohsa`.
    - **Banco Agromercantil (BAM):** `Banco Agromercantil`, `BAM`, `bam.com.gt`, `Tarjeta de Crédito BAM`, `Puntos BAM`.
  - [ ] Dispatches the document automatically to the verified credit card parser:
    - `parseBiCreditCardStatement` (US-066)
    - `parseCuscatlanCreditCardStatement` (US-067)
    - `parseBacCreditCardStatement` (US-068)
    - `parseFicohsaCreditCardStatement` (US-069)
    - `parseBamCreditCardStatement` (US-070)
  - [ ] Attaches the verified bank name to the parsing result metadata (`bankName: string`), ensuring that only verified banking institutions display in the dashboard header badge per the UI cleanliness rules.
  - [ ] If no supported credit card layout or issuer matches, flags the document as an "unsupported bank" (`isSupportedBank: false`) and smoothly transitions to the Local PII Anonymization and Preview flow (US-005).
  - [ ] Bank detection executes 100% locally with zero network requests or LLM invocations.
  - [ ] Includes unit tests in `src/lib/pdf-parser.test.ts` verifying accurate detection and automatic dispatching for all 5 credit card issuers, as well as fallback behavior for unsupported documents.

### [ ] US-066: Banco Industrial (BI) Credit Card Statement PDF Parser
- **As a** Banco Industrial credit card cardholder,
- **I want to** upload my Bi Credit (Visa or Mastercard) PDF statement and have my expenses extracted locally,
- **So that** my credit card spending is accurately tracked in Quetzales with complete privacy.
- **Split-Brain Boundary:** 100% Local (Local PDF text extraction and regex parsing in `src/lib/bi-parser.ts`).
- **Acceptance Criteria:**
  - [ ] References and specializes **US-018** ([`iteration_2/USER_STORIES_2.md`](./iteration_2/USER_STORIES_2.md)) exclusively for Bi Credit credit card statement layouts (Visa / Mastercard).
  - [ ] Extracts individual card purchase transactions from Banco Industrial credit card statement layouts.
  - [ ] Parses transaction dates (`DD/MM/YYYY` or `DD-MMM`) and normalizes them to ISO format `YYYY-MM-DD`.
  - [ ] Normalizes merchant/establishment descriptions: removes authorization codes, POS terminal markers (`POS BI`, `COMPRA POS`), card terminal numbers, and location identifiers (e.g., `GUATEMALA GTM`, `GT`).
  - [ ] Extracts purchase amounts in both Guatemalan Quetzales (`Q`) and US Dollars (`$`), converting USD transactions to Quetzales at the active exchange rate and tagging `originalCurrency: "USD"` / `originalAmount`.
  - [ ] Filters out payments to the card (`PAGO DE TARJETA`, `PAGO EN EFECTIVO`, `PAGO POR BI EN LINEA`, `PAGO ACH`), credit adjustments, cashback/points redemptions, and financing reversals.
  - [ ] Ignores statement summaries and header blocks (`Límite de Crédito`, `Saldo al Corte`, `Pago Mínimo`, `Pago de Contado`, `Fecha de Corte`, `Fecha Límite de Pago`, `Puntos Bi Disponibles`).
  - [ ] Discards legal footers, disclaimer text, and interest calculation disclosure tables.
  - [ ] Outputs canonical `Transaction[]` tagged with `classificationSource: 'local'`.
  - [ ] Includes comprehensive unit tests in `src/lib/bi-parser.test.ts` covering single-page, multi-page, and dual-currency (GTQ and USD) credit card statement fixtures.

### [x] US-067: Banco Cuscatlán Credit Card Statement PDF Parser
- **As a** Banco Cuscatlán credit card customer,
- **I want to** upload my Cuscatlán credit card PDF statement and have my expenses parsed locally,
- **So that** I can track my monthly purchases without exposing financial records to external LLMs.
- **Split-Brain Boundary:** 100% Local (Dedicated module `src/lib/cuscatlan-parser.ts`).
- **Acceptance Criteria:**
  - [x] Creates dedicated parser `src/lib/cuscatlan-parser.ts` exporting `extractCuscatlanTransactionsFromParser(parser, rawText)`.
  - [x] Accurately parses transaction date and normalizes to ISO `YYYY-MM-DD`.
  - [x] Cleans and normalizes merchant descriptions, removing reference numbers, authorization codes, POS prefixes, and location suffixes.
  - [x] Accurately captures amounts in Quetzales and US Dollars, converting dollar amounts to Quetzales at the active exchange rate and setting `originalCurrency: "USD"`.
  - [x] Discards card payment records (`SU PAGO - GRACIAS`, `PAGO RECIBIDO`, `PAGO ELECTRONICO CUSCATLAN`, `ABONO`), cashback adjustments, and MultiPremios points credits.
  - [x] Filters out statement metadata and summary tables (`Límite de Crédito`, `Saldo al Corte`, `Pago Mínimo`, `Fecha de Corte`, `Fecha Límite de Pago`, `Tasa de Interés`).
  - [x] Outputs canonical `Transaction[]` tagged with `classificationSource: 'local'`.
  - [x] Includes comprehensive unit tests in `src/lib/cuscatlan-parser.test.ts` covering Cuscatlán statement layouts, multi-page statements, and dual-currency transactions.

### [x] US-068: BAC Credomatic Credit Card Statement PDF Parser
- **As a** BAC Credomatic credit card customer,
- **I want to** upload my BAC statement PDF (Visa, Mastercard, or American Express) and have my charges extracted locally,
- **So that** my card expenses and installment plans are captured privately and accurately.
- **Split-Brain Boundary:** 100% Local (Dedicated module `src/lib/bac-parser.ts`).
- **Acceptance Criteria:**
  - [x] Creates dedicated parser `src/lib/bac-parser.ts` exporting `extractBacTransactionsFromParser(parser, rawText)`.
  - [x] Extracts purchase transactions from BAC Credomatic credit card statement formats across Visa, Mastercard, and American Express layouts.
  - [x] Correctly parses transaction date and normalizes to `YYYY-MM-DD`.
  - [x] Handles BAC's multi-currency statement format (separate Quetzales and Dollars columns or sections), converting USD amounts to GTQ via `convertUsdToGtq` with `originalCurrency: "USD"`.
  - [x] Cleans merchant descriptions, stripping authorization reference numbers, terminal markers, POS codes, and regional suffixes (`GTM`, `CIUDAD DE GUATEMALA`, `AMEX BAC`).
  - [x] Filters out card payments (`SU PAGO EN EFECTIVO`, `SU PAGO POR TRANSFERENCIA`, `CREDITO POR PAGO BAC`, `PAGO DE TARJETA`), rewards/puntos disbursements, and adjustment credits.
  - [x] Ignores statement summaries (`Saldo Anterior`, `Saldo al Corte`, `Límite de Crédito`, `Pago Mínimo`, `Intereses Bonificables`), payment deadlines, and legal disclaimers.
  - [x] Correctly captures installment plan charges (`BAC Cuotas` / `Tasa Cero` / `Cuotas sin Intereses`) as valid expenses.
  - [x] Outputs canonical `Transaction[]` tagged with `classificationSource: 'local'`.
  - [x] Includes comprehensive unit tests in `src/lib/bac-parser.test.ts` with representative BAC Credomatic statement fixtures covering single-page, multi-page, dual-currency, and American Express statements.

### [ ] US-069: Banco FICOHSA Credit Card Statement PDF Parser
- **As a** Banco FICOHSA credit card customer,
- **I want to** upload my Ficohsa credit card PDF statement and have my expenses extracted locally,
- **So that** my spending is categorized without sending private banking data across the network.
- **Split-Brain Boundary:** 100% Local (Dedicated module `src/lib/ficohsa-parser.ts`).
- **Acceptance Criteria:**
  - [ ] Creates dedicated parser `src/lib/ficohsa-parser.ts` exporting `extractFicohsaTransactionsFromParser(parser, rawText)`.
  - [ ] Extracts purchase transactions from Banco Ficohsa credit card statement layouts.
  - [ ] Parses transaction dates and normalizes them to `YYYY-MM-DD`.
  - [ ] Sanitizes merchant descriptions: strips authorization codes, POS terminal IDs, branch numbers, and location identifiers.
  - [ ] Accurately captures amounts in Quetzales and Dollars, converting foreign currency transactions via `convertUsdToGtq` with `originalCurrency: "USD"`.
  - [ ] Excludes payments to the card (`PAGO DE CONTADO`, `PAGO RECIBIDO GRACIAS`, `PAGO POR SUCURSAL / INTERNET`), rewards redemption credits (Puntos Ficohsa / Cash Back), and credit adjustments.
  - [ ] Ignores statement summaries and account metrics (`Límite de Crédito`, `Saldo Total`, `Pago Mínimo`, `Fecha de Corte`, `Fecha Máxima de Pago`).
  - [ ] Outputs canonical `Transaction[]` tagged with `classificationSource: 'local'`.
  - [ ] Includes unit tests in `src/lib/ficohsa-parser.test.ts` covering Ficohsa statement text fixtures, multi-page layouts, and edge cases.

### [ ] US-070: Banco Agromercantil (BAM) Credit Card Statement PDF Parser
- **As a** Banco Agromercantil (BAM) credit card customer,
- **I want to** upload my BAM credit card PDF statement and have my expenses parsed locally,
- **So that** I can track my spending without relying on external LLM extraction services.
- **Split-Brain Boundary:** 100% Local (Dedicated module `src/lib/bam-parser.ts`).
- **Acceptance Criteria:**
  - [ ] References and supersedes draft story **US-020** ([`iteration_2/USER_STORIES_2.md`](./iteration_2/USER_STORIES_2.md)), specializing exclusively in BAM credit card statements.
  - [ ] Creates dedicated parser `src/lib/bam-parser.ts` exporting `extractBamTransactionsFromParser(parser, rawText)`.
  - [ ] Extracts transaction rows exclusively from BAM credit card statement layouts (Visa and Mastercard).
  - [ ] Accurately extracts transaction date, merchant concept, and debit amount.
  - [ ] Normalizes dates to `YYYY-MM-DD`.
  - [ ] Handles dual-currency statements (GTQ and USD), converting USD purchases to Quetzales at the active exchange rate and setting `originalCurrency: "USD"`.
  - [ ] Cleans and sanitizes concept strings, stripping authorization codes, terminal numbers, POS tokens, and address strings.
  - [ ] Excludes payments to the card (`PAGO DE TARJETA`, `PAGO ELECTRONICO BAM`, `ABONO A TARJETA`), rewards redemptions (Puntos BAM), credit adjustments, and financing reversals.
  - [ ] Discards non-transactional metadata, credit limit summaries (`Límite de Crédito`, `Saldo al Corte`, `Pago Mínimo`), cut-off dates (`Fecha de Corte`), and payment deadlines (`Fecha Límite de Pago`).
  - [ ] Outputs canonical `Transaction[]` tagged with `classificationSource: 'local'`.
  - [ ] Includes unit tests in `src/lib/bam-parser.test.ts` covering typical BAM credit card statement layouts and tabular formats.

---

## Phase 35: Multi-Bank Credit Card Ingestion End-to-End Integration & Regression Verification

### [ ] US-071: End-to-End Multi-Bank Credit Card Ingestion & Regression Verification
- **As a** user uploading credit card statements from any supported Guatemalan bank,
- **I want** the automatic bank detector and specialized credit card parsers to integrate seamlessly with the existing deduplication, expense classification, dashboard, and budget tools,
- **So that** the entire ingestion pipeline is reliable, accurate, and completely free of regressions.
- **Split-Brain Boundary:** 100% Local verification.
- **Acceptance Criteria:**
  - [ ] Credit card statements from Banco Industrial, Banco Cuscatlán, BAC Credomatic, FICOHSA, and Banco Agromercantil (BAM) are automatically identified and correctly parsed locally without requiring manual selection.
  - [ ] Verified bank names are passed cleanly to the dashboard header (displaying verified bank chips and strictly adhering to the no-pseudo-metadata rule).
  - [ ] Multi-file batch upload and incremental ingestion work seamlessly across multiple credit card statements from different banks in the same session.
  - [ ] Multi-currency extraction correctly converts foreign currency expenses to Quetzales across all 5 credit card parsers.
  - [ ] Deduplication engine detects repeated statements or overlapping billing periods from the same credit card.
  - [ ] Unrecognized statement formats smoothly transition to the local PII anonymization and review flow.
  - [ ] 100% of user-facing UI text, error messages, and bank indicators are in Spanish with zero emojis.
  - [ ] `npm test` passes all unit tests (including legacy checks, text list parser, and new credit card parser tests) with 0 failures.
  - [ ] `npm run build` succeeds with zero TypeScript and Next.js Turbopack build errors.

