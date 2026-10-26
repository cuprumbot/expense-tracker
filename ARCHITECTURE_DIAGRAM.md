# Architecture Description (for diagram)

Expense Tracker is a Next.js (App Router) app deployed on Vercel. It uses a **split-brain** design: parsing, anonymization, local classification, multi-currency conversion, batch deduplication, reporting and persistence run locally (browser or Next.js server code that never calls an external service). Only anonymized or aggregated structured data reaches Gemini.

## Actors
- **User** (Guatemala): uploads one or more bank statement PDFs or CSV files, reviews and corrects categories, filters by currency, navigates the 4-panel visual dashboard, inspects transactions in the sliding drawer, toggles light/dark themes, and manages session reset.

## Components

### 1. Browser (client, React 19 + Tailwind CSS 4)
- `src/app/page.tsx` - main client page. Holds state, session continuity, toast notifications, and orchestrates user flow directly to the dashboard.
- UI components: `dashboard-view`, `sliding-drawer`, `category-trend-chart`, `vendor-concentration-chart`, `consumption-patterns-chart`, `transaction-age-chart`, `theme-toggle`, `file-upload`, `batch-upload-modal`, `batch-progress`, `column-mapping-modal`, `anonymization-modal`, `transaction-table`, `custom-category-modal`, `session-reset-modal`, `icons` (lucide-react), `expense-dashboard` (@deprecated), `savings-suggestions` (@deprecated).
- Local client-side logic (`src/lib`):
  - `file-validator` - detects PDF vs CSV and validates extensions/types.
  - `batch-processor` - queues and sequentially processes multi-file batch uploads.
  - `deduplication` - detects exact duplicate transactions across batch and existing session, discarding duplicates while preserving partial matches.
  - `currency` - formats Quetzales (GTQ / Q), handles USD-to-GTQ conversion with exchange rate metadata, and filters by currency.
  - `csv-parser` (PapaParse) - detects date/description/amount/currency columns, asks the user to map them if ambiguous.
  - `anonymizer` - regex redaction of name, address, account/IBAN, DPI, email, phone. The user previews the sanitized text before it is sent.
  - `expense-classifier` + `merchant-catalog.json` - local merchant-to-category matching across 12 Guatemalan categories (including Visacuotas y Financiamiento), subscription detection (e.g. Netflix), unclassified threshold (default 10, configurable via `UNCLASSIFIED_EXPENSES_THRESHOLD`).
  - `reporting` - multi-month category time series with Bézier interpolation, top vendor normalization and dual sorting (spend/count), weekly/monthly consumption patterns with statistical outlier detection ($\mu + 1.75\sigma$), and 3-segment transaction age breakdown.
  - `savings-advisor` (payload builder) - builds an aggregated payload with category totals and recurring services only.
  - `storage` - persists session state (`expense_tracker_session_v1`) and custom categories (`expense_tracker_categories_v1`), supporting session reset with category preservation.
- **Browser localStorage** - keys `expense_tracker_session_v1`, `expense_tracker_categories_v1`, and `theme`. There is no database and no authentication.

### 2. Next.js Server (Route Handlers on Vercel, Node.js, TypeScript)
- `GET /api/config` - returns runtime configuration including `unclassifiedExpensesThreshold` (default 10).
- `GET /api/exchange-rate` - returns the configured USD to GTQ exchange rate (default 7.85).
- `POST /api/parse-pdf` - local only, no external calls.
  - `pdf-parse` extracts the text.
  - `pdf-parser` detects the bank and dispatches to specialized parsers (`gyt-parser` for Banco G&T Continental, `bi-parser` for Banco Industrial, `banrural-parser` for Banrural) extracting both GTQ and USD transactions (converting USD to GTQ).
  - If the bank is supported, it returns structured transactions locally classified. Otherwise it returns the raw text and `isSupportedBank=false`, and the client runs anonymization.
- `POST /api/extract-transactions` - receives sanitized text. `validateSanitizedPayload` rejects any text with IBAN, account number, DPI or email. Calls Gemini and returns JSON transactions, which are then classified locally.
- `POST /api/classify-expenses` - called in the background when more than 10 transactions remain "Pendiente". `validateExpenseClassificationPayload` allows only id, description and amount. Calls Gemini.
- `POST /api/suggest-savings` - `validateSavingsPayload` allows only aggregated category totals and recurring services. Calls Gemini.
- Shared server libs `llm-extractor`, `llm-classifier`, `savings-advisor` use the `@google/genai` SDK with model fallback: `GEMINI_MODEL` env var, then `gemini-3.8-flash`, then `gemini-2.5-flash`.

### 3. External cloud services
- **Google Gemini API** (Google AI Studio, `@google/genai`) - three jobs: extract transactions from an unsupported-bank statement, classify pending expenses, generate savings suggestions. Responses are structured JSON in Spanish.
- **Vercel** - hosting and deployment. `GEMINI_API_KEY` is stored as a server-side environment variable (`.env.local` locally) and is never exposed to the client.
- **GitHub** - version control (deliverable).

## Connections (data flows)
1. User -> Browser: uploads one or multiple PDF or CSV files.
2. Browser -> `batch-processor`: validates files and deduplicates against active session with `deduplication.ts`.
3. Browser -> `/api/parse-pdf` (HTTPS, multipart): PDF file. Response: transactions with currency metadata (supported bank) or raw text (unsupported bank).
4. Browser (CSV): parsed locally with `csv-parser`. Multi-currency detected and converted. No server call.
5. Browser -> Anonymizer (local) -> user confirms the sanitized text in `anonymization-modal`.
6. Browser -> `/api/extract-transactions` (HTTPS, JSON): sanitized text only. Server -> Gemini API (HTTPS): sanitized text. Gemini -> Server: JSON transactions.
7. Browser: local classification with expanded 12-category `merchant-catalog.json`.
8. Browser: proceeds directly to the 4-panel dashboard. If > 10 transactions remain pending, Gemini classifies in the background with an animated status chip in the header.
9. Browser: user inspects 4 visual SVG panels, interacts with category lines, vendor rankings, consumption histograms and donut chart.
10. Browser -> Sliding Drawer: user toggles off-canvas drawer to inspect the transaction table, edit records, filter by pending, or add custom categories.
11. Browser <-> localStorage: session, custom categories, and theme preference saved and restored with continuity; reset modal offers soft reset or full factory reset.
12. Fallback: if Gemini is unreachable, locally classified expenses are still shown and the user classifies the rest manually in the drawer.

## Privacy boundaries
- The PDF/CSV file is never sent to Gemini. Only structured, lightweight data is sent.
- PII (name, address, account, DPI, email, phone) is removed locally and re-validated server-side before each LLM call.
- The API key is used only in Route Handlers.

## Technologies
Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, lucide-react, PapaParse, pdf-parse, `@google/genai`, Playwright, Node test runner with tsx, ESLint, npm, Vercel.
