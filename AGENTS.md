# Repository operating rules

Read README.md before edits. This repository owns its independent layouts, components, styles and assets; there is no shared theme dependency.

- Preserve supplied prose, rankings, qualifications, budgets and links. Source mapping: docs/content-manifest.json. Do not fabricate authors, research dates, credentials or independence claims.
- Prose lives in src/content/articles; repeated facts live in src/data/rankings. Keep stable slugs and data-review-anchor identifiers; never reassign a removed anchor to a new element.
- Keep semantic landmarks, keyboard operation, contrast, visible focus and reduced motion. Preserve the site-specific identity.
- Use exact package versions and commit the lockfile. CI uses Node 24.
- Run npm run verify. For staging changes also run npm run build:staging, node scripts/verify.mjs and npm run test:staging. Content/layout changes require appropriate Lighthouse and responsive checks.
- Keep Worker-first authentication, noindex, same-origin writes, expiring secure cookies, rate limits and per-site D1 isolation. Validate page and scope on every API operation.
- Production must not contain review JavaScript, controls, APIs or database bindings. No production domain or deployment changes without explicit launch approval.
- Create codex/ branches and reviewed PRs for subsequent work. Avoid breaking database migrations; rollback must preserve comments.
- Never commit staging passwords, session secrets, API tokens, .dev.vars or private access notes.
