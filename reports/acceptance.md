# Staging acceptance report

Site: Top Web Design Canada. 2 articles, 4 content pages, 20 agency profiles and 20 FAQs. Additional 404 and authentication pages are not included in the content-page count.

## Automated production checks

All content blocks and links from the supplied export are preserved (typographic apostrophe normalization only). Astro checks, structured-content checks, internal links, unique anchors, heading hierarchy, canonical/schema output, production indexing settings and draft exclusion pass. An all-draft build passes and emits no article pages; restoring published content produces the identical HTML used for the Lighthouse audit.

Production JavaScript: **0 bytes**. Maximum compressed CSS: **3,121 bytes**. Fonts per page: **61,768 bytes**. Review scripts, controls, APIs and database bindings are absent from production output.

Three Lighthouse runs per page/device, measured locally with Lighthouse 13.5.0. All agreed thresholds pass. CI repeats these audits before staging deployment. These lab results do not establish real-user Core Web Vitals.

| Page | Mobile P/A/BP/SEO | Desktop P/A/BP/SEO |
|---|---|---|
| `/` | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| `/blog/` | 99 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| `/blog/top-web-design-agencies-canada/` | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| `/blog/top-web-design-agencies-toronto/` | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |

## Responsive and review checks

All content pages checked at 320, 390, 768, 1024 and 1440 pixels; no page-level horizontal overflow. Desktop homepages and narrow article templates visually inspected. Tables scroll independently on narrow screens. Accessibility trees and visible navigation/form labels inspected; the review interface provides keyboard section selection and avoids global single-letter shortcuts.

Per-site local Worker tests pass for direct page/asset/API authentication, forged and expired sessions, same-origin writes, rate limiting, idempotent posting, replies, reactions, resolve/reopen, page/branch isolation and persistence through Worker reloads. Live tests confirm all content pages behind authentication, noindex headers, and persistence between independently authenticated sessions.

Representative live Chicago UI checks pass for point/rectangle selections, keyboard section selection, replies, direct thread links, original revision/viewport display, draft recovery across reload, and mobile card placement above the toolbar. Protected alias and immutable version URLs were checked. A removed-anchor preview keeps its original thread readable with an explicit location-changed notice. A live Chicago rollback preserves D1 threads and restores the current version.

## Remaining human checks / measurement limits

A complete manual screen-reader journey and separate browser-level zoom review have not been certified. Two independent authenticated sessions passed. Cross-browser UI persistence was also verified in the in-app browser and Google Chrome: Chrome loaded the original thread and reply, then successfully posted a second-browser reply. Screen-reader and separate browser-zoom checks remain on the review checklist. Automated accessibility 100 does not constitute full WCAG certification. Real-user LCP/INP/CLS and public PageSpeed checks require approved launch and sufficient traffic.

No production domain is connected. Passwords and deployment credentials are outside Git. Review feedback remains in this site's D1 database when code is deployed or rolled back.
