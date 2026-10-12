Use SPEC.md to create USER_STORIES.md

Read DESCRIPTION.md and SPEC.md. Ask clarifying questions if needed befor proceeding. Based on all these sources, generate a comprehensive USER_STORIES.md file. Break the project down into small, sequential phases. Make the project initialization the first User Story. Every user story must include specific, testable acceptance criteria that strictly adhere to the split-brain architecture.

---

Implement from USER_STORIES.md

Execute User Story #1 from USER_STORIES.md.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Make sure nothing from our base files gets deleted or changed when initializing the project. The only valid change for our base files is appending information.

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

    Once all acceptance criteria pass, stage and commit the changes using the Conventional Commits format specified in AGENTS.md.

Only stop when User Story #1 is fully verified, then report what was done. Wait for user approval before commiting changes.

---

Execute User Story #3 from USER_STORIES.md.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Create some CSV in the `demo` folder so we can test this item from the user story:
        If automatic detection is ambiguous, displays a column mapping modal in Spanish allowing the user to select the appropriate columns.

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

Only stop when User Story #3 is fully verified, then report what was done.

---

Execute User Story #4 from USER_STORIES.md.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    The folder `demo` contains some example bank statement PDF files. Use them as reference to greate the `G&T Continental` parser.

    The parser must be able to extract the following information from the PDF:
        - Transaction Date
        - Transaction Description
        - Transaction Amount
    
    The PDF files contain sensible information, so they must never leave the application. They must only be processed locally.

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

Only stop when User Story #4 is fully verified, then report what was done.

---

Execute User Story #5 from USER_STORIES.md.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    The folder `demo` contains `demo3.pdf` which is a non-G&T Continental bank statement. Use it as reference for sanitizations.
    
    The PDF files contain sensible information, so they must never leave the application. They must only be processed locally.

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

Only stop when User Story #5 is fully verified, then report what was done.
