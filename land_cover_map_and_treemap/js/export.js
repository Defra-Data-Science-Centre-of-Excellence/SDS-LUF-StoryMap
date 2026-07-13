export function prepareEmbeddedExportTab() {
  if (!isEmbedded()) return null;
  const exportTab = window.open("", "_blank");
  if (!exportTab) {
    document.getElementById("appError").textContent =
      "Export could not open a new tab. The embedding page must allow popups.";
    return false;
  }
  try {
    exportTab.document.title = "Preparing export";
    exportTab.document.body.textContent = "Preparing export...";
  } catch {
    // navigation still works when the blank tab is not script-accessible
  }
  return exportTab;
}

function isEmbedded() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function triggerDownload(blob, name, exportTab = null) {
  const url = URL.createObjectURL(blob);
  if (exportTab) {
    exportTab.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // iframe downloads can be cancelled if blob URL is revoked immediately
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}
