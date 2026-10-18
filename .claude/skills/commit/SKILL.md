---
name: commit
description: How to write git commit messages in this repo. Use whenever creating a commit.
---

# Making commits

## Format: Conventional Commits

Every commit message is a single line following the Conventional Commits format
(https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>: <subject>
```

## Types

- **feat**: a new feature or capability. `feat: filter out unopenable files in the command palette`
- **fix**: a bug fix. `fix: confirm branch deletion with the Enter key`
- **refactor**: restructuring without behavior change. `refactor: merge document and project stores`
- **chore**: maintenance, dependencies, config, tooling. `chore: upgrade Electron to v43`
- **docs**: documentation only. `docs: highlight Git in the main Readme`
- **test**: adding or changing tests. `test: specify a user data directory in E2E tests`

## Subject rules

1. **No scopes**: `feat: add venue search`, not `feat(palette): add venue search`.
2. **Lowercase type**, imperative mood, no period at the end.
   - ✅ `fix: docker build error`
   - ❌ `Fix: fixed the docker build error.`
3. **Concise but descriptive**: say what the change does, not how it was made.
4. **Never use em dashes**, anywhere in the message. Prefer separate sentences
   with periods, or clauses with commas.
5. **Don't append PR numbers** like `(#380)`. GitHub adds those on squash merge.
6. When the change is driven by an update in a dependency we own, mention it in
   parentheses: `feat: handle quotes and soft/line breaks (HS lib update)`.

## Authorship

The commit's author and committer must be the user creating the PR, and no one
else. Never add a `Co-Authored-By` trailer, a "Generated with" line, or any
other attribution (AI or human) to the commit message.

## Workflow

1. Analyze the staged changes (`git diff --staged`) and write a message that
   matches what actually changed.
2. Keep commits atomic: one logical change per commit. If the working tree
   holds unrelated changes, stage and commit them separately.
3. Keep the message a single line. Issue references like `Closes #383` belong
   in the PR description, which becomes the squash commit body on merge.
4. Never bump the package.json version in a commit. The release workflow
   (GitHub Actions) bumps it automatically when a PR is merged to main.
