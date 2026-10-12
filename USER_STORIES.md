# User Stories: Personal Expense Tracker (Control de Gastos)

This document outlines the user stories, implementation phases, and testable acceptance criteria for the Personal Expense Tracker application. The implementation strictly adheres to the **Split-Brain Architecture** described in `SPEC.md`, `DESCRIPTION.md`, and `AGENTS.md`.

---

## Architecture Summary & Split-Brain Boundaries

- **Client / Local Engine (Client & Next.js Server without External LLM):**
  - Extract text and data from uploaded files (PDF and CSV).
  - Anonymize and redact Personally Identifiable Information (PII) such as customer name, address, account numbers, phone numbers, and NIT.
  - Parse supported bank statements (G&T Continental).
  - Normalize transactions into canonical JSON format.
  - Match known Guatemalan businesses to predefined categories using local rule-based tables.
  - Detect known recurring subscriptions.
  - Calculate expense totals, category aggregations, and local statistics.
  - Persist user data, custom categories, and adjustments in browser `localStorage`.
  - Provide complete manual fallbacks when offline or if external LLM services are unavailable.

- **Cloud Engine (Next.js Server-Side Route Handlers calling Google Gemini Pro via `@google/genai`):**
  - **Data Extraction for Unsupported Banks:** Receives only anonymized, user-confirmed raw statement text (never raw PII or unmodified binary files) and outputs structured transaction JSON.
  - **Category Classification for Unknown Expenses:** Receives only unclassified transaction descriptions and amounts when count exceeds threshold (> 5 items) and outputs assigned category IDs.
  - **Spending Reduction Advice:** Receives only aggregated category totals and high-level spending summaries (no raw PII or individual transaction lists) and returns practical recommendations in Spanish.

---

## Phase 1: Project Initialization & Technical Foundation

### [x] US-001: Project Setup and Tech Stack Initialization
- **As a** developer,
- **I want to** initialize the Next.js project with App Router, Tailwind CSS, TypeScript, and the `@google/genai` SDK,
- **So that** the project has a solid, standardized foundation following the team guidelines.
- **Split-Brain Boundary:** Local only (environment configuration for server route handlers).
- **Acceptance Criteria:**
  - [x] A Next.js project using App Router and TypeScript is initialized using `npm`.
  - [x] Tailwind CSS is configured and verified with base utilities.
  - [x] `@google/genai` SDK is installed as a dependency for server-side route handlers.
  - [x] Simple SVG icon system (e.g., Lucide React or standard SVG icons) is configured without emoji dependencies.
  - [x] Currency formatting utility for Guatemalan Quetzales (`GTQ` / `Q`) is created and unit-tested (`formatCurrency(amount)`).
  - [x] Environment variable configuration (`.env.example` and `.env.local`) includes `GEMINI_API_KEY`.
  - [x] Base layout and styling are set up with a clean, modern, responsive theme. All static boilerplate copy is in Spanish.

---

## Phase 2: File Ingestion & Local Parsing (Split-Brain Local Engine)

### [ ] US-002: File Upload Interface & Format Routing
- **As a** user,
- **I want to** upload my bank statement (single PDF) or a custom CSV file through a drag-and-drop or file picker interface,
- **So that** the application can begin processing my monthly expenses.
- **Split-Brain Boundary:** 100% Local (Client). No data is sent over the network during file selection.
- **Acceptance Criteria:**
  - [ ] The landing page presents a responsive file upload zone with clear Spanish labels ("Arrastra tu estado de cuenta en PDF o archivo CSV", "Seleccionar archivo").
  - [ ] Accepts `.pdf` and `.csv` file extensions; rejects unsupported formats with a user-friendly error message in Spanish.
  - [ ] Displays file metadata upon selection (file name, size, type).
  - [ ] Provides options to cancel or replace the uploaded file before processing.
  - [ ] Routes `.csv` uploads to the CSV parser (US-003) and `.pdf` uploads to the bank detection engine (US-004).

### [ ] US-003: Local CSV Parsing and Column Mapping
- **As a** user,
- **I want to** upload a CSV file containing my expenses and have the columns automatically detected or manually mapped,
- **So that** my transactions are normalized into a standard format without sending raw files to an external service.
- **Split-Brain Boundary:** 100% Local (Client / Local Server).
- **Acceptance Criteria:**
  - [ ] The system parses CSV content locally using a reliable parsing library (e.g., `papaparse`).
  - [ ] Automatically detects common column names for Date (`fecha`, `date`), Description (`descripcion`, `concepto`, `description`), and Amount (`monto`, `importe`, `debito`, `amount`).
  - [ ] If automatic detection is ambiguous, displays a column mapping modal in Spanish allowing the user to select the appropriate columns.
  - [ ] Normalizes amounts into numbers formatted in Quetzales (handles negative signs, debit/credit indicators, currency symbols `Q`, commas, and dots).
  - [ ] Outputs canonical transaction JSON: `Array<{ id: string, date: string, description: string, amount: number, currency: 'GTQ' }>`.
  - [ ] Discards empty rows, headers, and invalid records with summary validation feedback.

### [ ] US-004: Local PDF Text Extraction & G&T Continental Bank Parser
- **As a** user with a G&T Continental bank account,
- **I want to** upload my G&T Continental PDF statement and have it parsed locally,
- **So that** my expenses are extracted quickly and privately without querying an external LLM.
- **Split-Brain Boundary:** 100% Local (Local PDF parsing and regex extraction).
- **Acceptance Criteria:**
  - [ ] Extracts text content locally from the uploaded PDF using a standard library (e.g., `pdfjs-dist`).
  - [ ] Detects bank identity ("G&T Continental" / "Banco G&T Continental") from statement headers using local pattern matching.
  - [ ] If G&T Continental is identified, applies a dedicated local regex/tabular parser tailored to the bank statement layout.
  - [ ] Successfully extracts transaction date, description/merchant, and debit amounts into the canonical transaction JSON structure.
  - [ ] Filters out balance summaries, opening/closing balances, fee explanations, and non-expense lines.
  - [ ] If the PDF is not from G&T Continental, flags the file as an "unsupported bank" and transitions to the Anonymization Engine (US-005).

---

## Phase 3: Privacy, Anonymization & Unsupported Bank Extraction

### [ ] US-005: Local PII Anonymization and Preview Confirmation
- **As a** privacy-conscious user uploading a statement from an unsupported bank,
- **I want** all personal information (such as my name, address, account numbers, and NIT) to be redacted locally and shown to me for approval,
- **So that** no sensitive identity data is ever sent to an external LLM.
- **Split-Brain Boundary:** 100% Local. PII detection and redaction must happen entirely on the client before any network request to external APIs.
- **Acceptance Criteria:**
  - [ ] Local regex and rule-based sanitizer scans the extracted raw text to detect and replace sensitive data with placeholders:
    - User names -> `[NOMBRE_REDACTADO]`
    - Physical and mailing addresses -> `[DIRECCION_REDACTADA]`
    - Bank account and card numbers -> `[CUENTA_REDACTADA]`
    - Tax IDs (NIT, DPI) -> `[IDENTIFICACION_REDACTADA]`
    - Phone numbers and emails -> `[CONTACTO_REDACTADO]`
  - [ ] A preview modal in Spanish displays the sanitized text with highlighted redactions.
  - [ ] The user can review the redacted text, manually redact additional sensitive words if needed, and must click an explicit confirmation button ("Confirmar y procesar") before proceeding.
  - [ ] If the user cancels, no external request is made and the user can enter expenses manually or use a CSV.

### [ ] US-006: LLM-Assisted Transaction Extraction for Unsupported Banks
- **As a** user with an unsupported bank statement,
- **I want** the system to extract structured transaction data from the sanitized text using Gemini Pro,
- **So that** my statement is parsed accurately even without a pre-built bank parser.
- **Split-Brain Boundary:** Split-Brain Hybrid. Server Route Handler calls Gemini Pro with sanitized text only. API keys are kept secure on the server.
- **Acceptance Criteria:**
  - [ ] Next.js Server Route Handler (`POST /api/extract-transactions`) receives only the user-confirmed sanitized text.
  - [ ] Validates that no unredacted account numbers or raw identity markers are present in the payload.
  - [ ] Calls Google Gemini Pro using `@google/genai` with a structured prompt requesting strict JSON output matching the canonical schema:
    ```json
    [
      { "date": "YYYY-MM-DD", "description": "string", "amount": 0.00 }
    ]
    ```
  - [ ] System prompt instructs the model to return amounts in numbers and text in Spanish, extracting only debits/expenses.
  - [ ] Validates and parses the LLM JSON response on the server, assigning unique client IDs.
  - [ ] If the LLM request fails (network error, rate limit, invalid key), returns an informative Spanish error message with an option to enter transactions manually or upload CSV.

---

## Phase 4: Local Expense Classification & Merchant Directory

### [ ] US-007: Local Merchant Matching and Default Category Directory
- **As a** user,
- **I want** known Guatemalan businesses in my statement to be automatically categorized locally,
- **So that** expenses are categorized instantly without unnecessary LLM costs or data exposure.
- **Split-Brain Boundary:** 100% Local (Client / Local Server directory lookup).
- **Acceptance Criteria:**
  - [ ] A local merchant catalog is defined with popular Guatemalan businesses mapped to standard categories:
    - **Supermercado:** Paiz, La Torre, Walmart, Despensa Familiar, Suma.
    - **Restaurantes y Cafés:** Pollo Campero, San Martín, McDonald's, Starbucks, Wendy's, Taco Bell, Anafres.
    - **Servicios Básicos:** EEGSA, EMPAGUA, Claro, Tigo, Energuate.
    - **Transporte y Combustible:** Shell, Puma, Texaco, Uno, Uber, TuMuni (Parquímetros).
    - **Salud y Farmacia:** Farmacias Meykos, Farmacias Galeno, Farmacias Batres, Cruz Azul.
    - **Entretenimiento y Compras:** Cemaco, Siman, Miraflores, Oakland Mall, Pradera.
  - [ ] Matches transaction descriptions against the catalog using normalized, case-insensitive substring and fuzzy matching.
  - [ ] Categorized items are tagged with `classificationSource: 'local'`.
  - [ ] Unmatched items are tagged as `unclassified` with `category: null`.

### [ ] US-008: Local Recurring Subscription Detection
- **As a** user,
- **I want** recurring digital and service subscriptions to be identified locally,
- **So that** I am alerted to recurring charges that I might want to audit or cancel.
- **Split-Brain Boundary:** 100% Local rule-based identification.
- **Acceptance Criteria:**
  - [ ] A local subscription directory contains popular digital subscription services:
    - Netflix, Spotify, Disney+, Max (HBO), Amazon Prime, YouTube Premium, Apple Services/iCloud, Google One, ChatGPT/OpenAI, PlayStation Plus, Xbox Game Pass.
  - [ ] Transactions matching subscription patterns are flagged with `isSubscription: true` and assigned to category "Suscripciones".
  - [ ] Calculates the total monthly commitment represented by detected subscriptions.
  - [ ] Operates purely locally with zero LLM invocations.

---

## Phase 5: LLM-Assisted Expense Classification & Fallback

### [ ] US-009: Hybrid Classification Threshold & Gemini Pro Classification Route
- **As a** user,
- **I want** the system to classify remaining unknown transactions with Gemini Pro only when there are more than 5 unclassified expenses,
- **So that** LLM usage and API costs are minimized while maintaining high classification accuracy.
- **Split-Brain Boundary:** Split-Brain Hybrid. Local decision logic; Server Route Handler sends only descriptions and amounts to Gemini Pro.
- **Acceptance Criteria:**
  - [ ] Counts unclassified transactions from US-007.
  - [ ] If unclassified count is `<= 5` (configurable threshold), skips external LLM call and routes directly to User Confirmation (US-010) with items highlighted as unclassified.
  - [ ] If unclassified count is `> 5`, calls Next.js Server Route Handler (`POST /api/classify-expenses`).
  - [ ] Payload to LLM includes ONLY sanitized descriptions, amounts, and the list of available categories. No user identity or raw statement context is included.
  - [ ] Gemini Pro returns a JSON array mapping transaction IDs to existing categories or suggested new category names in Spanish.
  - [ ] Items classified by LLM are marked with `classificationSource: 'llm'`.
  - [ ] If the LLM call fails, the app gracefully falls back to showing items as unclassified for manual assignment without breaking the flow.

---

## Phase 6: User Review, Customization & Local Persistence

### [ ] US-010: Expense Review and Category Customization Interface
- **As a** user,
- **I want to** review the classified expenses, manually change categories, add new categories, and assign unclassified items,
- **So that** my expense report accurately reflects my personal spending habits.
- **Split-Brain Boundary:** 100% Local (Client).
- **Acceptance Criteria:**
  - [ ] Displays a complete tabular view of all transactions with Date, Description, Amount (in Q), Category, and Source badge (`Local`, `IA`, `Sin clasificar`).
  - [ ] Unclassified items are highlighted with a prominent visual badge prompting user action.
  - [ ] User can change the category of any transaction via a dropdown menu.
  - [ ] User can create a new custom category with a name and color code.
  - [ ] User can edit or delete individual transactions.
  - [ ] User can bulk-assign categories to multiple selected transactions.
  - [ ] All UI labels and actions are in Spanish ("Categoría", "Origen", "Editar", "Guardar", "Nueva categoría").

### [ ] US-011: Local Storage Persistence
- **As a** user,
- **I want** my processed expenses, custom categories, and preferences to be saved in my browser,
- **So that** I don't lose my data if I refresh the page or return later, without needing a backend database or user account.
- **Split-Brain Boundary:** 100% Local (`window.localStorage`).
- **Acceptance Criteria:**
  - [ ] Saves the normalized transaction list, active categories, and custom merchant rules to `localStorage` under a dedicated key namespace.
  - [ ] On page reload, detects existing local data and provides options to resume session or start fresh ("Nueva carga de estado de cuenta").
  - [ ] Includes a "Borrar mis datos" (Clear Data) button in Spanish that clears all stored records from `localStorage` upon confirmation.
  - [ ] Gracefully handles `localStorage` quotas and corrupted storage states with clean fallbacks.

---

## Phase 7: Financial Reporting & Subscription Alerts

### [ ] US-012: Expense Reporting Dashboard & Category Visualizations
- **As a** user,
- **I want to** view an interactive dashboard showing my total expenses and category breakdowns in Guatemalan Quetzales,
- **So that** I can understand where my money is going.
- **Split-Brain Boundary:** 100% Local calculation and visualization.
- **Acceptance Criteria:**
  - [ ] Displays aggregate monthly spending KPI card formatted in Quetzales (e.g., `Q 12,450.00`).
  - [ ] Displays category breakdown cards and charts (e.g., bar chart / percentage breakdown) using SVG/CSS or lightweight chart components.
  - [ ] Shows comparison across categories (amount spent, percentage of total spend).
  - [ ] Filters transactions by category and search term.
  - [ ] Design is responsive, modern, clean, and avoids excessive animations or emojis.

### [ ] US-013: Active Subscriptions Alert & Recurring Spend Panel
- **As a** user,
- **I want** to see a dedicated panel listing all detected subscriptions and their total monthly cost,
- **So that** I can evaluate whether I am paying for recurring services I no longer use.
- **Split-Brain Boundary:** 100% Local computation based on subscription tags.
- **Acceptance Criteria:**
  - [ ] Displays an alert banner and card section: "Suscripciones Detectadas".
  - [ ] Lists each identified subscription with merchant name, date charged, and amount in Quetzales.
  - [ ] Displays total monthly subscription spend in Quetzales (e.g., `Total en suscripciones: Q 350.00`).
  - [ ] Includes an informational badge reminding the user to check if any subscription is unused.
  - [ ] Allows the user to toggle subscription status on or off for any transaction.

---

## Phase 8: AI-Powered Spending Reduction Insights

### [ ] US-014: Gemini-Powered Spending Reduction Suggestions
- **As a** user,
- **I want to** receive personalized suggestions on how to reduce my monthly expenses,
- **So that** I can make concrete adjustments to save money based on my Guatemalan spending context.
- **Split-Brain Boundary:** Split-Brain Hybrid. Server Route Handler sends only aggregated category totals and high-level summaries to Gemini Pro.
- **Acceptance Criteria:**
  - [ ] Next.js Server Route Handler (`POST /api/suggest-savings`) receives ONLY aggregated data:
    - Total monthly spend.
    - Category name, total amount, and percentage of budget.
    - Total subscription spend and subscription count.
    - Zero transaction descriptions, zero bank details, zero PII.
  - [ ] Calls Gemini Pro via `@google/genai` with a prompt requesting practical, realistic savings advice tailored to Guatemala in Spanish.
  - [ ] Returns structured recommendations:
    - Immediate savings opportunities (e.g., audit subscriptions, dining out adjustments).
    - Long-term budgeting suggestions.
    - Benchmark comparisons for high spending categories.
  - [ ] UI displays suggestions in clean, scannable cards with SVG icons and Spanish headings.
  - [ ] Provides a refresh/regenerate button with loading state.

---

## Phase 9: Resilience, Offline Fallback & Quality Assurance

### [ ] US-015: Offline Resilience & LLM Graceful Degradation
- **As a** user,
- **I want** the application to remain functional even if external LLM services fail or if there is no internet connection,
- **So that** I can always parse supported statements, classify known expenses, and view my financial report.
- **Split-Brain Boundary:** Enforces Split-Brain Resilience.
- **Acceptance Criteria:**
  - [ ] When Gemini API key is missing or invalid, the app displays a non-blocking banner ("Modo Local Activo") in Spanish.
  - [ ] G&T Continental PDF statements and CSV files parse and categorize successfully using only local logic.
  - [ ] Unclassified expenses prompt manual classification in US-010 without throwing unhandled exceptions.
  - [ ] The dashboard and subscription alerts function completely in offline/local mode.
  - [ ] The AI suggestions card displays a helpful fallback message ("Sugerencias no disponibles sin conexión con el asistente de IA") instead of a broken UI.

### [ ] US-016: UI Polishing, Accessibility & Localization Compliance Audit
- **As a** user,
- **I want** an intuitive, accessible, and polished user interface compliant with all style rules,
- **So that** the experience feels professional, trustworthy, and pleasant.
- **Split-Brain Boundary:** 100% Local (UI & Presentation).
- **Acceptance Criteria:**
  - [ ] 100% of user-facing UI labels, buttons, tooltips, and validation messages are in Spanish.
  - [ ] All monetary values are consistently formatted with `Q` or `GTQ` and proper comma/period decimal separators.
  - [ ] Uses standard Tailwind CSS classes with clean responsive layouts (mobile, tablet, desktop).
  - [ ] No emojis are used in the interface; all icons are simple SVG icons.
  - [ ] Subtle, modern transitions without excessive animations.
  - [ ] Semantic HTML and accessible color contrast ratios throughout all pages.
