# Photo Review Bridge

A Chrome extension for reviewing photos directly in Google Photos. Mark keepers and rejects, add star ratings, compare two photos and select your matches. Reviews stay in your browser.

Current version: **0.4.11**.

## Install

1. Download or clone this project. Extract it if you downloaded a ZIP.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the folder containing `manifest.json`.
4. Open Google Photos and click the extension icon to show the HUD.

No server, API key or npm installation is needed to use it.

## Review photos

1. Choose or create a **review library** in the HUD. This is a local collection of your reviews, not a Google Photos album. Use separate names for different Google accounts.
2. Open a photo. Click **Accept**, **Reject** or a rating from **1–5**.
3. Click the same choice again to clear it. Use Google Photos’ arrows to move to the next photo.

You can hide the HUD and keep reviewing with shortcuts. A small badge shows the current decision and rating. Turn it off under Settings → Appearance to show that status in the minimized button instead. If saving fails, it shows **Needs attention**; open the HUD for details.

| Key | Action |
| --- | --- |
| A / R | Accept / Reject; repeat to clear |
| U | Clear the decision |
| 1–5 | Set a rating; repeat to clear |
| 0 | Clear the rating |
| Shift+H | Hide or show the HUD |
| h / k | Previous photo |
| j / l | Next photo |
| ? | Open settings |

Review and navigation shortcuts work while the HUD is hidden. They pause in Settings, comparison and typing fields. Left/Right and Escape keep their Google Photos behavior.

## Pick up where you left off

From the list/grid view, click **Resume review** to reopen the last photo you viewed in this local library, keeping its album context when available. Your place is saved automatically and survives browser restarts. This returns to your last viewed photo, whether reviewed or unreviewed. Clearing a round or deleting the library clears its resume point.

## Find and select matches

1. Return to the Google Photos grid.
2. Choose ratings and, optionally, review decisions. **Ratings only** removes the decision filter. No rating boxes checked means no matches.
3. Click **Select matches & scroll**.

The extension scrolls the current view, confirms selections and stops after at most two sweeps. It preserves unrelated selections. Missing or unsupported photos produce a **partial count**, not a success message; they may be in another album/view. Use **Stop** to end a scan early.

Check Google Photos’ selection before taking your next action.

## Compare two photos

1. Open a photo and click **Pin A**.
2. Navigate to another photo and click **Pin B**.
3. Click **Compare** and choose **Side by side** or **Overlay**.
4. In Overlay mode, click the image or the toggle button to show/hide B over A.

Pinned images stay in tab memory. Reloading, clearing pins or changing libraries releases them. If pinning fails, **Copy pin details** provides redacted diagnostics for a bug report.

## Manage libraries and settings

Click the settings icon in the HUD’s top-right corner.

- **Switch libraries:** choose a saved name from the dropdown; empty libraries are remembered.
- **Start another round:** Clear this round’s reviews resets decisions and ratings but keeps photo links.
- **Remove a library:** Delete library permanently removes its local reviews and links after confirmation.
- **Back up:** Export reviews saves a local JSON file. Restore keeps newer entries, including later round resets. There is no automatic history or Undo.
- **Appearance:** the HUD follows system light/dark mode. Background opacity is adjustable; text stays solid. The review badge is optional.

Library reset/removal does not change Google Photos or its current selection. Backup files contain private photo links: keep them private.

## Update

Replace the files in the same loaded folder with the newer source. Keep Developer mode on.

A HUD update button appears when a newer local version is detected. Click it to reload the extension and that tab. Manual refresh is also available in Settings. Older open tabs can recover through **Settings → Refresh this tab**.

Saved reviews remain. Temporary pins, Google’s current selection and filter choices reset. Updates are local: the extension does not download new releases automatically.

## Privacy and limits

Reviews use `chrome.storage.local`; images are not saved in review storage or backups. There are no analytics, photo uploads, private API calls or Google photo-deletion controls.

Google Photos layouts and web IDs can change. Start with a small set: synthetic browser tests do not guarantee every live account or view. See [verification notes](VERIFICATION.md) for coverage and limits.

## Development

Requires Node.js 24 or later:

```sh
npm ci
npm test
npm run check
```

**76 tests** and syntax checks pass. See [PRODUCT.md](PRODUCT.md) for architecture. Use synthetic data in tests, screenshots and issues; never commit browser profiles, authentication state or review backups.

## License

No license has been selected yet.
