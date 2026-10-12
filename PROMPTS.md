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

---

Execute User Story #6 from USER_STORIES.md.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Only the anonymized data is sent to the LLM. Make a clear prompt so it understands what the data is and how to process it. The LLM should send us a JSON file, in the same format that the one we got from the CSV or PDF parser.

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

    Let me test the changes manually before staging and commiting.

Only stop when User Story #6 is fully verified, then report what was done.

---

Execute User Story #7 from USER_STORIES.md.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Classify expenses into categories. Take categories should not be hardcoded, they should be configurable from some file on the server.

    Consider that some vendors might have variants, such as "La Torre Zona 10", "La Torre Zona 4", "La Torre Zona 14", etc. All of them should be classified as "Supermercado".

    Try to classify as much as possible, but if you're not sure about the category, you can use the "Pendiente" category. Consider the US-009, at a later time we will give the user the option to customize their categories and categorize the pending expenses if they are few.

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

    Let me test the changes manually before staging and commiting.

Only stop when User Story #7 is fully verified, then report what was done.

---

Execute User Story #8 from USER_STORIES.md.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Some of this work might be already implemented. Try to classify as much as possible, but if you're not sure about the category, you can use the "Pendiente" category. Consider the US-009, at a later time we will give the user the option to customize their categories and categorize the pending expenses if they are few.

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

    Let me test the changes manually before staging and commiting.

Only stop when User Story #8 is fully verified, then report what was done.

---

Execute User Story #9 from USER_STORIES.md.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    If the user has 5 or less "Pendiente" expenses, let them categorize the expenses manually. If the user has more than 5 "Pendiente" expenses, use the LLM to help them categorize the expenses.

    The LLM will be sent the following structured information:
    - The pending expenses only, not the ones that were already classified.
    - The list of proposed categories.

    The LLM must answer with structured information, in the same format we are using locally.

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

    Let me test the changes manually before staging and commiting.

Only stop when User Story #9 is fully verified, then report what was done.

---

Execute User Story #10 from USER_STORIES.md.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Check carefully which parts of this User Story are already implemented. Implement what is missing.

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

    Let me test the changes manually before staging and commiting.

Only stop when User Story #10 is fully verified, then report what was done.

---

Execute User Story #11 from USER_STORIES.md.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

    Let me test the changes manually before staging and commiting.

Only stop when User Story #11 is fully verified, then report what was done.

---

Execute User Story #12 and 13 from USER_STORIES.md.

Adhere strictly to the rules in AGENTS.md and the requirements in SPEC.md. Run all necessary terminal commands to scaffold the project, set up the directory structure, install dependencies, and remove boilerplate code.

Work autonomously end-to-end:

    Use the `frontend-design` skill to create a nice, compeling interface for the results.

    While there are unclassified expenses, draw attention to that.

    After all the expenses have been classified, put the aggregated data on the top of the page, replacing the current "Total de gastos" / "Clasificados localmente" / "Gastos pendientes".

    Integrate the aggregated data and the subscription data nicely.

    Keep the categories and the list of expenses below the stats.

    Complete each step required by the story's acceptance criteria without asking for intermediate approvals.

    Run npm run build to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.

    Let me test the changes manually before staging and commiting.

Only stop when User Story #12 and 13 is fully verified, then report what was done.

---

The UI/UX need several improvements, use the `frontend-design` skill when implementing them:

In general:
- The page looks nice on portrait mode, but doesn't seem to be optimized for landscape mode. Make it a little bit wider to use the space better, but keep the responsive design.

When we have unclassified expenses:
- Redundant data: we have the same alert in three places. That info should appear in one place only. If we click it, it should filter and show us only the expenses with "Pendiente" tag.
    - In the banner: "¡Atención requerida! Tienes 4 gastos pendientes de clasificar"
    - In the card: "Gastos pendientes"
    - In the small banner with filter: "4 gastos pendientes de clasificar, clasifícalos para continuar"

---

The UI/UX need several improvements, use the `frontend-design` skill when implementing them:

When all our expenses are classified:
- First card:
    - Make sure the "Q" and the total amount never get separated in different lines.
- Second card:
    - The "39.5% del total" seems to be inside a circle, it pops out the circle and that looks bad.
    - For long category names like "Entretenimiento y compras" the complete text doesn't fit the card.
    - The total amount for this category should have a bigger font size, maybe as big as the total in the first card.
- Third card:
    - Since "Suscripciones recurrentes" is composed of two long words, the "0 servicios" gets pushed way to the right.

For the "Distribución del gasto por categoría" panel:
- Too much redundant info.
- Keep the bar.
- Fuse the percentage amount below the bar with the cards, give them enough space so they read nicely. Consider a list instead of a grid, if you keep a grid consider a max of three cards wide.

For the "Suscripciones Detectadas & Gastos Recurrentes" panel:
- If the user has no subscriptions, hide this panel.

For the expenses table:
- Hide the "Origen" column

---