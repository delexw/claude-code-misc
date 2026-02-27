# Phase 6.5: QA Web Test (Conditional)

> **Skip this phase** if the changes have no user-visible impact on a web application (e.g. CLI tools, infrastructure, CI config, library-only changes with no web consumer).

## Determine If QA Web Test Applies

Use your best judgement based on the ticket context and changes made. Consider running this phase when:
- Frontend files were changed (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`, `.html`, templates, UI components)
- Backend changes affect what users see (e.g. API response changes, rendering logic, data formatting)
- Bug fixes where the browser is the best way to visually confirm the fix

If the changes have no web-visible effect, skip this phase.

## Find Development URL

Determine the development web URL to test against:

1. If `$ARGUMENTS[1]` is provided, use it to infer the dev environment setup (it may reference a project, service, or directory — use your judgement to determine the dev server URL from its context)
2. Check for a running dev server (e.g. `localhost:3000`, `localhost:5173`, `localhost:8080`)
2. Look in `package.json` scripts, `.env` files, or project README for the dev server URL
3. If no dev server is found, skip this phase and note "QA web test skipped: no dev server running"

## Run QA Web Test

Invoke `Skill("qa-web-test")` with the development URL:

```
Skill("qa-web-test", "{dev_url}")
```

Review the QA report output. If issues are found, fix them before proceeding to verification.
