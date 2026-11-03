# Photo Review Bridge

## Purpose

Review existing photos directly in Google Photos, without exporting or uploading copies. Add local Accept/Reject decisions and optional ratings, compare two images, then select photos matching those attributes.

## Interface

A compact HUD sits at the bottom right of Google Photos. It follows system light/dark appearance. A larger settings panel holds library management, appearance, shortcuts, backups and local updates.

- Accept/Reject and 1–5 ratings toggle off when selected again. Unreviewed and no rating are represented by the absence of an active choice.
- A/R/U set or clear decisions; 1–5/0 set or clear ratings. H hides/shows the HUD and ? opens settings. Review shortcuts pause in settings, comparison and the minimized HUD.
- Native Left/Right/Escape pass through unchanged. Typing and modifier shortcuts keep their normal behavior.
- Decisions are an optional OR filter; selected ratings narrow matches. No checked decisions means any decision. No checked ratings means no matches.
- A saved-library picker restores local review collections. Names are user-chosen, not Google account or album identities.

## Runtime

| File | Responsibility |
| --- | --- |
| manifest.json | Permissions, service worker and content scripts |
| hud.js | Isolated Shadow DOM HUD, image comparison and rendered-grid selection |
| hud-core.js | Identity, validation, filter and diagnostic helpers |
| hud-store.js | Serialized local writes, restore, library catalogue, reset and removal |
| hud-updates.js | Local manifest checks and requesting-tab refresh recovery |
| background.js | Toolbar entry point and validated content-script messages |
| index.html, launcher.js, style.css | Help/update launcher |

Earlier app.js, core.js, page.js and network-reader.js implementations and their tests are retained as compatibility history. The current manifest has only Google Photos host access and does not inject the Lightroom reader.

## Local data

Records contain a local library name, a Google Photos web ID/link, decision, rating and update time. Storage keys are scoped by library and photo identity. Account-slot bindings remember a chosen library but are not account authentication.

Library choices and review operations share the worker's write queue. Round reset clears only decisions/ratings after confirmation; identities remain for reuse. Library deletion validates the complete snapshot, preserves other empty library names during catalogue migration, then removes that library's records, registration and matching slot bindings. Failed removal keeps records available. Stale bound-slot saves/restores are rejected rather than recreating a removed library.

There is no automatic round history or Undo. Backups are explicit local JSON exports. Restore preserves newer values, including later round resets. Backups include private links and should not be published.

## Comparison

A/B pinning captures one dominant, complete, viewport-visible image. Offscreen preload images are ignored; ambiguous candidates are rejected. Approved HTTPS sources include the exact Photos FIFE host and the existing image-host policy. Same-origin browser-memory Blob images receive an owned temporary URL so their original URL can be revoked independently.

Comparison supports fitted side-by-side and show/hide overlay modes. It does not perform pixel alignment or difference analysis. Images and temporary URLs stay in tab memory, never review storage or backups. Owned URLs are revoked on replacement, clear, library reset/removal/change and page exit.

## Selection

Selection freezes matching saved IDs and operates through readable rendered photo links and checkboxes. It keeps unrelated selections, confirms each click and never retries an uncertain click. Lazy loading is triggered by scrolling the current view.

Stop after all known targets are confirmed, two complete sweeps, or the backup limits of 120 steps, two minutes and 10,000 encountered IDs. Route/library changes and Stop interrupt the scan. Missing targets may belong to another album/view and must produce a partial count. Unrated/unreviewed searches can include previously unknown photos; their totals cover encountered items only.

## Local updates

Check the unpacked extension's own manifest on visible startup/focus and each visible minute, with a debounce. Show the HUD update control only for a verified newer version. Settings retains manual refresh and stale-context recovery.

Applying an update waits for queued review writes, records the requesting tab, reloads the extension and refreshes that tab. Other tabs are not automatically reloaded. Saved metadata remains; page selection, comparison pins and ephemeral filters reset. There is no remote update server or automatic code download.

## Constraints

No analytics, image uploads, service credentials, cookie access, private API client or Google photo deletion. Extension-page connections are limited to local extension resources. Normal image rendering may request the same Google image resource already displayed by the site.

Browser selectors and web IDs are not a public API contract. Keep unfamiliar sources/controls blocked or unsupported, provide redacted diagnostics, and distinguish fixture results from real account testing.
