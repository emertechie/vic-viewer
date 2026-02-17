# Next Tasks

- [x] Add light and dark mode toggle. Implement light mode if not supported already. Switch to using Inter font. And fix the Run Query button style in dark mode - it always looks like it's disabled currently.
- [x] If all text removed from search bar and return pressed: default to "\*", and execute the search
- [x] For Log details slide out: use a copy icon button, not button with "Copy" text. Also make the whole slide out panel a bit wider - 500px.
- [x] Below the "Raw JSON" field in the "Log Details" slide out, add a toggle to wrap text
- [x] Track if there are any unapplied changes to the current query (e.g. the user has updated the LogsQL text but not pressed return, or they have changed a datetime value and not pressed apply, etc) and if so, give some indication to the user that there are unapplied changes. Perhaps an indicator message or icon. Whatever you think will work best, and is most common in these kind of log viewer UIs.
- [x] Two small changes: Add a clear / "x" button to the search bar so that pressing it will replace any existing search with "\*". It should not auto-execute the query though. Then, add some background colour to the log table's header (like a light grey in light mode), to help differentiate it.
- [ ] make log details 700px wide in desktop mode, 500px otherwise
- [ ] if the "Range" dropdown control in `src/ui/features/logs/components/logs-query-controls.tsx` is changed: as long as the "absolute" value is not selected, then immediately trigger search. Also immediately trigger search if the "x" button in the "LogsQL" search bar is clicked
