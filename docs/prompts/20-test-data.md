It's going to be hard to manually verify things like infinite scrolling behave correctly, or even relative date/time filters, when the database just holds random logs I've created myself (and which keep drifting relative to current time - there may be no logs in the last 15m for example).

Help me plan a way to set up test data that will:

- always show some recent logs (so that last 15m to ~1hr at least always shows some logs. I guess ideally, much more range than that)
- allow me to visually verify that infinite scroll is working correctly and has no gaps / overlaps. For example, each log could have a message which starts with a numeric value, and that value increments over time (or some strategy like that. Open to ideas)
- allow me to test live tailing also. Probably similar to previous point, where I can see that new messages appear in correct position

I want to exercise as much of the app logic has possible. So perhaps some way to switch to a fake `victoriaLogsClient` implementation?

Ask me any questions to clarify things. Then create a plan for this in the `docs/plans` folder.
