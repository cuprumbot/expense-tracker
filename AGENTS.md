# Project Architecture: AI Cover Letter Generator

## Core Tech Stack
- **Frontend & Backend:** Next.js (App Router)
- **Deployment:** Vercel
- **External LLM:** Gemini Pro (via Google AI Studio `@google/genai` SDK)

## Constraints & Rules
- **Split-Brain Architecture:** Sensitive data such as user name and address is removed before data is being sent to an external LLM, sensitive data is handled using regex and traditional code. As much processing as possible is done locally. The external Gemini Pro API receives and generates structured data.
- **Security:** Never expose API keys in client components. All calls to Gemini or any additional API must route through Next.js Server-side Route Handlers.
- **Styling:** Always use standard Tailwind CSS.
- **Package Management:** Use `npm`.

## Style Rules
- All the UI text and labels must be in spanish.
- Amounts of money will be in Guatemalan Quetzales (GTQ / Q).
- The responses from models must be in spanish. The prompts for them can be in english if that improves the results, but the responses must be in spanish.
- All the comments, documentation, and commit messages must be in english.
- Make the frontend look good: prefer a simple, modern and responsive design.
- Do not use excessive animations or transitions.
- Do not use emojis or non-standard characters, use simple svg icons instead.

## Version Control Rules
- Clearly mark the finished features with `[x]` in `USER_STORIES.md`
- After each feature has been completed, reviewed and aproved by the user, stage and commit your changes (`git add .` and `git commit`).
- Use the Conventional Commits specification for the message (e.g., `feat(auth): add Next.js route handler`, `fix(ui): correct tailwind padding`).
- Summarize the commit based on the specific user story completed and the actual diff of the code.



<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
