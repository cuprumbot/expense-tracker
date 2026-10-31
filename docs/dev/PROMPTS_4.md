Read the **Fourth iteration** section in `SPEC.md` and create `USER_STORIES_4.md`. Follow the same format as `USER_STORIES.md`.

Read `DESCRIPTION.md`, `SPEC.md` (**Fourth iteration** section), and all the user stories `.md` files to understand the project and the current implementation. Don't modify the existing user stories, use them only as reference. Ask clarifying questions if needed before proceeding. Based on all these sources, generate a comprehensive `USER_STORIES_4.md` file. Continue the numbering from the following files.

Break the iteration down into small, sequential phases. Every user story must include specific, testable acceptance criteria.

If you need any additional information, ask before generating.

In `SPEC.md` there is a message stating **Ignore below this point**, follow the instruction and don't include that when generating the stories.

---

Execute User Story #53 from `USER_STORIES_4.md`.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

Only stop when User Story #53 is fully verified, then report what was done.

Remember not to commit anything until I check manually. Remember to beep when finished or if you need some user input.

---

We are implementing parsers for Banco Industrial, Banco Cuscatlán, BAC, FICOHSA, Banco Agromercantil.

Use user stories #17 to #20 in `iteration_2/USER_STORIES_2.md` as reference.

Generate new user stories in `USER_STORIES_4.md`:
- Remove the current Banco Industrial and Banrural parsers. The current ones are for checking accounts, we are only working with credit card statements now.
- Generate new user stories for Banco Industrial, Banco Cuscatlán, BAC, FICOHSA, Banco Agromercantil.
- Generate a new user story to automatically select the correct bank when uploading a PDF.
- Annotate the previously existing user stories so they reference the new ones.

---

Execute User Story #64 from `USER_STORIES_4.md`.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

Only stop when User Story #64 is fully verified, then report what was done.

Remember not to commit anything until I check manually. Remember to beep when finished or if you need some user input.

---

Stage and commit previous changes.

Execute User Story #66 from `USER_STORIES_4.md`.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    In this user story we are implementing the parser for Banco Industrial.

    Use the following files as reference to create the parser:
    - `BI-max.pdf`

    All the other `pdf` are from different banks and should not be used when creating this parser.

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

Only stop when User Story #66 is fully verified, then report what was done.

Remember not to commit anything until I check manually. Remember to beep when finished or if you need some user input.

---

Stories #66 to #70 are already implemented, so let's proceed with #65 which let us choose which parser to use.

Execute User Story #65 from `USER_STORIES_4.md`.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

Only stop when User Story #65 is fully verified, then report what was done.

Remember not to commit anything until I check manually. Remember to beep when finished or if you need some user input.

Report if everything is ready to implement #71 so we can finally test the file upload in the web app.

---

Execute User Story #71 from `USER_STORIES_4.md`.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Before reporting as finished, check that you can upload any bank statement, using the 6 parsers we have implemented so far, and that the transactions are parsed correctly.

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

Only stop when User Story #71 is fully verified, then report what was done.

Remember not to commit anything until I check manually. Remember to beep when finished or if you need some user input.

---

Execute the following User Stories from `USER_STORIES_4.md` sequentially: US-054 through US-063.

These stories implement the budget functionality.

Adhere strictly to the rules in `AGENTS.md` and the requirements in `SPEC.md`.

Work autonomously end-to-end for EACH user story in the sequence:

1. **Branch Management:** When starting, create a new branch and work there. Do not merge into master, I will do that later after manually reviewing the work done. Make sure all the stories are in that branch.

2. **Implementation:** Complete each step required by the current story's acceptance criteria without asking for intermediate approvals.

3. **Build Verification:** Run `npm run build` to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

4. **End-to-End Testing:** Once the build passes, execute an automated Playwright test to verify the budget tool functionality. For this test:
    * Check if `npm run dev` is already running. If it is not, start it.
    * Create some dummy CSV files in the `demo` folder with sample data for testing. Create as many as needed so you can test all the budget functionality. Make sure all the expenses in the dummy files fit into our previously defined categories so they don't need to be manually classified.
    * Start a clean, new session when relevant.
    * Make sure to use Playwright and the correct programmatic tools (e.g., `setInputFiles` or file chooser events) so the entire testing process requires absolutely no user interaction.
    * Continue navigating the flow until you successfully reach the budget tool and can verify the functionality.
    * After reaching the budget tool and verifying the flow, gracefully end the `npm run dev` process.

5. **Committing:** After the story is fully implemented and has successfully passed both the build and E2E testing, automatically stage and commit the changes to the new branch. Make exactly one commit per story.

Only stop when all specified User Stories are fully implemented, verified, and committed to the new branch. Then, provide a comprehensive report of what was done and the test results for each story. Summarize it in `BUDGET_IMPLEMENTATION.md`.

After completing the entire batch, execute a `[console]::beep(800, 800)` and delete the `task.lock` file.