---
name: "speckit-git-feature"
description: "Create the git branch of a new Spec Kit feature (NNN-short-name) from master. Run automatically by the before_specify hook of /speckit-specify."
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

Runs as the `before_specify` hook (`.specify/extensions.yml`), before `/speckit-specify` creates the
spec directory. The feature description is the text given to `/speckit-specify`.

## Steps

1. Pick the feature's short name (2-4 words, kebab-case) exactly as `/speckit-specify` will (its
   step 1), so the branch and the spec directory match.
2. Compute the branch name with Spec Kit's own numbering, without creating anything:
   `bash .specify/scripts/bash/create-new-feature.sh --json --dry-run --short-name "<short-name>" "<description>"`
   and read `BRANCH_NAME` and `FEATURE_NUM` from its JSON output.
3. Check the working tree with `git status --porcelain`:
   - Changes unrelated to the new feature (other than untracked files already present before,
     such as `scripts/launch.sh`) must not be silently carried onto the new branch: stop and ask the
     user whether to commit them on the current branch first, carry them along, or stop.
4. Start from an up-to-date `master`: if the current branch is not `master`, tell the user which
   branch they are on and ask before switching (a previous feature may not be merged yet). Then
   `git switch -c <BRANCH_NAME>` from `master`. If the branch already exists, switch to it instead
   and say so.
5. Output the JSON `{"BRANCH_NAME": "...", "FEATURE_NUM": "..."}` so `/speckit-specify` can note
   it, and tell the user in one line which branch they are now on.

Never push, never delete a branch.
