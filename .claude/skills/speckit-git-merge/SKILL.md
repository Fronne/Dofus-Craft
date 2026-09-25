---
name: "speckit-git-merge"
description: "Merge the current Spec Kit feature branch into master so it can be deployed. Offered (optional hook) after /speckit-implement; run only when the user asks."
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

Offered by the optional `after_implement` hook (`.specify/extensions.yml`). Run it only when the
user asks for it (e.g. « fusionne », « merge », or before a deployment they requested).

## Steps

1. Note the feature branch (`git branch --show-current`); refuse if it is already `master`.
2. Require a clean tree for tracked files (`git status --porcelain`, untracked files like
   `scripts/launch.sh` may stay): if there are uncommitted changes, commit them first through
   `/speckit-git-commit` or ask the user.
3. Run the checks the project relies on before merging: `npx tsc -b --noEmit`, `npx vitest run`,
   `npx eslint src tests` (and `npx tsc -p worker --noEmit` if `worker/` changed). Stop and report if
   any fails.
4. `git switch master`, then `git merge --ff-only <feature-branch>`. If a fast-forward is not
   possible (master moved), stop and ask the user whether to rebase the branch or create a merge
   commit — never force anything.
5. Report the result. Keep the feature branch (do not delete it) and do not push or deploy unless
   the user asks.
