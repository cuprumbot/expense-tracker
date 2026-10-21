Read the **Second iteration** section in `SPEC.md` and create `USER_STORIES_2.md`. Follow the same format as `USER_STORIES.md`.

Read `DESCRIPTION.md`, `SPEC.md` (**Second iteration** section), and `USER_STORIES.md` to understand the project and the current implementation. Don't modify the existing user stories, use them only as reference. Ask clarifying questions if needed before proceeding. Based on all these sources, generate a comprehensive `USER_STORIES_2.md` file. Continue the numbering from the following files.

Break the iteration down into small, sequential phases. Every user story must include specific, testable acceptance criteria.

At this time, generate user stories only for the **Core improvements** and **Quality of life** subsections. Do not generate user stories for the **Product improvements** subsection, it still is being written and those stories will be generated at a later time.

---

Execute User Story #21 from `USER_STORIES_2.md`.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

Only stop when User Story #21 is fully verified, then report what was done.

---

Execute User Story #22 from `USER_STORIES_2.md`.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Update the current code so the transaction in dollars found in G&T bank statements and CSV files can be processed..

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

Only stop when User Story #22 is fully verified, then report what was done.

---

Execute User Story #23 from `USER_STORIES_2.md`.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Use the `frontend-design` skill. Update the current code to add the currency indicator. It should be a small, nice, unintrusive indicator. 

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

Perform visual & E2E browser verification:
    - Start the dev server (`npm run dev`) and test the end-to-end flow using the browser subagent at `http://localhost:3000`.
    - CRITICAL FILE UPLOAD RULE: Do NOT click the `<input type="file">` button directly (it opens a blocking native OS dialog). Instead, inject the test file programmatically via DOM script evaluation (dispatching a synthetic DataTransfer drop event with a fixture from `demo/` or setting `input.files`). Use one of the CSV files in the `demo/` folder.
    - Verify that the app transitions cleanly to the results / transaction review screen and that the parsed data is displayed.
    - Close the browser session once the results screen is verified.

Quality Gate & Version Control:
    - If and only if `npm run build` succeeds with 0 errors, `npm test` passes, and the browser verification reaches the results screen:
        1. Mark the completed story with `[x]` in `USER_STORIES_2.md`.
        2. Stage and commit all changes.

---

Execute User Story #28 from `USER_STORIES_2.md`.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    To be able to test this user story, create an additional CSV sample file in the `demo` folder. It should include some valid transactions, and some duplicated ones. For the valid transactions include partial matches, that is, valid transactions that only share the date, the amount, or the description, but not all the same data at the same time.

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

Perform visual & E2E browser verification:
    - Start the dev server (`npm run dev`) and test the end-to-end flow using the browser subagent at `http://localhost:3000`.
    - CRITICAL FILE UPLOAD RULE: Do NOT click the `<input type="file">` button directly (it opens a blocking native OS dialog). Instead, inject the test file programmatically via DOM script evaluation (dispatching a synthetic DataTransfer drop event with a fixture from `demo` or setting `input.files`). Use the appropriateCSV file from the `demo` folder.
    - Verify that the app transitions cleanly to the results / transaction review screen and that the parsed data is displayed.
    - Close the browser session once the results screen is verified.

Quality Gate & Version Control:
    - If and only if `npm run build` succeeds with 0 errors, `npm test` passes, and the browser verification reaches the results screen:
        1. Mark the completed story with `[x]` in `USER_STORIES_2.md`.
        2. Stage and commit all changes.

---

Execute User Story #25 from `USER_STORIES_2.md`.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

Only stop when User Story #25 is fully verified, then report what was done.

Since this is a simple user story, stage and commit after verifying.

After finishing execute a `[console]::beep(800, 800)` or similar to notify me that the task is complete.

---

Execute User Story #26 from `USER_STORIES_2.md`.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

Only stop when User Story #26 is fully verified, then report what was done.

Do not commit, I will check the functionality manually before staging and committing.

After finishing execute a `[console]::beep(800, 800)` or similar to notify me that the task is complete.

---

Execute User Story #24 from `USER_STORIES_2.md`.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    We want to ensure there are enough categories to cover most common types of expenses.
        - Have around 8-12 categories. Each will have its own color on the frontend files.
        - Each category will have between 15-50 keywords.
        - Most categories will have vendors from Guatemala.
        - It is acceptable to have some categories dedicated to international vendors (such as Netflix and other subscriptions, and Amazon and other web shops).
    
    Use the `2026-XX.pdf` files and your own investigation to populate the categories in `merchant-catalog.json`. Do not use the `BI-2025-XX.pdf` files yet.

    Additionally, create a new file in `data` called `unsure.md`. There you will put vendors which you are unsure which category to assign to, or you think might fit more than one category. For those vendors, you should also put keywords you would assign to them.

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

Only stop when User Story #24 is fully verified, then report what was done.

Do not commit, I will check the files manually before staging and committing.

After finishing execute a `[console]::beep(800, 800)` or similar to notify me that the task is complete.

---

Execute User Story #27 from `USER_STORIES_2.md`.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Some of the features in this user story may have already been implement in some past user story. Do not duplicate work.

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

Only stop when User Story #27 is fully verified, then report what was done.

Do not commit, I will check the functionality manually before staging and committing.

After finishing execute a `[console]::beep(800, 800)` or similar to notify me that the task is complete.

---

Read the **Second iteration** section in `SPEC.md` and create `USER_STORIES_2_DASHBOARD.md`. Follow the same format as `USER_STORIES.md`.

Read `DESCRIPTION.md`, `SPEC.md` (**Second iteration** section), and `USER_STORIES.md` to understand the project and the current implementation. Don't modify the existing user stories, use them only as reference. Ask clarifying questions if needed before proceeding. Based on all these sources, generate a comprehensive `USER_STORIES_2.md` file. Continue the numbering from the following files.

Break the iteration down into small, sequential phases. Every user story must include specific, testable acceptance criteria.

Generate user stories for **Product improvements** only (most of the content in **Core improvements** and **Quality of life** have already been implemented).

The **Product improvements** section deals with creating a dashboard. To create it, some of the current visualizations will no longer be shown. Do not delete these files; after completing some user story, add a comment on it explaining which files were deprecated.

The saving suggestions feature will be deprecated when implementing the dashboard.

Generate enough user stories:
- Enough user stories to create the dashboard base UI, hide the previous panels, show the dashboard.
- As many user stories as needed for each panel or interactive element the dashboard will have.

---

Implement Playwright testing.

Install the necessary tools and libraries for Playwright testing. Implement the following test:
- Check if `npm run dev` is already running. If it is not, start it.
- Start a new session. If there is previous data, use the `Borrar mis datos` option.
- Upload the `2026-09.pdf` and `2026-07.pdf` files to the new session. Use the correct tools so this requires no user interaction.
- If done correctly, this should give 9 unclassified expenses. Create a `Testing` category and classify them as such.
- After finishing, end the `npm run dev` process.

Report the results to me.

---

TO DO 1

Execute the following User Stories from `USER_STORIES_2_DASHBOARD.md` sequentially: US-029, US-030.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end for EACH user story in the sequence:

1. **Implementation:** Complete each step required by the current story's acceptance criteria without asking for intermediate approvals.
2. **Build Verification:** Run `npm run build` to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.
3. **End-to-End Testing:** Once the build passes, execute an automated Playwright test to verify the web app functionality. For this test:
    * Check if `npm run dev` is already running. If it is not, start it.
    * Start a clean, new session. If there is previous data, use the `Borrar mis datos` option first.
    * Upload the `2026-09.pdf` and `2026-07.pdf` files to the new session. Make sure to use Playwright and the correct programmatic tools (e.g., `setInputFiles` or file chooser events) so this step and the entire testing process requires absolutely no user interaction.
    * Continue navigating the flow until you successfully reach the **dashboard**. *Note: The program logic may or may not require you to classify missing expenses before the dashboard is accessible. If classification is required, handle it dynamically (e.g., create a `Testing` category and classify the unclassified expenses) to proceed.*
    * After reaching the dashboard and verifying the flow, gracefully end the `npm run dev` process.

Only stop when all specified User Stories are fully implemented and verified via both build and E2E tests. Then, provide a comprehensive report of what was done and the test results for each story. Summarize it in `DASHBOARD_IMPLEMENTATION.md`.

The stories US-029 and US-030 create the base dashboard. After each of these specific stories is done and successfully tested, stage and commit the changes automatically. Make exactly one commit per story.

After completing the entire batch, execute a `[console]::beep(800, 800)` or similar to notify me that the task is complete.

---

TO DO 2

Execute the following User Stories from `USER_STORIES_2_DASHBOARD.md` sequentially: US-031 through US-039.

These stories implement the four different panels of the dashboard. 

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end for EACH user story in the sequence:

1. **Branch Management:** Determine which dashboard panel the current story belongs to. If it is the first story being implemented for that specific panel, create and switch to a new Git branch named appropriately for that panel (e.g., `feature/panel-name`). Ensure all subsequent stories related to that same panel are committed to its corresponding branch.
2. **Implementation:** Complete each step required by the current story's acceptance criteria without asking for intermediate approvals.
3. **Build Verification:** Run `npm run build` to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.
4. **End-to-End Testing:** Once the build passes, execute an automated Playwright test to verify the web app functionality. For this test:
    * Check if `npm run dev` is already running. If it is not, start it.
    * Start a clean, new session. If there is previous data, use the `Borrar mis datos` option first.
    * Upload the `2026-09.pdf` and `2026-07.pdf` files to the new session. Make sure to use Playwright and the correct programmatic tools (e.g., `setInputFiles` or file chooser events) so this step and the entire testing process requires absolutely no user interaction.
    * Continue navigating the flow until you successfully reach the **dashboard** and can verify the new panel functionality. *Note: The program logic may or may not require you to classify missing expenses before the dashboard is accessible. If classification is required, handle it dynamically (e.g., create a `Testing` category and classify the unclassified expenses) to proceed.*
    * After reaching the dashboard and verifying the flow, gracefully end the `npm run dev` process.
5. **Committing:** After the story is fully implemented and has successfully passed both the build and E2E testing, automatically stage and commit the changes to the current panel's branch. Make exactly one commit per story.

Only stop when all specified User Stories are fully implemented, verified, and committed across their respective branches. Then, provide a comprehensive report of what was done and the test results for each story. Summarize it in `DASHBOARD_IMPLEMENTATION.md`.

After completing the entire batch, execute a `[console]::beep(800, 800)` or similar to notify me that the task is complete.

---

Let's improve the overall UI of the web app. Use the `frontend-design` skill.

- Make the web app title `Expense Tracker` both in the header and in the browser tab title. Make the icon besides the title smaller.
- Add a dark/light theme switcher. It should show the light theme by default. Add colors if needed so they look good in the light theme.

- In the starting screen, where the user loads their files:
    - Remove the `GTQ - Q` text in the header.
    - Remove the "Consolidado multicuenta" and "Archivo de movimientos" text. Just keep the "Guardado el <dd/mm/yyyy>" text.
    - Delete the "PDF / CSV" text in the corner of the loader panel.
    - Check if Playwright uses the demo files selector for its E2E testing. If Playwright does not use them, remove them.

- In the dashboard screen:
    - Make the header smaller vertically.
    - Remove the "Consolidado multicuenta" chip.
    - When the "X sin clasificar" is clicked, it should open the side panel with the transactions and filter to show only the unclassified expenses.
    - Reduce the panels height a little bit, to see more content on the screen. Modify the paddings to allow more useful content on the screen without making it hard or unconfortable to read.

- In the transactions side panel:
    - Remove the "Inspecciona, filtra ..." subtitle.
    - Remove the header icon.
    - Remove the number of transactions in the header.
    - Remove the "Consolidado multicuenta" chip.

Do not commit anything, I will check the changes manually.

After completing, execute a `[console]::beep(800, 800)` or similar to notify me that the task is complete.

---

Let's improve the overall UI of the web app. Use the `frontend-design` skill.

Move to the correct place:
- When the user uploads a file and repeated transactions are detected, a small panel would show above the transaction list alerting that it might be a duplicated file. Remove that panel and instead alert the user with some pop-up message.

In the dashboard screen:
- Remove the "Panel de Control Financiero" text. Keep only the "Expense Tracker" title.

We still have some intermediate screen between the file loading and the dashboard when there are more than 10 unclassified expenses/while the AI is classifying them.
- Remove this screen, proceed directly to the dashboard.
- Show some small chip to indicate the user that their expenses are being classified.
- If the AI didn't manage to classify everything and more than 10 transactions were left pending, add a subtle animation to the chip to get the user's attention.

If you want to test something, use Playwright. Do not use the native browser subagent.

Do not commit anything, I will check the changes manually.

After completing, execute a `[console]::beep(800, 800)` or similar to notify me that the task is complete.

---

These messages are currently shown in a panel above the transaction list:
    Lote de archivos procesado
    X archivos procesados exitosamente, X transacciones añadidas.

    Se clasificaron X gastos pendientes con Gemini Pro.
They should be shown in some kind of pop up message (like a toast notification).


In panel 1 when I put the mouse over some graph point, the message that pops up flashes. It seems like the point is changing position. Investigate and repair.

---

These two messages shouldn't be shown at the same time:
- 1 archivo procesado exitosamente, 73 transacciones añadidas.
- Todas las transacciones del archivo '2026-04.pdf' ya se encontraban registradas y fueron omitidas.

If there were duplicated transactions just say that, don't pop up the success message.