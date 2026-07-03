// Content script. Only ever does two things, both triggered by a message
// from background.js after Ed right-clicks a selection: render the confirm
// form, and — once Ed clicks Confirm — hand the payload back to
// background.js to send. It never reads the page on its own initiative,
// never polls, and never re-reads the DOM after the form is shown.

const EVENT_TYPES = ["New CMO", "Brand Refresh / Rebrand", "Major ATL Campaign", "Other"];

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "enchant:show-capture-form") {
    showCaptureForm(message.selectionText || "");
  }
});

// Best-effort guess only — Sales Navigator's markup can and does change, and
// this isn't worth hardening further since Ed confirms/edits the brand
// field every time anyway. Returns "" on any failure.
function guessBrand() {
  try {
    const selectors = [
      '[data-anonymize="company-name"]',
      ".artdeco-entity-lockup__subtitle",
      ".artdeco-entity-lockup__title",
      'a[data-control-name="view_company_via_profile"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const text = el?.textContent?.trim();
      if (text) return text;
    }
  } catch {
    // ignore — this is a convenience guess, not a requirement
  }
  return "";
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function showCaptureForm(selectionText) {
  const existing = document.getElementById("enchant-capture-host");
  if (existing) existing.remove();

  const host = document.createElement("div");
  host.id = "enchant-capture-host";
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;";
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });

  root.innerHTML = `
    <style>
      .overlay { position:fixed; inset:0; background:rgba(15,15,15,0.45); display:flex; align-items:center; justify-content:center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .card { background:#fff; color:#1a1a1a; width:380px; max-width:90vw; border-radius:12px; padding:20px; box-shadow:0 20px 50px rgba(0,0,0,0.35); }
      .card h2 { margin:0 0 14px; font-size:16px; }
      label { display:block; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:#666; margin:10px 0 4px; }
      textarea, input, select { width:100%; box-sizing:border-box; padding:8px 10px; border-radius:8px; border:1px solid #ccc; font-size:13px; font-family:inherit; }
      textarea { resize:vertical; min-height:70px; }
      .actions { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }
      button { padding:8px 14px; border-radius:8px; border:1px solid #ccc; background:#fff; cursor:pointer; font-size:13px; }
      button.primary { background:#1d4ed8; border-color:#1d4ed8; color:#fff; }
      button:disabled { opacity:0.5; cursor:default; }
      .error { color:#c0392b; font-size:12px; margin-top:8px; }
    </style>
    <div class="overlay">
      <div class="card">
        <h2>Add to Brand Histories</h2>
        <label for="brand">Brand</label>
        <input id="brand" type="text" placeholder="Company name" />
        <label for="eventType">Event type</label>
        <select id="eventType">
          <option value="" selected disabled>Choose one…</option>
          ${EVENT_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("")}
        </select>
        <label for="date">Date</label>
        <input id="date" type="date" />
        <label for="note">Note</label>
        <textarea id="note"></textarea>
        <div class="error" id="error" style="display:none;"></div>
        <div class="actions">
          <button id="cancel">Cancel</button>
          <button id="confirm" class="primary">Save</button>
        </div>
      </div>
    </div>
  `;

  const $ = (sel) => root.querySelector(sel);
  $("#brand").value = guessBrand();
  $("#date").value = todayISO();
  $("#note").value = selectionText;

  $("#cancel").addEventListener("click", () => host.remove());
  root.querySelector(".overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("overlay")) host.remove();
  });

  $("#confirm").addEventListener("click", async () => {
    const brand = $("#brand").value.trim();
    const eventType = $("#eventType").value;
    const date = $("#date").value;
    const note = $("#note").value.trim();
    const errorEl = $("#error");
    errorEl.style.display = "none";

    if (!brand) return showError("Brand is required.");
    if (!eventType) return showError("Choose an event type.");
    if (!date) return showError("Date is required.");

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.style.display = "block";
    }

    const confirmBtn = $("#confirm");
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Saving…";

    chrome.runtime.sendMessage(
      { type: "enchant:submit-capture", payload: { brand, eventType, date, note } },
      (response) => {
        host.remove();
        showToast(response?.ok ? "Saved to Brand Histories." : `Couldn't save: ${response?.error || "unknown error"}`, !response?.ok);
      }
    );
  });
}

function showToast(message, isError) {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;";
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      .toast {
        position: fixed; bottom: 24px; right: 24px;
        background: ${isError ? "#c0392b" : "#0f9d58"}; color: #fff;
        padding: 10px 16px; border-radius: 8px; font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 8px 24px rgba(0,0,0,0.25);
      }
    </style>
    <div class="toast">${message}</div>
  `;
  setTimeout(() => host.remove(), 3500);
}
