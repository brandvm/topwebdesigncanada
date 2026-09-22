# Google Analytics 4

Brand Vision Insights owns a separate GA4 property and HTTPS www web stream for this publication. Public measurement identifiers are in `src/data/analytics.json`; they are not API secrets.

## What is collected

Production loads the first-party consent controller (about 2 KB compressed). Google code, cookies and measurement requests begin only after an explicit Accept choice. Decline, expiry, Global Privacy Control and noncanonical hosts prevent tracking. Preferences are stored in this browser for 180 days and can be changed from the footer. Withdrawal disables collection, removes GA cookies and refreshes a running page.

Google Signals and advertising personalization are disabled. The web stream measures page views, scrolls, outbound links and file downloads; search, form and video measurements are disabled. Arbitrary page query strings and fragments are omitted from the configured page URL, and referrers are limited to their origin. Recognized UTM campaign fields retain attribution; do not put personal information in campaign values.

## AI referrals

In GA4, open Reports → Acquisition → Traffic acquisition and use Session source / medium. Filter source for `chatgpt.com`, `perplexity.ai`, `claude.ai`, `gemini.google.com`, `copilot.microsoft.com` or other known AI referrers. Outbound agency links appear as `click` events; page views and scrolls show reading activity. This requires visitor consent. Visits without a referrer may appear as direct and cannot reliably be identified as AI traffic.

## Validation and staging

`npm run verify` checks the measurement ID, canonical host, hidden consent UI, exact script allowlist and organization schema. `npm test` covers pre-consent, refusal, expiry, GPC, preview hosts, query redaction, grant-after-refusal and withdrawal. Staging retains its authentication/review system and does not render the analytics controller or consent UI. No Measurement Protocol secret is created or shipped.

A new property can show no data until the tag is deployed and a visitor accepts analytics. Use Realtime after consenting to confirm incoming events; standard reports populate later.

## Cloudflare security headers

A minimal production Worker streams static HTML and adds a fresh cryptographic CSP nonce to each response. Cloudflare uses that nonce for its injected bot-detection script, preserving the strict script policy and existing bot protection. Static font, image, brand and analytics assets bypass this header Worker. No login, review routes, secrets or database bindings are added. See [Cloudflare JavaScript detections and CSP](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/).
