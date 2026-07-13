const READY_MESSAGE = "land-cover-export-ready";
const DOWNLOAD_MESSAGE = "land-cover-export-download";
const pendingExports = new Map();

window.addEventListener("message", event => {
  if (event.origin !== window.location.origin || event.data?.type !== READY_MESSAGE) return;
  const target = pendingExports.get(event.data.token);
  if (!target || event.source !== target.tab) return;
  target.ready = true;
  window.clearTimeout(target.loadTimeout);
  sendToHelper(target);
});

export function prepareExport() {
  if (!isEmbedded()) return null;

  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const helperUrl = new URL("./export-download.html", import.meta.url);
  helperUrl.searchParams.set("token", token);
  const tab = window.open(helperUrl.href, "_blank");
  if (!tab) {
    showExportError("Export could not open a download tab. The embedding page must allow popups.");
    return false;
  }

  const target = { token, tab, ready: false, payload: null, loadTimeout: null };
  target.loadTimeout = window.setTimeout(() => {
    if (!pendingExports.delete(token)) return;
    if (!tab.closed) tab.close();
    showExportError("The download tab did not load. Please try the export again.");
  }, 30000);
  pendingExports.set(token, target);
  return target;
}

export function deliverExport(blob, name, target) {
  if (target === null) {
    triggerDownload(blob, name);
    return;
  }
  if (!target || target.tab.closed) {
    showExportError("The download tab was closed before the export was ready.");
    return;
  }
  target.payload = { blob, name };
  sendToHelper(target);
}

function sendToHelper(target) {
  if (!target.ready || !target.payload) return;
  target.tab.postMessage(
    { type: DOWNLOAD_MESSAGE, token: target.token, ...target.payload },
    window.location.origin,
  );
  pendingExports.delete(target.token);
}

function isEmbedded() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function showExportError(message) {
  const error = document.getElementById("appError");
  if (error) error.textContent = message;
}

function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // keep the URL alive long enough to start the download.
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 60000);
}
