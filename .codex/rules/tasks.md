# Workflow: Tasks

The `.agent/tasks` folder is used to manage tasks.

If you receive requests for analysis, research, or code correction, you must:

1. Before starting work, be sure to plan and divide the work into tasks.
1. Immediately add them to the task list and only then begin the main work on them.
1. Manage existing task statuses. For tasks you've already started working on, set the status to `in progress`
1. Close them as they are completed.
1. Tasks should be named according to Jira guidelines: key-number. Example: `NRS-25`. See the project key in the [Project Overview](./project.md) and a short name for the file name that reflects the nature of the task.
1. The task name must contain its key number.
1. All text must be in Russian, except for variables and proper names or other entities that exist only in English.
1. Tasks should be placed in the `.agent/tasks/archive` folder after they reach the `done` state.
1. A task should contain links to notes in the `.agent/agent_context` folder related to the work on that task, including the most recent context (or analysis, or anything else). This means that we first save and record the context, and then associate it with the task or tasks.
1. The list of sources should not be at the beginning of the article.
1. Reviews performed after corrections are made should be recorded in the task itself in a separate "Reviews" section. Each review should reflect the date and time of the review in its title and contain a brief description. If this is the final successful result that moves the task to the "completed" category, the result of this review is marked with an emoji icon and is also recorded as a review.
1. If anything changes beyond what was necessary to complete the task, only those items related to the task should be reviewed and evaluated.

The issue description should contain five sections:

1. "Problem" — the specific problem this issue is intended to solve.
1. "Description" — a more detailed description explaining why this is a problem and what causes it.
1. "Additional Information" — code blocks, logs, suggested sources/solutions, links to other related issues or sources in Obsidian.
1. "Definition of Done" — the criteria by which the issue is considered complete.
1. "References" — all references (e.g. [context-20260506161820-nrs-1-check-result](.agent/agent_context/context-20260506161820-nrs-1-check-result.md)) to the context `.agent/agent_context/` that are specific to this issue.

Task status list:

1. `todo` - new task
1. `in progress` - the task being worked on
1. `done` - completed task. should be moved to the archive.
