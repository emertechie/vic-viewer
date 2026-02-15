I want to build a log, trace, and metric (LTM) viewer app in React for developers. The LTM data will be stored in the [VictoriaMetrics](victoriametrics.com) stack (VicStack) using VictoriaLogs, VictoriaTraces, and VictoriaMetrics.

You can assume there is an existing VicStack with the following URLs:

- Logs: http://localhost:9428/
- Traces: http://localhost:10428/
- Metrics: http://localhost:8428/

Note: I'm _not_ an expect in the VictoriaMetrics - I just installed it today! So push back on anything that's not possible / dumb.

For FE tech stack, I want to use:

- TanStack Router
- TanStack Query
- TanStack Table
- ShadCN and Tailwind for UI components

There is an existing skeleton React app in this directory already with all of these already installed, and a place holder logs page.

I want you to help me plan building out the React app.

The first focus is on building a basic log viewer. This would be similar to existing log viewer apps like Seq, Jaeger, etc.

The VicStack provides a HTTP API to query logs: https://docs.victoriametrics.com/victorialogs/querying/, so I assume that's what we'll use. I was thinking we would query that directly from the React app. I realise we will probably need our own node.js server later to at least store settings/preferences, but for now I was hoping to keep things simple. But it's ok to add a Node.js server also if needed, so push back if you think it it.

I also want you to investigate if there's an HTTP API for traces and metrics as well. And if not, how would we query for those (for example, would we need to build a proxy node.js service - If so, it might be better to just start with one now?).

Some rough log viewer requirements:

- Log query bar above the log table that accepts [LogsQL](https://docs.victoriametrics.com/victorialogs/logsql/) query text
- Usual querying options like relative time (last 5 mins) and absolute ranges
- New logs shown at bottom, older at top
- Infinite scrolling of logs - i.e. can scroll up to see older logs, scroll down to see newer. But ake sure it's performant. If appropriate, here is an example of virtualized infinite scrolling with TanStack Table: https://github.com/TanStack/table/blob/main/examples/react/virtualized-infinite-scrolling/src/main.tsx
- Live tailing support
- Clicking a log to view detail: slide out a drawer from RHS
- Dark theme by default

Open questions:

- Linking log with traces/spans: Eventually, I want to be able to click through from a log to view it's corresponding trace / span (if it has one). I'm not sure how you would do that with VicStack
- QuickStart for OpenTelemetry logs? I believe that VicStack is very flexible and supports viewing structured and unstructured logs. If so, I would imagine any default view would be very generic. Should we consider having special "views" for different log types. For example, first focus is for OpenTelemetry (OTEL) logs from .net apps - should we have a special OTEL view that knows to pick out certain fields and use those for columns / pre-definted filters etc?

So consider all that and create a plan and save it to markdown in the project directory.

Ask me questions for anything you are not clear on.
