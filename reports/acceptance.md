# Acceptance report — visual revision and design desk

## Delivered scope

2 supplied articles, 20 agency profiles, 20 FAQs and 4 editorial pages, plus 404. Source integrity and draft exclusion checks remain in their JSON reports. Production domains are untouched.

The redesigned publication uses local Google Fonts, vendored Phosphor SVG icons and original illustrative covers. `/design/` is its protected, noindex style guide with typography, colour, layout diagrams, component examples and attributed reference screenshots. The central reference board is on Chicago at `/design/references/`. These design pages are omitted from production, including their fonts, screenshots and scripts. They are additional staging review pages and are not part of the 23-page editorial inventory.

## Measured production Lighthouse results

Three runs per route and device; medians below. Source: `lighthouse.json`. The audit is a local production-build snapshot (`build: local`), not a public PageSpeed run or field performance measurement. The subsequent staging-only design pages and review changes do not change production HTML.

| Route | Device | Performance | Accessibility | Best practices | SEO |
|---|---|---:|---:|---:|---:|
| / | mobile | 100 | 100 | 100 | 100 |
| / | desktop | 100 | 100 | 100 | 100 |
| /blog/ | mobile | 100 | 100 | 100 | 100 |
| /blog/ | desktop | 100 | 100 | 100 | 100 |
| /blog/top-web-design-agencies-canada/ | mobile | 99 | 100 | 100 | 100 |
| /blog/top-web-design-agencies-canada/ | desktop | 100 | 100 | 100 | 100 |
| /blog/top-web-design-agencies-toronto/ | mobile | 99 | 100 | 100 | 100 |
| /blog/top-web-design-agencies-toronto/ | desktop | 100 | 100 | 100 | 100 |

Production build validation passes compressed asset budgets, links, headings, structured data, indexing and zero browser review code. See `structure-production.json` for per-page asset sizes. The design desk is outside production performance budgets.

## Validation of this revision

- `npm run verify`, staging build, staging structure validation and `npm run test:staging` pass.
- Editorial responsive checks: `redesign-responsive.json`; widths 320, 390, 768, 1024 and 1440px.
- Design-desk responsive checks: `design-responsive.json`; all seven pages have one H1, no horizontal page overflow and no observed broken images across those five widths. Reference filters return the expected five Mobbin entries and restore all fourteen.
- Palette contrast ratios are calculated from the listed colours. Ink, accent and secondary text against paper all exceed 4.5:1. This does not certify all interaction states or WCAG conformance.
- Login requires a name and password. Signed sessions provide names to comments and replies; submitted name overrides are ignored. Worker tests include expired sessions, direct asset/API protection, request isolation, rate limits, same-origin writes and retry identity after reauthentication.
- Live redesign checks are recorded in `redesign-live.json`. The in-app browser and Safari also displayed the same Chicago thread; Safari posted a reply with its login name and the reply appeared in the first browser.
- Review cards support compact viewport scrolling and are repositioned when the viewport or review toolbar changes size.

## Remaining checks and prior operational evidence

A complete manual screen-reader journey and comprehensive browser zoom review have not been certified. Automated accessibility scores are not full WCAG certification. Public PageSpeed checks and field LCP/INP/CLS require an approved launch and sufficient traffic.

The earlier staging acceptance exercised a protected version preview, missing-anchor notices and a Chicago rollback that preserved D1 comments. This revision does not change database schemas. Credentials stay outside Git, and comments persist independently of code deployments.
