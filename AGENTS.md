This project is for a modern, fast React app to view logs, traces (and eventually metrics) that are stored in the Victoria Metrics stack.

For more context, make sure you read:

- [PROJECT_OVERVIEW](./PROJECT_OVERVIEW.md)
- Original [PLAN doc](./docs/plans/LTM_LOG_VIEWER_PLAN.md). NOTE: parts may be out of date.

# General

- After code changes, run `npm run typecheck` to ensure no new type errors introduced
- Always run `npm run format` to format new or updated files
- Add code comments when the purpose of the some pirce of code or logic may not be immediately clear or be easily understood by future human readers. If unsure, err on the side of adding comments
- For schemas/types used by both server and client, define the canonical Zod schema in `src/shared/schemas/*` and import/re-export it from server/UI modules instead of duplicating definitions.
- If you are making commits, make commits at logical boundaries (e.g. after completing a step or a coherent group of related steps) so that a human reviewer can follow the progress in the git history. Don't batch all changes into a single commit at the end.

# React

- When using JSX, always add an `import * as React from "react";` line at top of file
- Favor small, single-responsibility components (one clear purpose, ideally <150 lines); break down large UIs into multiple nested components instead of one monolithic file.
- When a component grows beyond a clear responsibility, extract subcomponents and compose them rather than extending the file.

# Shadcn instructions

- Never create Shadcn components manually. Always install the latest version using command like below:

```bash
npx shadcn@latest add button
```
