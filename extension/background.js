// Background service worker. This is the only place that ever talks to the
// app's API — it runs in its own chrome-extension:// context, so it isn't
// bound by LinkedIn's page CSP, and with host_permissions granted for the
// app's origin Chrome exempts it from standard CORS checks too. Nothing in
// this file runs on a timer or watches the page; it only ever acts in
// response to a context-menu click or a message from content.js, both of
// which trace back to Ed clicking something.

const MENU_ID = "enchant-add-to-brand-histories";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Add to Brand Histories",
    contexts: ["selection"],
    documentUrlPatterns: ["https://www.linkedin.com/sales/*"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  chrome.tabs.sendMessage(tab.id, {
    type: "enchant:show-capture-form",
    selectionText: info.selectionText ?? "",
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "enchant:submit-capture") return;

  (async () => {
    const { appUrl, apiToken } = await chrome.storage.local.get(["appUrl", "apiToken"]);
    if (!appUrl || !apiToken) {
      sendResponse({ ok: false, error: "Set the App URL and API token in the extension's toolbar popup first." });
      return;
    }

    try {
      const res = await fetch(`${appUrl.replace(/\/+$/, "")}/api/extension/brand-histories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify(message.payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        sendResponse({ ok: false, error: data.error || `Request failed (${res.status})` });
        return;
      }
      sendResponse({ ok: true });
    } catch (err) {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : "Network error" });
    }
  })();

  return true; // keep the message channel open for the async sendResponse above
});
