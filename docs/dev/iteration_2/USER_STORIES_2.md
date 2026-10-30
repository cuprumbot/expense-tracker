# User Stories: Personal Expense Tracker (Control de Gastos) - Iteration 2

This document outlines the user stories, implementation phases, and testable acceptance criteria for the **Second Iteration** of the Personal Expense Tracker application. It focuses specifically on the **Core Improvements** and **Quality of Life** subsections defined in `SPEC.md`, strictly following the **Split-Brain Architecture** described in `SPEC.md`, `DESCRIPTION.md`, and `AGENTS.md`.

> [!NOTE]
> Stories for the **Product Improvements** subsection (Dashboard visualizations, trend line charts, category pie charts, and sliding transaction panels) are omitted from this document as they are currently being drafted and will be generated at a later time.

---

## Architecture Summary & Split-Brain Boundaries (Iteration 2)

- **Client / Local Engine (Client & Next.js Server without External LLM):**
  - **Multi-Bank Ingestion:** Custom rule-based parsers for Banco Industrial, Banco Agromercantil (BAM), and Banrural, alongside existing Banco G&T Continental support.
  - **Multi-Currency & Conversion:** Detection of foreign currency ($ / USD) charges, with automated local conversion to Guatemalan Quetzales (GTQ) using a server-configurable exchange rate (default: `USD 1.00 = GTQ 7.85`).
  - **Multi-File Batch & Incremental Ingestion:** Ingest multiple bank statements simultaneously or sequentially into the active session without loss of existing state.
  - **Deduplication Engine:** Automatic detection and discarding of duplicate transactions matching date, normalized description, and amount, accompanied by user-facing notification banners.
  - **Expanded Local Merchant Catalog:** Substantially increased local business keyword catalog covering popular Guatemalan commerce across all categories.
  - **Higher Unclassified Threshold:** Local threshold raised from 5 to 10 unclassified transactions before proposing LLM classification.
  - **Session Continuity:** Persistence of consolidated transactions across incremental uploads with explicit manual session reset controls.

- **Cloud Engine (Next.js Server-Side Route Handlers calling Google Gemini Pro via `@google/genai`):**
  - **Unsupported Bank Statement Extraction:** Fallback for banks not yet supported by custom local parsers (utilizing user-approved sanitized text only).
  - **LLM Classification:** Executed only when unclassified transactions exceed the updated threshold (`> 10`).
  - **Spending Reduction Advice:** Generated on-demand using aggregated category totals.

---

## Phase 10: Multi-Bank Parsing Engine (Core Improvements)

### [ ] US-017: Multi-Bank Identification & Parser Dispatcher
> [!NOTE]
> **Superseded in Iteration 4:** Replaced and updated by **US-065: Multi-Bank Identification & Automatic Bank Selection for Credit Card Statements** in [`USER_STORIES_4.md`](../USER_STORIES_4.md). Scope has transitioned from general bank accounts to dedicated credit card statements for Banco Industrial, Banco Cuscatlán, BAC Credomatic, FICOHSA, and Banco Agromercantil (BAM).
- **As a** user uploading a bank statement in PDF format,
- **I want** the system to automatically recognize whether my statement is from Banco Industrial, Banco Agromercantil (BAM), Banrural, or Banco G&T Continental,
- **So that** the document is parsed using a specialized local parser without routing to the LLM extraction pipeline.
- **Split-Brain Boundary:** 100% Local (Client / Server text detection and routing).
- **Acceptance Criteria:**
  - [x] Analyzes extracted PDF text headers, metadata, URLs, and identifying institution keywords to detect the originating bank:
    - **Banco Industrial:** `Banco Industrial`, `Bi en Línea`, `Corporación Bi`, `bi.com.gt`.
    - **Banco Agromercantil (BAM):** `Banco Agromercantil`, `BAM`, `bam.com.gt`.
    - **Banrural:** `Banrural`, `Banco de Desarrollo Rural`, `banrural.com.gt`.
    - **Banco G&T Continental:** `G&T Continental`, `Banco G&T Continental`, `gtc.com.gt`.
  - [ ] Dispatches the document to the corresponding specialized parser (`parseBiStatement` [x], `parseBamStatement` [US-020], `parseBanruralStatement` [x], `parseGyTStatement` [x]).
  - [x] Attaches the identified bank name to the parsing result metadata (`bankName: string`).
  - [x] If no supported bank layout matches, flags the document as an "unsupported bank" and smoothly transitions to the Local PII Anonymization and Preview flow (US-005).
  - [x] Bank detection executes 100% locally with zero network requests or LLM invocations.

### [x] US-018: Banco Industrial (BI) Local PDF Statement Parser
> [!NOTE]
> **Superseded in Iteration 4:** The checking account (cuentas monetarias/ahorro) parsing logic has been deprecated and removed (see **US-064** in [`USER_STORIES_4.md`](../USER_STORIES_4.md)). Credit card statement parsing for Banco Industrial is now exclusively handled by **US-066: Banco Industrial (BI) Credit Card Statement PDF Parser** in [`USER_STORIES_4.md`](../USER_STORIES_4.md).
- **As a** Banco Industrial customer,
- **I want to** upload my BI bank statement or credit card PDF and have my debit expenses extracted locally,
- **So that** my transactions are parsed quickly, accurately, and with complete privacy.
- **Split-Brain Boundary:** 100% Local (Local PDF text extraction and regex parsing).
- **Acceptance Criteria:**
  - [x] Extracts transactions from both Banco Industrial deposit/monetario statements and Bi Credit card statements (Visa / Mastercard).
  - [x] Extracts transaction dates and normalizes them to ISO format `YYYY-MM-DD`.
  - [x] Cleans and normalizes merchant descriptions, removing terminal codes, internal POS identifiers, and location tokens (e.g., `\GUATEMALA GTM`, `POS BI`).
  - [x] Accurately extracts debit amounts, handling thousand-separator commas and decimal formats.
  - [x] Distinguishes debit expenses from payments, credit refunds, interest payments, and transfers between own accounts.
  - [x] Discards non-transactional statement rows (saldo anterior, saldo corte, saldo al corte, pago mínimo, crédito disponible, resúmenes de cargos).
  - [x] Outputs canonical `Transaction[]` tagged with `classificationSource: 'local'`.
  - [x] Includes unit tests with simulated Banco Industrial statement text fixtures covering single-page and multi-page statements.

### [x] US-019: Banrural Local PDF Statement Parser
> [!NOTE]
> **Deprecated in Iteration 4:** Banrural checking account parser is deprecated and removed (see **US-064** in [`USER_STORIES_4.md`](../USER_STORIES_4.md)) as the application scope focuses exclusively on credit card statements. Banrural does not have a credit card parser in the current iteration.
- **As a** Banrural customer,
- **I want to** upload my Banrural statement PDF and have my expenses extracted locally,
- **So that** my financial data is processed securely without exposing sensitive banking records.
- **Split-Brain Boundary:** 100% Local (Local PDF text extraction and regex parsing).
- **Acceptance Criteria:**
  - [x] Extracts transactions from Banrural account statements (cuentas monetarias / ahorro) and Banrural credit card statements.
  - [x] Correctly parses transaction date, merchant/concept description, and transaction amount.
  - [x] Filters out non-expense records (depósitos, remesas familiares, créditos por intereses, transferencias entrantes, pagos a tarjeta).
  - [x] Ignores bank header tables, agency details, summary lines (`Saldo Inicial`, `Saldo Final`, `Total Débitos`, `Total Créditos`), and legal footers.
  - [x] Normalizes transaction concept strings into clean Spanish descriptions.
  - [x] Generates canonical `Transaction[]` with unique IDs, normalized dates, and `classificationSource: 'local'`.
  - [x] Includes unit tests covering representative Banrural statement layouts and edge cases.

### [ ] US-020: Banco Agromercantil (BAM) Local PDF Statement Parser
> [!NOTE]
> **Superseded in Iteration 4:** Replaced and specialized exclusively for credit card statements by **US-070: Banco Agromercantil (BAM) Credit Card Statement PDF Parser** in [`USER_STORIES_4.md`](../USER_STORIES_4.md).
- **As a** Banco Agromercantil (BAM) customer,
- **I want to** upload my BAM statement PDF and have my expenses parsed locally,
- **So that** I can analyze my spending without relying on external LLM extraction services.
- **Split-Brain Boundary:** 100% Local (Local PDF text extraction and regex parsing).
- **Acceptance Criteria:**
  - [ ] Extracts transactions from BAM account statements and BAM credit card statement layouts.
  - [ ] Identifies consumption date, merchant concept, and debit amount.
  - [ ] Excludes payments to the card/account, credit adjustments, rewards redemptions, and financing fees.
  - [ ] Excludes non-transactional metadata, account numbers, cut-off dates (`fecha de corte`), and payment deadlines (`fecha límite de pago`).
  - [ ] Cleans and sanitizes concept strings to standardized merchant descriptions.
  - [ ] Outputs canonical `Transaction[]` tagged with `classificationSource: 'local'`.
  - [ ] Includes unit tests covering typical BAM statement formats and tabular layouts.

---

## Phase 11: Foreign Currency (USD) Handling & Exchange Rate Engine (Core Improvements)

### [x] US-021: Server-Configurable USD-to-GTQ Exchange Rate Service
- **As a** system administrator and developer,
- **I want** a dedicated exchange rate service that converts USD transactions to Quetzales at a default rate of 7.85 and supports server environment configuration,
- **So that** all currency conversions are uniform, accurate, and easily updated without modifying code.
- **Split-Brain Boundary:** Local only (Server / Client utility module).
- **Acceptance Criteria:**
  - [x] An exchange rate service module (`src/lib/currency.ts`) provides a utility function `convertUsdToGtq(amountInUsd: number, customRate?: number): number`.
  - [x] Default exchange rate is set to `USD 1.00 = GTQ 7.85`.
  - [x] Reads the exchange rate from the server environment variable `USD_GTQ_EXCHANGE_RATE`, falling back to `7.85` if unset or invalid.
  - [x] Converts amounts accurately and rounds the resulting Quetzales value to 2 decimal places.
  - [x] Provides an endpoint or server helper `getExchangeRate(): number` to supply the active exchange rate to the client.
  - [x] Unit tests verify currency conversions, edge cases (zero, negative numbers, extreme values), and fallback defaults.

### [x] US-022: Multi-Currency Extraction in Bank Parsers & Data Model Extension
- **As a** user with expenses billed in US Dollars ($ / USD),
- **I want** statement parsers to capture dollar transactions, convert their amounts to Quetzales, and preserve original currency details,
- **So that** my foreign currency and online purchases are seamlessly included in my total expense calculations.
- **Split-Brain Boundary:** 100% Local (Local extraction and immediate conversion).
- **Acceptance Criteria:**
  - [x] The `Transaction` interface in `src/types/transaction.ts` is extended with multi-currency fields:
    ```typescript
    originalCurrency?: "GTQ" | "USD";
    originalAmount?: number;
    exchangeRateApplied?: number;
    ```
  - [x] Updates the G&T Continental parser (which previously discarded lines containing `$`) to parse dollar expense lines, convert their amounts to Quetzales, and assign `originalCurrency: "USD"`, `originalAmount`, and `exchangeRateApplied`.
  - [x] Multi-currency architecture is established across bank parsers and data models to identify both Quetzales (`Q`) and Dollars (`$`) and apply the conversion.
  - [x] CSV parser detects dollar currency markers (`$`, `USD`, `DOLARES`) in currency columns or amount strings, converting amounts to Quetzales while recording original currency metadata.
  - [x] The canonical `amount` field always stores the converted amount in Guatemalan Quetzales (`currency: "GTQ"`) so all aggregations, charts, and budget totals remain unified.
  - [x] Unit tests verify multi-currency extraction and conversion for all bank parsers and CSV inputs.

### [x] US-023: Original Currency Indicator in Expense Review & Transaction Table
- **As a** user reviewing my expense list,
- **I want to** see a clear visual indicator for transactions that were originally billed in US Dollars,
- **So that** I can distinguish foreign currency purchases while all calculations and totals remain in Quetzales.
- **Split-Brain Boundary:** 100% Local (UI & Presentation).
- **Acceptance Criteria:**
  - [x] The transaction table displays an original currency badge (e.g., a subtle `USD` pill badge with an SVG globe or currency icon) next to the amount for dollar-converted transactions.
  - [x] Quetzales transactions display standard formatting without visual clutter.
  - [x] Hovering over or tapping the `USD` badge reveals a tooltip showing the original amount and the applied exchange rate in Spanish (e.g., `Monto original: $25.00 USD | Tipo de cambio: Q 7.85`).
  - [x] All table totals, summary cards, and category sums strictly calculate and display in Guatemalan Quetzales (`Q`).
  - [x] Filter options in the transaction table allow filtering by currency: "Todas", "Solo Quetzales (GTQ)", and "Solo Dólares (USD)".
  - [x] UI labels and tooltips are 100% in Spanish, with no emojis used.

---

## Phase 12: Expanded Local Merchant Catalog & Hybrid Threshold Optimization (Core Improvements)

### [x] US-024: Expanded Guatemalan Merchant Directory & Category Matching
- **As a** user,
- **I want** a broader variety of popular Guatemalan businesses, supermarkets, restaurants, and local services to be recognized automatically,
- **So that** the vast majority of my expenses are categorized locally without calling external LLM APIs.
- **Split-Brain Boundary:** 100% Local rule-based catalog matching.
- **Acceptance Criteria:**
  - [x] There are enough categories to cover most common types of expenses.
  - [x] Significantly expands `src/data/merchant-catalog.json` with an extensive directory of Guatemalan businesses.

### [x] US-025: Unclassified Expenses Threshold Increase & Pipeline Tuning
- **As a** system architect,
- **I want** the threshold for triggering Gemini Pro expense classification raised from 5 to 10 unclassified expenses,
- **So that** external LLM calls are minimized and reserved only for statements with substantial unrecognized volume.
- **Split-Brain Boundary:** Split-Brain Hybrid Decision Logic.
- **Acceptance Criteria:**
  - [x] Updates the default threshold in `src/data/merchant-catalog.json` (`unclassifiedThreshold: 10`).
  - [x] Updates `UNCLASSIFIED_THRESHOLD` export in `src/lib/expense-classifier.ts` to `10`.
  - [x] The classification pipeline evaluates:
    - If unclassified expenses count is `<= 10`, bypasses LLM classification and routes directly to User Confirmation (US-010).
    - If unclassified expenses count is `> 10`, sends only the unclassified items to `POST /api/classify-expenses`.
  - [x] Unclassified expenses under or equal to 10 are prominently badged in the UI as "Pendiente" with a prompt encouraging quick manual assignment.
  - [x] Unit and integration tests verify that exactly 10 unclassified items bypass the LLM, while 11 items trigger the classification route.

---

## Phase 13: Multi-File Ingestion, Session Continuity & Deduplication (Quality of Life)

### [x] US-026: Multi-File Upload Interface & Batch Ingestion
- **As a** user with multiple bank accounts or statements across several months,
- **I want to** select and upload multiple PDF and CSV files at the same time or add more files to an active session,
- **So that** I can consolidate all my monthly expenses into a single consolidated financial review.
- **Split-Brain Boundary:** 100% Local (Client-side file ingestion and parsing queue).
- **Acceptance Criteria:**
  - [x] File upload component accepts multiple file selection (`<input type="file" multiple ...>`) and multiple simultaneous drag-and-drop files.
  - [x] Supports simultaneous ingestion of mixed formats (e.g., uploading a G&T PDF, a BI PDF, a Banrural PDF, and a CSV in the same action).
  - [x] An "Agregar más estados de cuenta" (Add more bank statements) action button is accessible from the transaction review and dashboard views to ingest additional files into the current session.
  - [x] Displays a file processing progress indicator showing each file's parsing status (e.g., "Procesando estado_cuenta_bi.pdf...", "Procesando estado_cuenta_gyt.pdf...", "Completado").
  - [x] Summarizes the batch upload outcome in Spanish (e.g., "3 archivos procesados exitosamente, 45 transacciones añadidas").
  - [x] If an individual file fails to parse, it displays a specific error message for that file while successfully processing the valid files.

### [x] US-027: Session State Continuity and Explicit Session Reset
- **As a** user building up my expense records across multiple uploads,
- **I want** each newly uploaded statement to append to my existing session without erasing my current data or custom edits,
- **So that** I only reset my session when I explicitly choose to do so.
- **Split-Brain Boundary:** 100% Local (Client state and `localStorage` persistence).
- **Acceptance Criteria:**
  - [x] Incoming transactions from newly uploaded files are merged and appended to the existing transaction list in application state and `localStorage`.
  - [x] User customizations (manual category reassignments, custom categories created, subscription toggles) are preserved intact when new files are appended.
  - [x] A dedicated "Reiniciar sesión" (Reset Session) button is clearly visible in the header/navigation bar.
  - [x] Clicking "Reiniciar sesión" opens a confirmation modal in Spanish:
    "¿Deseas reiniciar la sesión? Se eliminarán las transacciones cargadas en esta sesión. Las categorías personalizadas se conservarán."
  - [x] Upon confirmation, clears the session transaction list from memory and `localStorage`, returning the user to the initial upload screen.
  - [x] Provides an optional checkbox in the reset modal to also wipe custom categories if a complete factory reset is desired.

### [x] US-028: Duplicate Transaction Detection, Discarding & User Notification
- **As a** user who may accidentally upload the same bank statement twice or upload overlapping date statements,
- **I want** the system to detect identical transactions, automatically discard duplicates, and notify me with a warning banner,
- **So that** my expense totals and financial summaries are never artificially inflated by duplicate charges.
- **Split-Brain Boundary:** 100% Local (Deduplication algorithm executed client-side).
- **Acceptance Criteria:**
  - [x] Implements a duplicate detection algorithm comparing incoming transactions against existing transactions and against other items in the current batch.
  - [x] Identifies a duplicate when all three core fields match identically:
    - Normalized Date (`date` in `YYYY-MM-DD`).
    - Normalized Description (`description` case-insensitive, punctuation-stripped).
    - Amount (`amount` in Quetzales).
  - [x] Automatically discards detected duplicates, preventing them from being added to the active transaction list.
  - [x] Displays a prominent, user-friendly alert banner in Spanish when duplicates are discarded:
    - Example: "Se detectaron y descartaron 14 transacciones repetidas. Es posible que hayas subido un estado de cuenta duplicado."
  - [x] If 100% of the transactions in a newly uploaded file are duplicates, presents a clear notification:
    "Todas las transacciones del archivo 'estado_cuenta_copia.pdf' ya se encontraban registradas y fueron omitidas."
  - [x] Discarded duplicates are completely excluded from total spending KPIs, category totals, and subscription aggregations.
  - [x] Includes comprehensive unit tests verifying deduplication across multi-file uploads and sequential appends.
