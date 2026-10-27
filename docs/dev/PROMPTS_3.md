Read the **Third iteration** section in `SPEC.md` and create `USER_STORIES_3.md`. Follow the same format as `USER_STORIES.md`.

Read `DESCRIPTION.md`, `SPEC.md` (**Third iteration** section), and all the user stories `.md` files to understand the project and the current implementation. Don't modify the existing user stories, use them only as reference. Ask clarifying questions if needed before proceeding. Based on all these sources, generate a comprehensive `USER_STORIES_3.md` file. Continue the numbering from the following files.

Break the iteration down into small, sequential phases. Every user story must include specific, testable acceptance criteria.

---

Execute the following User Stories from `USER_STORIES_3.md` sequentially: US-041 through US-051.

These stories implement several UI/UX changes based on user feedback. 

Adhere strictly to the rules in `AGENTS.md` and the requirements in `SPEC.md`. Work autonomously end-to-end for EACH user story in the sequence:

1. **Branch Management:** Determine which tasks are closely related. If it is the first task for that specific group, create and switch to a new Git branch named appropriately for that group (e.g., `feature/group-name`). Ensure all subsequent tasks related to that same group are committed to its corresponding branch.
2. **Implementation:** Complete each step required by the current story's acceptance criteria without asking for intermediate approvals.
3. **Build Verification:** Run `npm run build` to verify there are zero build or type errors. If you hit any errors, debug and resolve them independently.
4. **End-to-End Testing:** Once the build passes, execute an automated Playwright test to verify the web app functionality. For this test:
    * Check if `npm run dev` is already running. If it is not, start it.
    * Start a clean, new session. If there is previous data, use the `Reiniciar sesión` option first.
    * Upload the `2026-09.pdf` and `2026-07.pdf` files to the new session. Make sure to use Playwright and the correct programmatic tools (e.g., `setInputFiles` or file chooser events) so this step and the entire testing process requires absolutely no user interaction.
    * Continue navigating the flow until you successfully reach the **dashboard** and can verify the new panel functionality. *Note: The program logic may or may not require you to classify missing expenses before the dashboard is accessible. If classification is required, handle it dynamically (e.g., create a `Testing` category and classify the unclassified expenses) to proceed.*
    * After reaching the dashboard and verifying the flow, gracefully end the `npm run dev` process.
5. **Committing:** After the story is fully implemented and has successfully passed both the build and E2E testing, automatically stage and commit the changes to the appropriate branch. Make exactly one commit per story.

Only stop when all specified User Stories are fully implemented, verified, and committed across their respective branches. Then, provide a comprehensive report of what was done and the test results for each story. Summarize it in `UI_UX_IMPLEMENTATION.md`.

If you get stuck and need some user input, or after completing the entire batch, execute a `[console]::beep(800, 800)` or similar to notify me that the task is complete.

--- 

Make the following UI/UX changes:

- When the panels get minimized, a chip that says `Minimizado` appears, remove it.
- When the panels get minimized, a little blue circle appears besides the title, remove it.
- The `Restaurar` button should be only an icon with no text.

---

Make this changes to Panel 1:
- Hide the `Categorías` text so we can better use this space. 
- When the user clicks some category to hide it, the `Mostrar todo` chip should show.
- Show this text when the info button for the panel is pressed:

```
Clic en una categoría para ocultarla o mostrarla.

Clic en un punto para ver transacciones de esa categoría y mes.

Clic en una línea para ocultar las demás categorías.
```

---

Make this changes to Panel 2:
- Add a `Settings` icon to this panel. When it is clicked the following configuration should appear:
    - `Ocultar comercio de ambos paneles`, by default it is inactive.
- When the `Settings` icon is clicked again, the previous menu should close.
- Have separate lists of hidden vendors for `Mayor monto gastado` and `Mayor cantidad de compra`. The `Ocultar comercio de ambos paneles` tells us if the clicked vendor should be hidden from both panels or just the current one.
- The hidden vendors and the config should be stored in localStorage and restored when the user visits the dashboard again.
- Show this text when the info button for the panel is pressed:

```
Clic en un negocio para ocultarlo de la lista.
```

---

Our documentation is getting bloated. Modify `README.md` and other relevant files.

We are moving away from being a tech demo, and becoming a product. Remove information about the split-brain architecture from the main README.

Simplify the information presented in `¿Qué hace la aplicación?` section.

Get some screenshots from the dashboard to add in the documentation. Use Playwright if possible to get the screenshots instead of the native web agent.

---

Make this changes to Panel 3:
- Show this text when the info button for the panel is pressed:

```
Clic en un día de la semana o del mes para ver transacciones filtradas.
```

Make this changes to Panel 4:
- When one of the three categories are clicked, show the filtered transaction list.
- Show this text when the info button for the panel is pressed:

```
Clic en un tipo de gasto para ver transacciones filtradas.
```

---

Make these changes to the dashboard:

- Then panels are now resizable. They can be resized both vertically and horizontally. They have some small indicator on the corner to click and resize.
- When a panel is resized horizontally the panel below it must also resize to fill the entire width. The panels in the other column should also be resized the oposite way so the screen is always filled horizontally and it doesn't overflow.
- When the panels are resized vertically, the panels below are pushed up or down if applicable.
- The panel sizes should be persistent on localStorage.
- Provide the best UX for the panels resizing. Don't make it feel clunky or laggy.
- All the info inside the panels is resized appropiately with the panel. Reduce font size when resizing down if needed so the texts don't overlap. Don't show scrollbars unless the content overflowing cannot be fit in any other way.