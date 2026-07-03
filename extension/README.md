# Enchant Brand Histories Capture

A small personal-use Chrome extension. It only ever acts when you click
something — no background polling, no auto-reading of the LinkedIn feed, no
automation of the LinkedIn session. It reads a text selection you make on a
Sales Navigator page only when you right-click it and choose "Add to Brand
Histories," and only sends anything after you've confirmed or edited the
details in the popup that appears. Nothing runs automatically.

## Install (one-time, "load unpacked" — no Chrome Web Store needed)

1. In the app, open **Brand Histories** and use the "Sales Navigator
   capture" panel to generate a token. **Copy it immediately** — it's only
   shown once.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select this `extension/` folder.
5. Click the extension's toolbar icon (you may need to pin it via the
   puzzle-piece icon in Chrome's toolbar first) — this opens a settings tab.
   Paste in:
   - **App URL** — your deployed app's URL (e.g.
     `https://enchant-outreach-tracker.onrender.com`), no trailing slash
     needed.
   - **API token** — the token from step 1.
6. Click **Save**. Chrome will show a one-time permission prompt asking to
   allow the extension to talk to that URL — approve it. (The extension
   doesn't know your app's domain ahead of time, so it only asks for
   permission to the specific URL you enter here, rather than requesting
   broad access up front.)

## Using it

1. On any Sales Navigator page (feed, profile, company), select the
   relevant text — a post, a headline, a "started new position" notice.
2. Right-click the selection → **Add to Brand Histories**.
3. A small form appears pre-filled with the selected text as the note, a
   best-guess at the brand name if one could be found nearby on the page
   (this is a rough guess only — check and correct it), today's date, and
   an event type dropdown with nothing pre-selected.
4. Adjust anything, or cancel entirely — nothing is sent until you click
   **Save**.
5. A brief toast confirms it was saved, without leaving the page.

Entries land in Brand Histories tagged `source: sales_nav_feed`, already
confirmed (since you've just reviewed it in the popup) — they contribute to
the priority boost for that brand's contacts the same way manually-added
entries do.

## If it stops working

- **"Set the App URL and API token..."** — reopen the settings tab (click
  the toolbar icon) and re-save both fields.
- **401 / "invalid API token"** — the token was regenerated in the app
  since you last set this up (generating a new one invalidates the old
  one). Generate a fresh token and paste it in again.
- **The context-menu item doesn't appear** — it's only shown when you have
  text selected on a `linkedin.com/sales/...` page. Reload the extension
  from `chrome://extensions` if you've just updated these files.
- **Sales Navigator's brand-name guess is empty or wrong** — expected and
  fine, just type the brand in manually. `content.js`'s `guessBrand()`
  function uses a couple of rough DOM selectors that may stop matching if
  LinkedIn changes its markup; it's deliberately not hardened further,
  since you confirm the brand every time regardless.
