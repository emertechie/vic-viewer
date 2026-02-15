This project is for a modern, fast React app to view logs, traces (and eventually metrics) that are stored in the Victoria Metrics stack.

For more context, make sure you read:

- [PROJECT_OVERVIEW](./PROJECT_OVERVIEW.md)
- Original [PLAN doc](./LTM_LOG_VIEWER_PLAN.md)

# General

- After code changes, run `npm run typecheck` to ensure no new type errors introduced
- Always run `npm run format` to format new or updated files

# React

- When using JSX, always add an `import * as React from "react";` line at top of file
- Favor small, single-responsibility components (one clear purpose, ideally <150 lines); break down large UIs into multiple nested components instead of one monolithic file.
- When a component grows beyond a clear responsibility, extract subcomponents and compose them rather than extending the file.

# Shadcn instructions

- Never create Shadcn components manually. Always install the latest version using command like below:

```bash
npx shadcn@latest add button
```
