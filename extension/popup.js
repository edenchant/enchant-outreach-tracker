const appUrlInput = document.getElementById("appUrl");
const apiTokenInput = document.getElementById("apiToken");
const statusEl = document.getElementById("status");

chrome.storage.local.get(["appUrl", "apiToken"], ({ appUrl, apiToken }) => {
  if (appUrl) appUrlInput.value = appUrl;
  if (apiToken) apiTokenInput.value = apiToken;
});

document.getElementById("save").addEventListener("click", async () => {
  const appUrl = appUrlInput.value.trim().replace(/\/+$/, "");
  const apiToken = apiTokenInput.value.trim();

  statusEl.className = "";
  statusEl.textContent = "";

  if (!appUrl || !apiToken) {
    statusEl.className = "error";
    statusEl.textContent = "Both fields are required.";
    return;
  }

  let origin;
  try {
    origin = new URL(appUrl).origin;
  } catch {
    statusEl.className = "error";
    statusEl.textContent = "App URL doesn't look like a valid URL.";
    return;
  }

  // The manifest only declares optional_host_permissions, since we don't
  // know Ed's exact app domain ahead of time — request it for the specific
  // origin he's entered, prompting Chrome's native one-time permission
  // dialog rather than asking for broad access up front.
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
  if (!granted) {
    statusEl.className = "error";
    statusEl.textContent = "Permission for that URL was declined — capture won't work without it.";
    return;
  }

  await chrome.storage.local.set({ appUrl, apiToken });
  statusEl.textContent = "Saved.";
});
