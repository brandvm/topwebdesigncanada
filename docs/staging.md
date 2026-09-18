# Staging

[Open protected staging](https://topwebdesigncanada-staging.hamoun-ce6.workers.dev/) · [Open comment mode](https://topwebdesigncanada-staging.hamoun-ce6.workers.dev/?mode=review)

Repository: https://github.com/brandvm/topwebdesigncanada

The shared password is in the private local delivery file, never in Git. Sessions expire after 12 hours. The Worker authenticates pages, assets and review API requests; all responses use noindex headers.

Default-branch pushes update this URL. Same-repository pull requests produce protected version URLs in the GitHub Actions summary. Each PR uses its own comment scope in this site's D1 database. A thread's original revision and viewport remain stored after deployments.

Production domain mapping remains disabled. See README.md for editing and rollback instructions.
