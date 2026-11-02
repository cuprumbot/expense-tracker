# Product Evaluation Survey: Proposed User Questions

This document outlines 10 survey questions designed for potential users of **Expense Tracker**.

---

## 1. Context and Objective

- **Target Audience:** Financially conscious individuals living in Guatemala who want to monitor their cash flow, reduce unnecessary spending, control installment commitments (such as Visacuotas), and build sustainable budgeting habits.
- **Audience Background:** Everyday consumers (tech background is irrelevant). Questions avoid all technical jargon (e.g., no mentions of LLMs, APIs, local parsers, databases, or client-server architectures).
- **Core Product Focus:** User experience (UI/UX), visual clarity of financial insights, comfort with the onboarding and data input flow, practical utility of the 4-panel analytical dashboard, interaction with the sliding transaction drawer, and the effectiveness of the budgeting and coaching system.
- **Language Convention:** The survey documentation is structured in English per repository standards, while the survey questions and response options are provided in native Guatemalan Spanish (with English translations) so they can be directly administered to respondents.

---

## 2. Survey Questions

### Question 1: Onboarding & Data Entry Experience
* **Focus Area:** Document ingestion, upload options, and initial friction.
* **Question (Spanish):**
  > "¿Qué tan fácil y rápido te resultó cargar tus movimientos (ya sea arrastrando tu estado de cuenta en PDF o escribiendo tus compras en la lista rápida)?"
* **Question (English Translation):**
  > "How easy and quick was it to load your transactions (whether by dragging your bank statement PDF or typing your purchases into the quick text list)?"
* **Response Format:** 5-Point Likert Scale (1: *Muy difícil y confuso* – 5: *Muy fácil y rápido*) + Optional comment box (*"¿Qué dificultades o dudas tuviste al cargar tus datos?"*).
* **Feature & UI/UX Evaluated:**
  - Drag-and-drop file upload zone.
  - Multi-file batch processing.
  - "Lista rápida" (simple text list modal for pasting or typing informal notes like `"Super 24 50"` or `"Gasolina 100"`).
* **Product Rationale:** Data entry is the primary barrier to entry for any personal finance tool. If users feel intimidated or encounter friction when uploading their statements or entering daily cash expenses, they will drop off before experiencing the dashboard's core value.

---

### Question 2: First Impressions & Dashboard Visual Clarity
* **Focus Area:** Cognitive load, visual hierarchy, and dashboard comprehension.
* **Question (Spanish):**
  > "Al ver por primera vez el tablero principal con los cuatro paneles, ¿qué tan claro y comprensible te resultó entender en qué estás gastando tu dinero en Quetzales?"
* **Question (English Translation):**
  > "When looking at the main dashboard with the four panels for the first time, how clear and understandable was it to grasp where your money in Quetzales is going?"
* **Response Format:** 5-Point Likert Scale (1: *Totalmente confuso / Sobrecargado* – 5: *Muy claro y fácil de interpretar*) + Short comment.
* **Feature & UI/UX Evaluated:**
  - High-level 4-panel dashboard layout (Histórico por categoría, ¿A dónde va mi dinero?, Patrones de consumo, Antigüedad del gasto).
  - High-contrast visual cards, summary metrics in Quetzales (Q), and clean, distraction-free headers.
* **Product Rationale:** Validates whether presenting four focused charts simultaneously delivers immediate financial clarity or creates visual overwhelm for non-technical users.

---

### Question 3: Discovering Spending Leaks & Top Merchants
* **Focus Area:** Merchant concentration and purchasing behavior insights.
* **Question (Spanish):**
  > "En el gráfico de '¿A dónde va mi dinero?', ¿descubriste negocios o compras frecuentes donde estás gastando más de lo que imaginabas?"
* **Question (English Translation):**
  > "In the 'Where is my money going?' chart, did you discover merchants or frequent purchases where you are spending more than you imagined?"
* **Response Format:** Single Choice with follow-up:
  - *Sí, descubrí gastos hormiga o comercios donde gasto más de lo que creía.*
  - *Identifiqué mis gastos habituales, pero me ayudó a ver el monto acumulado.*
  - *No, ya tenía total certeza de dónde gasto mi dinero.*
  - Open field: *"¿Qué comercio o tipo de gasto te sorprendió más ver en la lista?"*
* **Feature & UI/UX Evaluated:**
  - Vendor Concentration bar chart (`¿A dónde va mi dinero?`).
  - Toggle between total money spent (`Mayor monto gastado`) vs frequency of visits (`Mayor cantidad de compras`).
  - Ability to dismiss/hide regular fixed vendors to reveal smaller, hidden discretionary expenses.
* **Product Rationale:** Evaluates the product's primary "Aha!" moment—helping users unmask spending leaks, high-frequency low-ticket expenses, and identify where their money actually drains each month.

---

### Question 4: Payday Spikes & Timing Habits
* **Focus Area:** Consumption patterns over time and outlier detection.
* **Question (Spanish):**
  > "¿El gráfico de 'Patrones de consumo' te ayudó a identificar días específicos (como fines de semana o quincenas) en los que tiendes a gastar de forma impulsiva o por encima de tu promedio?"
* **Question (English Translation):**
  > "Did the 'Consumption patterns' chart help you identify specific days (such as weekends or paydays) when you tend to spend impulsively or above your average?"
* **Response Format:** 5-Point Likert Scale (1: *No me aportó información útil* – 5: *Me ayudó notablemente a ver cuándo gasto de más*) + Text feedback.
* **Feature & UI/UX Evaluated:**
  - Consumption Patterns chart (`Día de la semana` vs `Día del mes`).
  - Automatic visual alerts for statistical outliers (unusually high single-day spending).
* **Product Rationale:** Personal finance awareness is closely tied to timing habits (such as payday splurges or weekend restaurant spikes). This question verifies if users find the calendar breakdown actionable for planning upcoming cash outflows.

---

### Question 5: Future Debt & Installment Awareness
* **Focus Area:** Financial commitments, recurring charges, and debt transparency.
* **Question (Spanish):**
  > "¿Qué tan útil te parece ver tus gastos divididos entre compras inmediatas del mes, suscripciones recurrentes y pagos en cuotas (Visacuotas / financiamiento)?"
* **Question (English Translation):**
  > "How useful is it to see your spending split between immediate monthly purchases, recurring subscriptions, and installment payments (Visacuotas / financing)?"
* **Response Format:** 5-Point Likert Scale (1: *Nada útil* – 5: *Extremadamente útil para no endeudarme de más*).
* **Feature & UI/UX Evaluated:**
  - Transaction Age donut chart (`Antigüedad del gasto`).
  - Separation of Visacuotas/Mastercuotas, subscriptions (e.g., streaming, recurring gym fees), and immediate purchases.
* **Product Rationale:** In Guatemala, Visacuotas and recurring subscriptions are major culprits for unperceived debt accumulation. Testing whether users grasp this segmentation confirms if the app successfully helps them differentiate past debt obligations from current discretionary choices.

---

### Question 6: Interactive Drill-Down Navigation
* **Focus Area:** Micro-interactions, detailed exploration, and usability.
* **Question (Spanish):**
  > "Al hacer clic en una barra o punto de los gráficos para abrir el panel lateral y ver el detalle de tus compras, ¿la navegación te pareció natural e intuitiva?"
* **Question (English Translation):**
  > "When clicking on a chart bar or data point to open the sliding side panel and inspect your exact purchases, did the navigation feel natural and intuitive?"
* **Response Format:** 5-Point Likert Scale (1: *Muy confusa o difícil de encontrar* – 5: *Muy fluida y conveniente*) + Optional comment (*"¿Qué sentiste al usar el panel lateral deslizable?"*).
* **Feature & UI/UX Evaluated:**
  - Sliding Drawer component.
  - Interactive chart click events (cross-filtering by category, date, or merchant).
  - In-place transaction search, category re-assignment, and quick edits without leaving the visual dashboard.
* **Product Rationale:** Verifies the user journey when transitioning from macro data (charts) to micro data (individual receipts/transactions). A clunky drawer or hidden interaction would impede exploratory data verification.

---

### Question 7: Budget Setup & Realistic Target Generation
* **Focus Area:** Budget onboarding, automation vs control, and goal setting.
* **Question (Spanish):**
  > "Al crear tu presupuesto, ¿qué método te resultó más cómodo y motivador: que la app te sugiriera automáticamente metas realistas basadas en tus gastos pasados, o armarlo tú mismo desde cero con las categorías sugeridas?"
* **Question (English Translation):**
  > "When creating your budget, which method felt more comfortable and motivating: having the app automatically suggest realistic goals based on your past spending, or building it yourself from scratch with suggested categories?"
* **Response Format:** Multiple Choice:
  - *Preferí el generador automático: me ahorró tiempo y propuso metas alcanzables.*
  - *Preferí armarlo desde cero: me gusta tener control manual exacto sobre cada categoría.*
  - *Utilicé una combinación: generé la sugerencia automática y luego ajusté montos con los botones rápidos.*
  - *No me quedó claro cómo empezar o qué montos colocar.*
* **Feature & UI/UX Evaluated:**
  - Budgeting Tool: "Crear desde cero" (tier presets like Categorías principales, Esenciales, Todas; micro-adjust buttons `+Q 50`, `+Q 100`, `-Q 50`).
  - Budgeting Tool: "Generar presupuesto realista" (historical averaging, 95% essential, 85% discretionary, clean round figures in Quetzales).
* **Product Rationale:** Unrealistic budgets lead to early abandonment. This question uncovers user preference between automated guidance vs full manual control, validating whether the realistic generator's assumptions resonate with actual budgeting habits.

---

### Question 8: Root-Cause Explanations for Overspending
* **Focus Area:** Financial diagnostics, intelligent coaching, and perceived accuracy.
* **Question (Spanish):**
  > "Cuando te pasas de tu presupuesto en una categoría, la app te explica el motivo (por ejemplo, si se debió a una sola compra grande, a muchas compras pequeñas o a gastos concentrados en pocos días). ¿Qué tan acertada y constructiva sentiste esta explicación?"
* **Question (English Translation):**
  > "When you exceed your budget in a category, the app explains the reason (for example, whether it was due to a single large purchase, many small purchases, or expenses concentrated across a few days). How accurate and constructive did you find this explanation?"
* **Response Format:** 5-Point Likert Scale (1: *Nada útil o inexacta* – 5: *Muy acertada y me ayudó a entender el porqué*) + Text comment (*"¿La explicación te hizo sentido con lo que realmente ocurrió en tu mes?"*).
* **Feature & UI/UX Evaluated:**
  - Root-Cause Analyzer (`compra_unica_alta`, `alta_frecuencia`, `concentracion_fechas`, `monto_total_elevado`).
  - Monthly budget vs actual progress indicators and diagnostic coaching cards.
* **Product Rationale:** Traditional expense apps merely show a red bar when users overspend, inducing guilt without insight. This question checks if providing an objective diagnostic reason helps users self-correct without feeling judged.

---

### Question 9: Habit Building, Streaks & Gamification
* **Focus Area:** User motivation, positive reinforcement, and ongoing engagement.
* **Question (Spanish):**
  > "¿Los indicadores de metas logradas, las rachas de semanas cumpliendo tu presupuesto y el reconocimiento a tu 'mejor categoría del mes' aumentan tu motivación para cuidar tus gastos?"
* **Question (English Translation):**
  > "Do the goal achievement indicators, weekly budget streaks, and the highlight of your 'best category of the month' increase your motivation to stay disciplined with your spending?"
* **Response Format:** 5-Point Likert Scale (1: *No me motivan en absoluto* – 5: *Me motivan bastante a mantener el control semana a semana*).
* **Feature & UI/UX Evaluated:**
  - Gamified Fun Stats in the Budgeting Tool (weekly budget streaks, completed categories counter, best category badge, multi-month streak).
  - Visual status chips and iconography.
* **Product Rationale:** Financial management requires sustained discipline. Gamified micro-rewards (streaks and celebrations) determine whether users return weekly or only open the app when facing an economic emergency.

---

### Question 10: Product-Market Fit & Routine Adoption
* **Focus Area:** Real-world retention, willingness to adopt, and missing critical features.
* **Question (Spanish):**
  > "Pensando en tu rutina mensual o quincenal, ¿adoptarías esta herramienta como tu aliada principal para revisar tu dinero y planificar el mes siguiente? ¿Qué funcionalidad indispensable le hace falta para que no la dejes de usar?"
* **Question (English Translation):**
  > "Considering your monthly or bi-weekly financial routine, would you adopt this tool as your primary companion to review your money and plan the next month? What indispensable feature is currently missing for you to use it consistently?"
* **Response Format:**
  - Part A (Likert 1 to 5): *Probabilidad de adopción en tu vida cotidiana* (1: *Muy improbable* – 5: *Definitivamente sí*).
  - Part B (Open Text): *"¿Qué función adicional, ajuste visual o detalle te convencería al 100%?"*
* **Feature & UI/UX Evaluated:**
  - Overall product value proposition.
  - End-of-month review and next-month improvement suggestions.
  - Overall user workflow: Ingest -> Analyze -> Budget -> Optimize.
* **Product Rationale:** The ultimate product health metric. It separates casual curiosity from genuine daily/monthly utility, surfacing hidden user needs (e.g., mobile reminders, receipt photo capture, export formats, or family sharing).

---

## 3. Survey Summary Table for Product Teams

| # | Question Focus | Core UI / Feature Evaluated | Primary Product Metric |
|---|---|---|---|
| **1** | Onboarding & Entry Friction | PDF upload & Quick Text List ("Lista rápida") | Time-to-value & entry completion rate |
| **2** | Dashboard Visual Clarity | 4-Panel Analytical Grid in Quetzales | Cognitive clarity & comprehension |
| **3** | Spending Leaks & Merchants | "¿A dónde va mi dinero?" Bar Chart & Filters | Spending awareness ("Aha!" moment) |
| **4** | Payday Spikes & Timing | "Patrones de consumo" (Day of Week/Month) | Behavioral pattern recognition |
| **5** | Visacuotas & Subscriptions | "Antigüedad del gasto" (Debt vs Subscriptions) | Long-term debt management value |
| **6** | Interactive Drill-Down | Sliding Drawer & Chart click-through filters | Usability and deep-dive intuitiveness |
| **7** | Budget Creation Modes | Zero-based presets vs Realistic Historical Generator | Goal setting adoption & completion |
| **8** | Root-Cause Diagnostics | Automated failure diagnosis (Single purchase vs frequency) | Coaching effectiveness & perceived intelligence |
| **9** | Motivation & Streaks | Weekly streaks & "Best category" awards | Long-term habit retention & engagement |
| **10** | Retention & Product-Market Fit | Full end-to-end monthly review workflow | Net Promoter / Willingness to adopt regularly |
