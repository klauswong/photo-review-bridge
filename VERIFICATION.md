# Verification

## Automated checks

From the extension folder, using Node.js 24 or later:

```sh
npm ci
npm test
npm run check
```

The current source passed **76 tests** and syntax checks. A minimized-shortcut regression failed before the v0.4.8 change and passes afterward. The Vim-navigation regression also failed before implementation and passes afterward, covering expanded/hidden navigation, keyboard guards and navigation during a delayed save. Tests use synthetic photo identifiers, filenames, account slots, image data and service responses.

Coverage includes:

- Identity validation, library separation and exact combined filters.
- Serialized writes, independent-field preservation, restore validation and storage failures.
- Empty-library discovery, catalogue migration, stale confirmations, scoped reset/removal and stale-write rejection.
- Resume-point validation, album context, out-of-order visits, library isolation, reset/removal cleanup, grid/reload persistence, list-only Resume visibility and optional badge visibility. The list-only visibility assertion failed before the v0.4.11 fix and passes afterward.
- Keyboard guards, review shortcuts while minimized, current-photo navigation, settings feedback, update visibility and requesting-tab recovery.
- Redacted pin diagnostics, approved image sources, lookalike rejection and temporary Blob URL cleanup.
- Lazy-loaded selection, repeated selection, Stop, partial counts, bounded scans and two completed sweeps.
- Historical CSV and Lightroom-reader compatibility behavior.

## Installed-browser evidence

The extension was exercised in isolated Chromium test profiles against locally fulfilled synthetic Google Photos pages. No real account credentials or private photos are required for these checks. The synthetic page is committed at `tests/fixtures/hud-review-demo.html`; browser tests fulfill Google Photos page requests locally with this file while loading the unpacked extension.

Observed behavior:

- In v0.4.11, Resume review stayed hidden on individual photos, appeared in the grid with the saved album link, and hid again after opening that link. Returning to the grid with the HUD minimized and expanding it showed the resume control correctly.

- In v0.4.10, the installed worker saved an album photo as the resume point. Grid navigation and reload retained it; clicking Resume review returned to the same album/photo. Hidden review shortcuts updated the badge, disabling it persisted across reload and restored status in the minimized control, and the 390-pixel layout had no badge/control overlap.

- In v0.4.9, Shift+H toggled the HUD; lowercase h/k moved backward and j/l forward while expanded or minimized. Settings, comparison and typing paused those keys. The synthetic page received uncancelled Left/Right events with legacy key codes; acceptance by live Google Photos remains unverified.

- Decisions and ratings persisted through navigation/reload, including second review rounds.
- Minimized review shortcuts saved against the current photo across native navigation, without opening the panel. The pill showed saving/current-state feedback, and an invalidated-context save failure showed Needs attention without changing saved data. Typing, Settings and comparison guards remained active; the narrow control fit without overflow.
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
