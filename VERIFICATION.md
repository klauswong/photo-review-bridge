# Verification

## Automated checks

From the extension folder, using Node.js 24 or later:

```sh
npm ci
npm test
npm run check
```

The current source passed **72 tests** and syntax checks. Tests use synthetic photo identifiers, filenames, account slots, image data and service responses.

Coverage includes:

- Identity validation, library separation and exact combined filters.
- Serialized writes, independent-field preservation, restore validation and storage failures.
- Empty-library discovery, catalogue migration, stale confirmations, scoped reset/removal and stale-write rejection.
- Keyboard guards, settings feedback, update visibility and requesting-tab recovery.
- Redacted pin diagnostics, approved image sources, lookalike rejection and temporary Blob URL cleanup.
- Lazy-loaded selection, repeated selection, Stop, partial counts, bounded scans and two completed sweeps.
- Historical CSV and Lightroom-reader compatibility behavior.

## Installed-browser evidence

The extension was exercised in isolated Chromium test profiles against locally fulfilled synthetic Google Photos pages. No real account credentials or private photos are required for these checks.

Observed behavior:

- Decisions and ratings persisted through navigation/reload, including second review rounds.
- Saved-library switching and empty-name retention worked. Confirmed reset/removal preserved unrelated data and native page selection.
- Concurrent changes cancelled stale confirmations with visible feedback beside the action.
- Landscape/portrait A/B images fit in both layouts. Owned temporary images survived revocation of the original Blob URLs and were revoked when cleared.
- HTTPS images on photos.fife.usercontent.google.com pinned and rendered; a suffix-lookalike host remained blocked. This regression failed before the exact-host fix and passed afterward.
- Pin diagnostics excluded full URLs, paths, query tokens, credentials, filenames, IDs and payloads. Explicit clipboard copy and a denied-clipboard fallback were exercised.
- Lazy loading added target photos while scrolling. Matching targets were clicked once, unrelated selections remained, and missing targets stopped after exactly two sweeps with a partial count.
- Local manifest changes were detected from real files in a separate test copy. Update/recovery reloaded only the clicked tab and preserved review data.
- System themes, opacity, reduced transparency, desktop layouts and a 390-pixel viewport were inspected.

The focus-triggered version check was exercised with a DOM focus event in headless Chromium. The 60-second timer path was not separately timed.

## Limits

Synthetic browser tests do not establish compatibility with every live Google Photos account, layout, language, content-security policy or virtualized grid. Actual photo rendering and selection should be checked with a small live pilot. Web identifiers and DOM controls can change without notice.

This document records functional verification, not a full security audit. Public evidence must use synthetic images and data. Authentication, private handovers, original session logs and local screenshot paths belong outside the project.
