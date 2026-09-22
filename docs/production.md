# Production deployment

Canonical domain: `https://topwebdesigncanada.ca`. Production Worker: `topwebdesigncanada`. Protected review Worker: `topwebdesigncanada-staging`.

## Release

Run `npm ci`, `npm run verify`, and `npm run audit`. The audit checks every public content page on mobile and desktop, three times, requiring performance at least 95 and accessibility, best practices and SEO 100. Run `npm run deploy:production` to rebuild, verify and publish to the public Worker. The **Publish production** manual GitHub workflow includes the same checks and the full audit.

Production uses `wrangler.production.jsonc` and contains only static assets. There is no authentication Worker, review API, review JavaScript, D1 binding or password/session secret. The protected staging configuration and comment data remain separate. `scripts/verify-production.mjs` rejects a staging build or leaked review features.

Production pages permit crawling, contain a unique title and description, and point canonicals and the sitemap at the domain above. Old article URLs retain permanent redirects. `robots.txt` includes the canonical sitemap. The production Worker disables version preview URLs.

## Domain connection

The registrar can remain external. Cloudflare Workers Custom Domains require an active Cloudflare DNS zone. Add this domain to the Cloudflare account, inspect the imported DNS records against the registrar's full record list, and preserve any mail, verification or other service records. Then replace the registrar nameservers with the exact pair Cloudflare assigns. If DNSSEC is enabled, follow Cloudflare's migration procedure before changing nameservers.

After Cloudflare shows the zone as active, add `topwebdesigncanada.ca` as a Custom Domain on `topwebdesigncanada`. Cloudflare creates the DNS record and certificate. Replace an existing parking record only when ready for the cutover. Do not add a CNAME pointing the apex at a workers.dev hostname.

Use the apex domain as canonical. Connect `www.topwebdesigncanada.ca` and configure a permanent Cloudflare Redirect Rule to `https://topwebdesigncanada.ca` while preserving the path and query string. Domain-level redirects are not supported by the Worker static `_redirects` file. Verify apex/www, HTTPS, old article redirects, 404 status, robots.txt and sitemap.xml after propagation.

## Search Console

Add a Domain property for `topwebdesigncanada.ca`, copy Google's exact TXT verification record into the active DNS provider, then verify and submit `https://topwebdesigncanada.ca/sitemap.xml`. Domain-property verification does not require an HTML meta tag or a rebuild. Do not invent a verification value.

Run PageSpeed Insights on the actual domain after cutover. Local Lighthouse reports are prelaunch measurements, not public PageSpeed or real-user field data; scores can vary between runs.

## Rollback

Record the production Worker deployment/version before replacing it. `npx wrangler deployments list --name topwebdesigncanada` lists prior deployments; `npx wrangler rollback <version-id> --name topwebdesigncanada` restores one. Production rollback does not touch staging review databases.
