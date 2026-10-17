# Architecture Description (for diagram)

Expense Tracker is a Next.js (App Router) app deployed on Vercel. It uses a **split-brain** design: parsing, anonymization, local classification, multi-currency conversion, batch deduplication, reporting and persistence run locally (browser or Next.js server code that never calls an external service). Only anonymized or aggregated structured data reaches Gemini.

## Actors
- **User** (Guatemala): uploads one or more bank statement PDFs or CSV files, reviews and corrects categories, filters by currency, reads the report and savings tips, manages session reset.

## Components

### 1. Browser (client, React 19 + Tailwind CSS 4)
- `src/app/page.tsx` - main client page. Holds all state, session continuity, and orchestrates the user flow.
- UI components: `file-upload`, `batch-upload-modal`, `batch-progress`, `column-mapping-modal`, `anonymization-modal`, `transaction-table`, `custom-category-modal`, `session-reset-modal`, `expense-dashboard`, `savings-suggestions`, `icons` (lucide-react).
- Local client-side logic (`src/lib`):
  - `file-validator` - detects PDF vs CSV and validates extensions/types.
  - `batch-processor` - queues and sequentially processes multi-file batch uploads.
  - `deduplication` - detects exact duplicate transactions across batch and existing session, discarding duplicates while preserving partial matches.
  - `currency` - formats Quetzales (GTQ / Q), handles USD-to-GTQ conversion with exchange rate metadata, and filters by currency.
  - `csv-parser` (PapaParse) - detects date/description/amount/currency columns, asks the user to map them if ambiguous.
  - `anonymizer` - regex redaction of name, address, account/IBAN, DPI, email, phone. The user previews the sanitized text before it is sent.
  - `expense-classifier` + `merchant-catalog.json` - local merchant-to-category matching across 11 Guatemalan categories, subscription detection (e.g. Netflix), unclassified threshold (default 10, configurable via `UNCLASSIFIED_EXPENSES_THRESHOLD`).
  - `reporting` - category totals, percentages, currency filtering, and comparisons.
  - `savings-advisor` (payload builder) - builds an aggregated payload with category totals and recurring services only.
  - `storage` - persists session state (`expense_tracker_session_v1`) and custom categories (`expense_tracker_categories_v1`), supporting session reset with category preservation.
- **Browser localStorage** - keys `expense_tracker_session_v1` and `expense_tracker_categories_v1`. There is no database and no authentication.

### 2. Next.js Server (Route Handlers on Vercel, Node.js, TypeScript)
- `GET /api/config` - returns runtime configuration including `unclassifiedExpensesThreshold` (default 10).
- `GET /api/exchange-rate` - returns the configured USD to GTQ exchange rate (default 7.85).
- `POST /api/parse-pdf` - local only, no external calls.
  - `pdf-parse` extracts the text.
  - `pdf-parser` detects the bank. Banco G&T Continental has a custom parser extracting both GTQ and USD transactions (converting USD to GTQ).
  - If the bank is supported, it returns structured transactions locally classified. Otherwise it returns the raw text and `isSupportedBank=false`, and the client runs anonymization.
- `POST /api/extract-transactions` - receives sanitized text. `validateSanitizedPayload` rejects any text with IBAN, account number, DPI or email. Calls Gemini and returns JSON transactions, which are then classified locally.
- `POST /api/classify-expenses` - called only when more than 10 transactions are still "Pendiente". `validateExpenseClassificationPayload` allows only id, description and amount. Calls Gemini.
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
7. Browser: local classification with expanded 11-category `merchant-catalog.json`.
8. Browser -> `/api/classify-expenses` (only if more than 10 pending): id, description, amount. Server -> Gemini -> categories.
9. Browser: user confirms or edits categories, adds custom categories. Dashboard renders the report, subscriptions, and currency indicators.
10. Browser -> `/api/suggest-savings`: aggregated data only. Server -> Gemini -> suggestions.
11. Browser <-> localStorage: session and custom categories saved and restored with continuity; reset modal offers soft reset or full factory reset.
12. Fallback: if Gemini is unreachable, locally classified expenses are still shown and the user classifies the rest manually.

## Privacy boundaries
- The PDF/CSV file is never sent to Gemini. Only structured, lightweight data is sent.
- PII (name, address, account, DPI, email, phone) is removed locally and re-validated server-side before each LLM call.
- The API key is used only in Route Handlers.

## Technologies
Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, lucide-react, PapaParse, pdf-parse, `@google/genai`, Node test runner with tsx, ESLint, npm, Vercel.
