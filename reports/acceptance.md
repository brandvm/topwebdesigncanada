# Acceptance report — article homepage and agency directory

The main supplied article is now `/`. The other 1 supplied article(s) retain their existing URLs and are linked directly from the navbar. `/blog/` is a secondary comparison index in the footer. This site has 2 complete articles, 20 agency profiles, 20 FAQs and 3 content pages; 404 and design pages are additional. The old primary article URL redirects home and is excluded from the sitemap.

Open green-and-white layout, Canada/Toronto navigation and a wide company grid above a generous reading column. Typography is Manrope + DM Sans, both self-hosted modern sans-serif fonts. Company identity tiles link directly to the corresponding profiles. Official-site icon sources and neutral initials fallbacks are recorded in `docs/agency-marks.json`.

## Measured production Lighthouse results

Three runs per route and device; medians below. These are local production-build measurements, not public PageSpeed Insights or real-user field results. The production snapshot has no review or design-desk resources.

| Route | Device | Performance | Accessibility | Best practices | SEO |
|---|---|---:|---:|---:|---:|
| / | mobile | 99 | 100 | 100 | 100 |
| / | desktop | 100 | 100 | 100 | 100 |
| /blog/ | mobile | 100 | 100 | 100 | 100 |
| /blog/ | desktop | 100 | 100 | 100 | 100 |
| /blog/top-web-design-agencies-toronto/ | mobile | 99 | 100 | 100 | 100 |
| /blog/top-web-design-agencies-toronto/ | desktop | 100 | 100 | 100 | 100 |

## Validation

- Astro checks, content tests, production build and structural validation pass. All supplied source blocks and rankings are preserved; see `source-integrity.json`.
- Staging build, structural checks, authentication/review integration tests and Wrangler deployment dry run pass.
- `directory-responsive.json` checks every content route at 320, 390, 768, 1024 and 1440px. No page overflow or broken loaded images was observed. Table overflow stays inside its scroll region. Desktop and mobile homepage screenshots were inspected.
- `design-responsive.json` records the six style guides and central reference board checks at those widths. The board includes 18 attributed references and actual homepage screenshots; filters show eight Mobbin references and restore all eighteen.
- Representative keyboard checks cover visible skip-link focus and direct navbar navigation. Automated accessibility is 100; a complete screen-reader journey and comprehensive zoom review have not been certified.
- Production structural checks verify canonical URLs, sitemap, internal links, headings, draft exclusion, JSON-LD, asset budgets and exclusion of review/design resources. Per-page byte counts are in `structure-production.json`.

## Review continuity and deployment

Old primary-article URLs redirect to `/` with review query parameters intact. The API accepts the canonical and legacy page as one conversation group, while retaining other page/site/scope isolation. Existing D1 records are not rewritten or deleted. Integration tests cover legacy thread reads, replies, reactions, resolution, missing anchors, expired sessions and direct asset/API protection. Removed page elements keep the explicit location-changed state.

The existing name/password login and comment interface remain available on protected noindex Cloudflare staging. No database migration, credential change or production-domain change is part of this revision. All six repositories retain separate source, assets and databases. Public PageSpeed and field Core Web Vitals remain launch-stage measurements.
