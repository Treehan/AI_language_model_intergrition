---
name: pr-preflight
description: Run pre-flight checks on staged changes, enforce Conventional Commits, and draft the Pull Request description.
tools:
  - terminal
---

# Pull Request Pre-flight Workflow

## Purpose
Ensure a clean diff, atomic commits, and an informative PR description before opening a Pull Request.

## Workflow Steps
1. **Diff Sanitization**
   - Run `git status` and `git diff --staged`.
   - Remove debug artifacts: `console.log`, temporary mock files, commented-out dead code.
   - Ensure no `.env*` files, credentials, or secrets are tracked. If any are found, stop and report.

2. **Verification**
   - Run the project's checks if the scripts exist in `package.json`: `npm run lint`, `npm run test:unit`.
   - If any check fails, fix the cause and re-run. Do not skip or disable checks.

3. **Conventional Commits**
   - Group related files into atomic commits.
   - Use the format `<type>: <summary>` (imperative mood, under 72 characters).
   - Allowed types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.

4. **PR Description**
   - If `.github/pull_request_template.md` exists, follow it exactly.
   - Read recent history with `git log -n 5 --oneline`.
   - Include: what changed and why, linked issue (`Fixes #<issue_number>`), and a checklist of verification steps actually completed.

## Acceptance Criteria
- Branch name follows `feat/<name>` or `fix/<name>`.
- No secrets or debug artifacts in the diff.
- All executed checks exit with status code `0`.
- Every item in the PR checklist is verified, not assumed.
- Never run destructive git commands (`reset --hard`, `push --force`) without explicit user approval.