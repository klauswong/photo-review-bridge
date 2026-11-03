# Photo Review · Google Photos HUD

**v0.4.7** adds a local HUD directly to Google Photos. Lightroom is no longer part of the active workflow. No photo uploads or deletion, Google metadata edits, private APIs or server are used.

## Install

1. Download or clone the source into a stable folder. If using an archive, extract it first.
2. Open `chrome://extensions` in desktop Chrome and enable Developer mode.
3. Choose **Load unpacked** and select the folder containing manifest.json.
4. Open your signed-in Google Photos page and click the extension toolbar icon.

No server, API key, cookie export or developer OAuth registration is needed. npm dependencies are for development tests only.

## Try the update

1. Keep the loaded extension folder at a stable location on your machine.
2. In the old workspace, click **Apply local update**. Alternatively, click Reload for Photo Review Bridge at `chrome://extensions`.
3. Reload Google Photos once, then click the extension icon. The HUD appears in the lower-right corner.
4. Choose a saved local review library from the HUD dropdown, or choose New review library and name it, such as Personal. **Use different names for different Google accounts.** The name is chosen by you; it is not verified against Google's account identity. The browser remembers the choice per Google account URL slot, which can change if accounts are reordered.
5. Open a photo. Choose **Accept** or **Reject**, and an optional 1–5 star rating. Choose the same decision or score again to clear it; rating 0 means no rating and has no button. There is no automatic advance.
6. Return to the grid. Check any combination of **Accepted / Rejected / Unreviewed** and **Unrated / 1 / 2 / 3 / 4 / 5**, then **Select matches & scroll**. The HUD adds matching photos to the existing selection; it never clears unrelated selections. Check Google's selection before taking any further action yourself.

Keyboard: **A** Accept, **R** Reject, **U** clear decision, **1–5** rate, **0** clear rating. **H** hides/shows the HUD and **?** opens settings. Review shortcuts apply only with the HUD expanded on an individual photo; typing, composing text and modifier shortcuts are ignored. H and ? still work from the minimized HUD. Review shortcuts pause in settings or comparison. Repeating A/R or a score toggles it off; U/0 always clear the corresponding field. **Left/Right and Escape are passed through unchanged to Google Photos**; the HUD does not implement or guarantee navigation itself. Rating uses buttons instead of an arrow-consuming dropdown.

The compact HUD follows the system's light/dark appearance automatically. Its background defaults to **85% opacity**; **Settings → Appearance → HUD background opacity** adjusts it from 75–100%, saved locally across libraries/tabs. Text stays fully opaque. Reduced-transparency system preferences override the translucent background with an opaque surface where the browser supports that media query. These are appearance preferences, not edits to photos.

Review-decision checkboxes are optional. Checked decisions use OR; with none checked, any decision qualifies and only the rating checks narrow the matches. **Ratings only** clears the decision checks in one click. Rejected remains the initial selection. Empty rating checks still match nothing.

Rating filters use exact checked values: checking 3 and 5 includes those ratings and excludes 4; checking Unrated includes zero/unset ratings. All are checked initially. Clearing every rating checkbox matches nothing and disables selection. Filters stay while navigating the page but reset on a full tab reload.

## Reuse a library for another round

The HUD dropdown and Settings → Review library list saved library names, including empty libraries created in this version. Existing names are discovered from stored reviews and account-slot choices. Choosing a name restores its own reviews immediately; New review library opens the creation form. These are local review libraries, not a Google Photos album picker.

For a fresh round without removing saved photo links, use Settings → Start another review round:

1. Check the active library and reviewed-photo count.
2. Click **Clear this round’s reviews**.
3. Confirm the displayed count/name, or Cancel.

Only that library’s Accept/Reject decisions and ratings reset to Unreviewed / no rating. Photo IDs/links, other libraries, opacity and older Lightroom data are kept. Google Photos and its current native selection are unchanged; clear that selection in Google Photos yourself when needed for a fresh selection round. The library is ready to review again without retyping its name.

There is no automatic round history or Undo. Export a backup first to keep a record of the old round. Standard restore keeps newer entries, including a later round reset. If reviews change after confirmation was opened, the clear operation refuses the stale snapshot and asks you to check again. A failed storage write leaves the old reviews intact.

## If pinning still fails

Pinning accepts the exact HTTPS image host `photos.fife.usercontent.google.com`. Existing approved image sources are unchanged; arbitrary Google or lookalike domains are not added. **Copy pin details** remains available if another source fails.

1. Apply this local update and retry Pin A/B.
2. If it fails, click **Copy pin details**, then include the text in a bug report. If clipboard access is blocked, copy the selected read-only text shown in the HUD.

The diagnostic includes only a reader marker, runtime version, failure category, source scheme/host/origin and pixel dimensions. Full URLs, paths, query strings, fragments, credentials, filenames, photo IDs and image payloads are excluded. Nothing is persisted or automatically sent anywhere. A new pin attempt hides the previous diagnostic controls. This lets us distinguish an unsupported source from an old script or failed temporary-image copy without guessing another host allowance.

## Remove an old library

Open Settings, choose the local library, then **Delete library…**. Check its name and total saved-link count, then confirm **Delete library permanently** or Cancel. This removes the library's local reviews, saved photo links, name and every account-slot binding that used it. Other libraries, appearance preferences, older Lightroom data and Google Photos remain unchanged.

The result reports how much library data was removed when Chrome supplies that count. Libraries store text metadata, not photo files. Deletion frees those records from extension storage; it does not remove photos or browser image caches. There is no Undo; export first if you need a backup. A changed confirmation is refused, and failed removal leaves records and library choices available.

After deletion, select another saved library or create one. Empty names remain reusable and a deliberately recreated name starts without the deleted records. The name catalogue now uses individual registration keys, migrating the old shared array without losing other empty libraries. Stale tabs cannot save into a library whose active binding was deleted.

## Settings and A/B comparison

The SVG settings button at the HUD's top right opens a larger, solid settings panel. It contains the review-library chooser, appearance, keyboard help, backups and local updates. Closing it returns focus to the HUD.

For comparison:

1. Open an individual photo and click **Pin A**.
2. Navigate to a second photo and click **Pin B**.
3. Click **Compare**. Choose **Side by side** or **Overlay**.
4. In Overlay, click the image or **Show B over A / Hide B** to alternate the pinned images. Each image is fitted without cropping; this is not automatic pixel alignment or a difference heatmap.

Pinning uses one large, fully loaded image actually visible in the viewer. Same-origin browser-generated `blob:` images are copied into an owned in-tab Blob URL before navigation; this supports a reproduced source type rejected by v0.4.4. Offscreen preload images are ignored; overlapping ambiguous images are rejected. Unsupported rendering or expired image URLs require reopening and repinning the photo. The real Google Photos image adapter still needs live validation.

Pinned images stay only in this tab's memory, using its normally rendered image URLs or an owned temporary copy of a same-origin Blob. Owned URLs are revoked on replacement, clear, library change/reset/deletion or page exit. They are not written to storage or backups and are cleared on page reload, changing libraries, or **Clear pinned images**. No canvas, file export, upload, private API or external image service is used. Only displayed same-origin Blob URLs are fetched from browser memory; ordinary HTTPS images are not fetched through this helper. Comparison can re-render the existing image URL through the browser's normal image loading.

## Local memory and limits

- Decisions, stars and photo links are stored in **extension-owned `chrome.storage.local`**, keyed by your named library and the photo ID from its web URL. Nothing is written to Google's metadata.
- Standard library and album photo URL forms normalize to the same photo ID. Google's actual cross-view identity stability is **not guaranteed by a public API and remains unverified live**.
- Multiple HUD tabs serialize updates through the extension worker, so editing a decision does not replace a concurrently saved star rating.
- **Select matches & scroll** freezes the matching saved IDs, starts a scan of this view from the top, scrolls to trigger lazy loading and confirms readable checkboxes. It stops once all known saved targets are confirmed, after at most two complete scans of this view, or at the backup limits of 120 scroll steps / 2 minutes / 10,000 encountered IDs. Reaching a stable bottom retries from the top once; a second completed scan stops even if photos are missing, since those targets may be in another album/view. Ambiguous controls are reported unsupported; an unconfirmed click stops the scan rather than being retried. Stop, route changes and library changes interrupt the operation.
- The result reports **confirmed N of M target matches**. Matches saved from a different album may be absent from this view: missing IDs produce a partial result, not success. When matching unknown Unrated/Unreviewed photos, the count covers encountered photos only, not a verified whole-library total. Existing unrelated selections are excluded from the target count and kept. Scrolling may leave you at a different position in the grid.
- Selection is additive. A stopped/partial operation leaves already selected photos selected; the result states confirmed, existing, unsupported and unattempted counts.
- Saved matches provide links for revisiting reviewed photos. The list shows at most the latest 100 matches; export includes all reviews in the chosen library.
- No cloud/browser sync. Removing the extension or clearing its storage loses local reviews. Under **Settings → Local data & backup**, export JSON regularly. Restore merges a valid backup for the same library and keeps newer saved decisions. Backups include private photo links; keep them local.
- Google account URL slots (`/u/0`, `/u/1`, etc.) are not permanent account identities. Check your named review library whenever switching accounts.

**Verification:** 72 automated tests and syntax checks pass. Installed Chromium checks use synthetic photos and locally fulfilled pages. Live Google Photos layouts, account identity and selection behavior are not comprehensively verified; start with a small pilot. See VERIFICATION.md for coverage and limits.

## Local updates

**One-time bootstrap for v0.4.3:** use the older Settings → Apply local update (or Reload at chrome://extensions), then reload Google Photos once. This loads the new refresh control.

After that, the SVG **refresh button in the HUD header** applies local files and automatically refreshes only the Google Photos tab where it was clicked. Reviews are already saved locally; the extension waits for queued review saves before reloading. **Tab-only comparison pins and Google's current selection are cleared by the page refresh.** Filters reset to their defaults; saved decisions, ratings, review library and opacity remain.

The HUD checks its own local unpacked `manifest.json` when visible on startup/focus and once per minute while visible. The header update button is hidden initially, when up to date, and if checking fails. A newer numeric version reveals it with a version-specific accessible label. Manual same-version refresh stays in Settings. No update server, download, install or publication is involved. Developers must edit this same loaded folder and bump the manifest version for automatic detection. The button can also refresh same-version edits manually.

Only local extension resources are readable by the version checker (`connect-src 'self'`); external network connections from extension pages remain blocked. A durable, expiring marker carries only the requesting tab ID across extension reload. Unrelated tabs are not automatically reloaded. Their older HUD context may be invalidated by the extension reload; the header button remains hidden because that old context cannot verify a newer version. Open Settings and use Refresh this tab to recover directly without the invalidated messaging API.

Edit this same loaded folder, then apply the update. The old workspace and the new launcher both have an update button. The HUD also offers **Apply local update** under **Settings → Local data & backup**; it uses the same automatic extension-and-requesting-tab refresh flow. Developer mode must stay on. Do not reinstall or change the loaded path.

The earlier Lightroom decisions remain under their original storage key and are not migrated into Google photo reviews. Earlier adapter sources/tests are retained as historical compatibility fixtures; the active manifest requests only Google Photos host access and loads no Lightroom script.

## Development

Plain JavaScript MV3 extension; no build or dev server. `npm test` and `npm run check`. `hud-core.js` holds identity/validation, `hud-store.js` serializes durable writes, `hud.js` renders the isolated Shadow DOM HUD, and `background.js` opens it and handles local saves. No new permission was added; Lightroom host access was removed.

## Contributing and publication

Use synthetic photos, accounts and IDs in tests, screenshots and issues. Do not commit review backups, browser profiles, authentication state, real photo links or private handovers. Local review storage is separate from the source folder; source publication does not require exporting that storage.

The project includes ignore rules for common local artifacts. Inspect files before committing to ensure no private data is included.

## License

No license has been selected yet.
