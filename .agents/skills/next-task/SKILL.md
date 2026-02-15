---
name: next-task
description: Use this when the user asks you to implement the next task to be done.
---

## Instructions

- Find the next incomplete task to work on in the `NEXT_TASKS.md` file in the project root.
- Make sure you understand the task fully before beginning. Reasarch things by using the context7 MCP server to read documents and/or perform web searches as needed. If there is anything unclear or unspecified, or that the user may need to make a decision on, prompt the user before continuing.
- Once you have all the information you need, create a git branch for the task
- Implement the task
- Make commits at logical boundaries (e.g. after completing a step or a coherent group of related steps) so that a human reviewer can follow the progress in the git history. Don't batch all changes into a single commit at the end.
- Make sure to verify your work - ideally with tests. But also consider use of available MCP servers, if needed and if appropriate. For exmaple you can use the Chrome DevTools MCP to verify UI updates work as expected.
- When the task is complete:
  - make sure to run any affected tests if needed (for example, some UI tweaks may not affect tests)
  - commit your work if you haven't already
  - Then use the `refactor-pass` skill to examine and refactor the code if needed
- After completing each task:
  - mark its checkbox as done (`[x]`)
  - notify the user
- DO NOT automatically proceed with the next task unless the user explicitly asks you to
