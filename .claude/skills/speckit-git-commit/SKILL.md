---
name: "speckit-git-commit"
description: "Commit the files produced by the Spec Kit step that just finished, on the feature branch. Run automatically by the after_* hooks (specify, clarify, plan, tasks, implement, converge)."
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

Runs as an `after_*` hook (`.specify/extensions.yml`) at the end of a `/speckit-*` step. The user
chose, for this project, to have each step committed automatically on the feature branch — this is
their standing authorization to commit here; it does not extend to pushing or deploying.

## Steps

1. Check the current branch (`git branch --show-current`). If it is `master`, do not commit:
   tell the user the step's changes are uncommitted because no feature branch is active, and stop.
2. Look at `git status --porcelain` and stage only what this step produced:
   - specify / clarify / plan / tasks / converge: the feature directory from `.specify/feature.json`
     (`specs/NNN-…/`), plus any other spec touched by the step (e.g. a revision note in an older
     spec).
   - implement: the source, test, style, spec and documentation files changed while implementing.
   Never stage files unrelated to the step (for example `scripts/launch.sh`, local env files,
   scratch files); if unsure about a file, leave it out and mention it.
3. If nothing is staged, say so and stop — no empty commit.
4. Commit in French, following the repository's style (imperative first line, e.g.
   « Spécifie … », « Planifie … », « Découpe … en tâches », or a description of the implemented
   change for implement), with a short body saying which step and feature it is, and end the
   message with the attribution line required by the session instructions, if any.
5. Report the commit hash and first line in one sentence.

Never push, never amend or rewrite existing commits, never use `--no-verify`.
