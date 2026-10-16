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

Generate enough user stories: one to create the dashboard base UI, and then as many as needed for each panel or interactive element the dashboard will have.