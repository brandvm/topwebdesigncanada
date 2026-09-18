# Top Web Design Canada

An Astro agency directory for `topwebdesigncanada.ca`. This public repository contains the editorial source; Cloudflare staging is password-protected and noindex. Production domains remain untouched. There is no GitHub Pages deployment.

## Edit locally

Use Node 24 or newer.

```sh
npm ci
npm run dev
npm run verify
```

Prose: `src/content/articles/*.mdx`. Agency data: `src/data/rankings/*.json`. Identity: `src/data/site.json`. Layouts, components, styles, SVG marks and local fonts belong to this repository. No shared theme dependency.

The overview and profiles use the same agency records, preserving the different original table and profile wording. `docs/content-manifest.json` maps the source export to articles. Full source snapshots live in `docs/source/`. Do not invent authors, credentials, dates, or independence claims. Optional metadata accepts author/image and verified publication/update dates. Set `draft: true` to exclude an article from the site. Keep year-free slugs stable. When adding a guide, also add its ranking JSON, source snapshot and article/anchor mapping in docs/content-manifest.json; the article template and sitemap use that explicit inventory.

## Protected staging and reviews

See `docs/staging.md` for the deployed URL. The shared password is delivered privately, outside Git. A secure, HttpOnly, SameSite cookie expires after 12 hours; Log out clears it. Worker-first routing protects pages, direct assets, API calls and version previews. Noindex headers remain independent of login.

Choose **Comment** or append `?mode=review`. Click a point, drag an area, or choose a section and select **Add comment** using the keyboard. Sign in with your name and the shared password, then post feedback, reply, react, resolve or reopen, and copy a direct thread link from Comment options. Escape closes the card or returns to Browse. The name entered at login identifies feedback; they are not verified accounts.

Comments are isolated by page and review scope (main or PR number), with one D1 database for this site. Each thread records its original commit and viewport. Stable `data-review-anchor` IDs survive layout reordering. If an anchor disappears, the thread stays available through comment navigation with an explicit location-changed notice. Drafts stay in this browser's local storage until successfully submitted; do not enter secrets into comments.

## Repository workflow

Create a `codex/` branch, open a pull request, review its diff and checks, and merge after human review. GitHub Actions validates production output, builds staging, tests authentication/reviews, and deploys. Same-repository PRs get protected Worker version previews with a separate `pr-N` conversation scope. Fork PRs validate without deployment credentials. The Actions summary records the revision and PR preview URL. Main updates stable staging.

CI secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Cloudflare Worker secrets: `STAGING_PASSWORD_HASH` and `SESSION_SECRET`. The password uses a salted PBKDF2-SHA256 hash. Never commit secrets. Existing secrets are preserved on deploy.

```sh
BUILD_COMMIT=$(git rev-parse HEAD) REVIEW_SCOPE=main npm run build:staging
node scripts/verify.mjs
npm run test:staging
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

For local authenticated review, put the two Worker secrets in ignored `.dev.vars`, apply migrations with `npx wrangler d1 migrations apply DB --local`, and run `npm run dev:staging`. Local development uses Wrangler; plain Astro preview has no review API or authentication.

## Quality and launch

`npm run verify` runs Astro checks, content tests, a production build, links/anchors, heading hierarchy, schema, source-link and indexing checks, plus compressed asset budgets. `npm run audit` audits production HTML on mobile and desktop, three runs per page. Targets: performance 100 (median ≥95 required), automated accessibility/best practices/SEO 100. Reports distinguish measurements from manual checks. Real-user Core Web Vitals and public PageSpeed checks require an approved launch and traffic.

Production output has zero review code or controls, no API routes, and no database bindings. Production deployment is deliberately not configured. To launch, obtain approval for an explicit revision and connect its domain in a separate change.

## Rollback

Use `npx wrangler deployments list` and `npx wrangler rollback <version-id>` to restore a prior staging version. D1 comments persist independently. Keep migrations backward-compatible; code rollback does not undo schema changes. Scope, password and session secrets must remain consistent for the intended preview. Review `reports/acceptance.md` for the completed exercise.

## Visual design review

Open `/design/` on protected staging for this publication’s rendered style guide. The [reference board](https://topbrandingagencieschicago-staging.hamoun-ce6.workers.dev/design/references/) contains dated screenshots and explicit design takeaways. Both support page-specific review comments. `design/` is copied only by staging builds and is excluded from production. See `docs/style-guide.md`.

## Directory homepage

The full `top-web-design-agencies-canada` article is the homepage. Other supplied articles retain their existing `/blog/<slug>/` URLs and appear directly in the navbar. `/blog/` remains a secondary comparison index, linked in the footer. The former main-article URL redirects to `/` and is excluded from the sitemap; review queries include its legacy conversation without moving or deleting D1 records. Original anchors, commit context and page isolation remain intact.

All interface typography uses self-hosted modern sans-serif Google Fonts. Company marks are small locally hosted identity images; `docs/agency-marks.json` records their source. Where an official asset is unavailable, a neutral initials tile identifies the agency. These are company navigation tiles, not client endorsements or verification badges.
