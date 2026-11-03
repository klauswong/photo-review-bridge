# Photo Review Bridge

A local Chrome Manifest V3 extension that adds a review HUD to Google Photos. Plain JavaScript, HTML and CSS; no build step or server.

## Development

- Read README.md and PRODUCT.md before changing behavior.
- Use `npm ci`, `npm test` and `npm run check`. Development requires Node.js 24 or later.
- Keep changes focused. Do not add a framework, build service or permissions without a concrete need.
- Do not commit, publish or upload anything without the maintainer's instruction.

## Privacy and scope

- Reviews belong in extension-owned `chrome.storage.local`, not source files.
- Never add photo deletion, trash, uploads, private service APIs or metadata rewriting.
- Local library removal is supported and must affect only the selected library's metadata.
- Never commit browser profiles, authentication state, cookies, credentials, review exports, real photo links or private screenshots.
- Store machine-specific handovers and authentication instructions outside the checkout.
- Diagnostics must exclude full image URLs, paths, queries, credentials, filenames, photo IDs and image payloads.
- Pin comparison images only in tab memory. Revoke owned Blob URLs when replaced or cleared.

## Data integrity

- Use the serialized worker operations in hud-store.js for review writes, restore, library choice, round reset and library deletion.
- Preserve other libraries, preferences and native Google Photos selections when clearing local metadata.
- Reset/deletion need explicit scope, counts, confirmation and stale-snapshot checks.
- Keep library selection explicit: URL account slots are not permanent account identities.
- Use one filter predicate for the saved list, loaded counts and selection targets. Empty decision checks mean any decision; empty rating checks mean no matches.
- Keep scrolling selection bounded to two complete sweeps, with the existing time, step and ID limits. Report missing and unsupported targets as partial results.
- Never repeat an unconfirmed selection click or toggle an already selected item off.

## Verification

- For a bug, reproduce before fixing it and add a meaningful regression test.
- Use synthetic photos and account data in automated tests and public evidence.
- Browser testing must use an owned test context. Do not interrupt another person's browser or reuse credentials across unrelated services/environments.
- Obtain an independent browser critique for rendered UI changes, and address material findings.
- Distinguish synthetic browser evidence from live account validation. Do not claim live-site support from fixtures alone.
- Keep native Google Photos navigation keys available and preserve keyboard behavior in input fields.

The active runtime is documented in PRODUCT.md. Earlier Lightroom adapters and fixtures remain historical compatibility code; do not restore their host access accidentally.
