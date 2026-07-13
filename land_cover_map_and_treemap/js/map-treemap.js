// map-treemap.js — linked map and treemap page wiring.

import { render, fmtPct } from "./treemap.js";
import { loadMapIdRasters, renderMap, updateSelectedRegionOpacity } from "./map.js";

const assetRoot = document.body.dataset.assetRoot?.replace(/\/+$/, "");
const assetUrl = path => assetRoot ? `${assetRoot}/${path}` : path;
const DATA_URL = assetUrl("data/land-use-treemap.json");
const MAP_URL = assetUrl("data/map-geometry.json");
const PNG_EXPORT_SCALE = 1.5;
const classesOnly = document.body.dataset.classesOnly === "true";

const state = {
  view: null,
  previewView: null,
  mode: "classes",
  drill: null,
  isolation: null,
  regionOpacity: 0.62,
  isolationOpacity: null,
};

let data;
let mapData;
let rendering = false;
let mapSelectionFrame = null;
let opacityFrame = null;

const mapEl = document.getElementById("map");
const chartEl = document.getElementById("chart");
const tooltip = document.getElementById("tooltip");
const crumbEl = document.getElementById("crumb");
const viewSelect = document.getElementById("viewSelect");
const mapStatusEl = document.getElementById("mapStatus");
const regionOpacity = document.getElementById("regionOpacity");
const regionOpacityControl = document.getElementById("regionOpacityControl");
const regionOpacityValue = document.getElementById("regionOpacityValue");

async function boot() {
  [data, mapData] = await Promise.all([
    fetchJson(DATA_URL),
    fetchJson(MAP_URL),
  ]);

  state.view = data.defaultView ?? "national";
  populateViews();
  wireControls();
  update();
  scheduleIdRasterWarmup();
}

function scheduleIdRasterWarmup() {
  const warm = () => loadMapIdRasters(mapData, "classes").catch(error => {
    console.warn("Could not warm the class isolation raster:", error);
  });
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(warm, { timeout: 2000 });
  } else {
    window.setTimeout(warm, 250);
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function populateViews() {
  const ordered = [
    state.view,
    ...mapData.regions.map(r => r.alt),
    ...Object.keys(data.views),
  ].filter((v, i, arr) => v && arr.indexOf(v) === i && data.views[v]);

  ordered.forEach(v => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = displayView(v);
    viewSelect.appendChild(o);
  });
  viewSelect.value = state.view;
}

function update(options = {}) {
  const { renderMapPanel: shouldRenderMapPanel = true } = options;
  const current = currentView();
  tooltip.style.display = "none";
  rendering = true;
  try {
    if (shouldRenderMapPanel) {
      renderMapPanel();
    }
    render(chartEl, data, {
      view: current,
      mode: classesOnly ? "classes" : state.mode,
      geography: false,
      drill: state.drill,
      selectedClass: state.isolation,
    }, { onHover, onLeave, onSelect: onTreemapSelect });
    updateHeading();
    updateCrumb();
    updateRegionOpacityControl();
    viewSelect.value = current;
  } finally {
    rendering = false;
  }
}

function renderMapPanel() {
  const selectedView = state.view ?? data.defaultView;
  renderMap(mapEl, mapData, {
    ...state,
    viewData: data.views[selectedView] ?? data.views[data.defaultView],
  }, {
    onPreview,
    onSelect: onMapSelect,
    onClear: onMapClear,
  });
}

function currentView() {
  return state.previewView ?? state.view;
}

function displayView(view) {
  return view === "national" ? "National" : view;
}

function onPreview(view) {
  if (rendering) return;
  if (state.previewView === view) return;
  state.previewView = view;
  update({ renderMapPanel: false });
}

function onMapSelect(view) {
  state.previewView = null;
  state.view = state.view === view ? data.defaultView : view;
  scheduleMapSelectionUpdate();
}

function onMapClear() {
  if (!clearSelections()) return;
  scheduleMapSelectionUpdate();
}

function scheduleMapSelectionUpdate() {
  cancelPendingMapSelection();
  mapSelectionFrame = requestAnimationFrame(() => {
    mapSelectionFrame = null;
    update();
  });
}

function cancelPendingMapSelection() {
  if (mapSelectionFrame === null) return;
  cancelAnimationFrame(mapSelectionFrame);
  mapSelectionFrame = null;
}

function onTreemapSelect(clsName) {
  // A map click is committed on the next animation frame. If the treemap is
  // clicked before that frame runs, let this selection own the redraw.
  cancelPendingMapSelection();
  if (classesOnly) {
    setIsolation(state.isolation === clsName ? null : clsName);
    update();
    return;
  }
  if (state.drill) {
    clearDrill();
    update();
    return;
  }
  state.drill = clsName;
  setIsolation(clsName);
  update();
}

function clearSelections() {
  const changed = state.view !== data.defaultView || state.previewView || state.drill || state.isolation;
  state.view = data.defaultView;
  state.previewView = null;
  clearDrill();
  return changed;
}

function onHover(ev, { clsName, cellName, value, kind }) {
  if (classesOnly) {
    tooltip.innerHTML = `<div class="tt-title">${cellName}</div><div class="tt-value">${fmtPct(value)}</div>`;
    showTooltip(ev);
    return;
  }

  const view = currentView();
  let html = `<div class="tt-title">${cellName}</div>
    <div class="tt-row"><span>${kind === "sub" ? `of ${clsName}` : "share of area"}</span><span>${fmtPct(value)}</span></div>`;

  const directSubs = data.subclassMap?.[clsName];
  if (kind === "class" && directSubs && directSubs.length > 1) {
    html += `<div class="tt-sec"><b>Constituents</b>`;
    const subPct = data.subclassViews?.[view] ?? {};
    directSubs.forEach(e => {
      const subValue = +(subPct[e.name] ?? 0);
      if (subValue > 0) html += `<div class="tt-row"><span>${e.name}</span><span>${fmtPct(subValue)}</span></div>`;
    });
    html += `</div>`;
  }

  tooltip.innerHTML = html;
  showTooltip(ev);
}

function showTooltip(ev) {
  tooltip.style.display = "block";
  const r = tooltip.getBoundingClientRect();
  tooltip.style.left = Math.min(ev.clientX + 14, innerWidth - r.width - 8) + "px";
  tooltip.style.top = Math.min(ev.clientY + 14, innerHeight - r.height - 8) + "px";
}

function onLeave() {
  tooltip.style.display = "none";
}

function wireControls() {
  const modeClasses = document.getElementById("modeClasses");
  const modeSub = document.getElementById("modeSub");
  const press = (onId, offId) => {
    document.getElementById(onId).setAttribute("aria-pressed", "true");
    document.getElementById(offId).setAttribute("aria-pressed", "false");
  };
  if (modeClasses && modeSub) {
    modeClasses.onclick = () => {
      state.mode = "classes";
      clearDrill();
      press("modeClasses", "modeSub");
      update();
    };
    modeSub.onclick = () => {
      state.mode = "subclasses";
      clearDrill();
      press("modeSub", "modeClasses");
      update();
    };
  }
  viewSelect.onchange = e => {
    setView(e.target.value);
  };
  document.getElementById("prevView").onclick = () => cycleView(-1);
  document.getElementById("nextView").onclick = () => cycleView(1);
  document.getElementById("dlSvg").onclick = downloadSvg;
  document.getElementById("dlPng").onclick = downloadPng;
  chartEl.addEventListener("click", event => {
    if (event.target.closest(".cell") || !clearSelections()) return;
    update();
  });
  document.addEventListener("pointerdown", event => {
    if (event.target.closest("#map, #chart, .toolbar, #tooltip, button, a, select, input")) return;
    if (clearSelections()) update();
  });
  const applyRegionOpacity = event => {
    const opacity = Number(event.target.value) / 100;
    if (state.isolation) state.isolationOpacity = opacity;
    else state.regionOpacity = opacity;
    updateRegionOpacityValue();
    if (opacityFrame !== null) cancelAnimationFrame(opacityFrame);
    opacityFrame = requestAnimationFrame(() => {
      opacityFrame = null;
      updateSelectedRegionOpacity(mapEl, state);
    });
  };
  regionOpacity.addEventListener("input", applyRegionOpacity);
  regionOpacity.addEventListener("change", applyRegionOpacity);
  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape" && clearSelections()) update();
  });
}

function setView(view) {
  state.view = view;
  state.previewView = null;
  update();
}

function cycleView(direction) {
  const views = [...viewSelect.options].map(option => option.value);
  if (views.length < 2) return;
  const currentIndex = Math.max(0, views.indexOf(state.view));
  const nextIndex = (currentIndex + direction + views.length) % views.length;
  setView(views[nextIndex]);
}

function updateHeading() {
  const selectedRegion = mapData.regions.find(region => region.alt === state.view);
  mapStatusEl.textContent = state.isolation
    ? `${state.isolation}${selectedRegion ? ` in ${selectedRegion.alt}` : ""} extent shown on map.`
    : "";
}

function updateRegionOpacityControl() {
  const hasSelectedRegion = mapData.regions.some(region => region.alt === state.view);
  regionOpacity.disabled = !hasSelectedRegion;
  regionOpacity.value = Math.round(activeRegionOpacity() * 100);
  updateRegionOpacityValue();
  regionOpacityControl.classList.toggle("is-disabled", !hasSelectedRegion);
}

function updateRegionOpacityValue() {
  const value = `${Math.round(activeRegionOpacity() * 100)}%`;
  regionOpacity.style.setProperty("--opacity-progress", value);
  if (!regionOpacityValue) return;
  regionOpacityValue.value = value;
  regionOpacityValue.textContent = value;
}

function activeRegionOpacity() {
  return state.isolation ? state.isolationOpacity ?? state.regionOpacity * 0.3 : state.regionOpacity;
}

function updateCrumb() {
  crumbEl.innerHTML = state.drill
    ? `<button id="back">&larr; All classes</button> - <b>${state.drill}</b>`
    : "";
  crumbEl.hidden = !state.drill;
  const b = document.getElementById("back");
  if (b) b.onclick = () => { clearDrill(); update(); };
}

function clearDrill() {
  state.drill = null;
  setIsolation(null);
}

function setIsolation(clsName) {
  if (state.isolation === clsName) return;
  state.isolation = clsName;
  state.isolationOpacity = clsName ? state.regionOpacity * 0.3 : null;
}

function slug(text) {
  return displayView(text).toLowerCase().replace(/[.\s()]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function filename(ext) {
  const mode = classesOnly ? "classes" : state.mode;
  return `map--treemap--${slug(state.view)}--${mode}.${ext}`;
}

function svgViewBox(svg) {
  const vb = svg.getAttribute("viewBox").split(/\s+/).map(Number);
  return { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
}

async function combinedSvgString() {
  const { mapSvg, treemapSvg, mapBox, treemapBox } = await exportPanels();
  const gap = 36;
  const treemapScale = mapBox.h / treemapBox.h;
  const treemapW = treemapBox.w * treemapScale;
  const outW = mapBox.w + gap + treemapW;
  const outH = mapBox.h;

  const ns = "http://www.w3.org/2000/svg";
  const outer = document.createElementNS(ns, "svg");
  outer.setAttribute("xmlns", ns);
  outer.setAttribute("viewBox", `0 0 ${outW} ${outH}`);
  outer.setAttribute("width", outW);
  outer.setAttribute("height", outH);
  outer.setAttribute("font-family", "Arial, Helvetica, sans-serif");

  const bg = document.createElementNS(ns, "rect");
  bg.setAttribute("width", outW);
  bg.setAttribute("height", outH);
  bg.setAttribute("fill", "#fff");
  outer.appendChild(bg);

  mapSvg.setAttribute("x", 0);
  mapSvg.setAttribute("y", 0);
  mapSvg.setAttribute("width", mapBox.w);
  mapSvg.setAttribute("height", mapBox.h);
  mapSvg.setAttribute("preserveAspectRatio", "none");
  treemapSvg.setAttribute("x", mapBox.w + gap);
  treemapSvg.setAttribute("y", 0);
  treemapSvg.setAttribute("width", treemapW);
  treemapSvg.setAttribute("height", mapBox.h);
  treemapSvg.setAttribute("preserveAspectRatio", "none");

  outer.appendChild(mapSvg);
  outer.appendChild(treemapSvg);
  return new XMLSerializer().serializeToString(outer);
}

async function exportPanels() {
  const mapSvg = mapEl.querySelector("svg").cloneNode(true);
  const treemapSvg = chartEl.querySelector("svg").cloneNode(true);
  await inlineSvgImages(mapSvg);

  const mapBox = svgViewBox(mapSvg);
  const treemapBox = svgViewBox(treemapSvg);
  mapSvg.setAttribute("width", mapBox.w);
  mapSvg.setAttribute("height", mapBox.h);
  treemapSvg.setAttribute("width", treemapBox.w);
  treemapSvg.setAttribute("height", treemapBox.h);
  return { mapSvg, treemapSvg, mapBox, treemapBox };
}

async function inlineSvgImages(svg) {
  const images = [...svg.querySelectorAll("image")];
  await Promise.all(images.map(async image => {
    const href = image.getAttribute("href");
    if (!href || href.startsWith("data:")) return;
    image.setAttribute("href", await imageToDataUrl(href));
  }));
}

async function imageToDataUrl(url) {
  const blob = await fetch(url).then(r => r.blob());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function downloadSvg() {
  const blob = new Blob([await combinedSvgString()], { type: "image/svg+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename("svg");
  a.click();
  URL.revokeObjectURL(a.href);
}

async function downloadPng() {
  const scale = PNG_EXPORT_SCALE;
  const { mapSvg, treemapSvg, mapBox, treemapBox } = await exportPanels();
  const pixelH = Math.round(mapBox.h * scale);
  const mapPixelW = Math.round(mapBox.w * pixelH / mapBox.h);
  const treemapPixelW = Math.round(treemapBox.w * pixelH / treemapBox.h);
  const gapPixelW = Math.round(36 * scale);
  const [mapImage, treemapImage] = await Promise.all([
    svgToImage(mapSvg),
    svgToImage(treemapSvg),
  ]);

  const c = document.createElement("canvas");
  c.width = mapPixelW + gapPixelW + treemapPixelW;
  c.height = pixelH;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(mapImage, 0, 0, mapPixelW, pixelH);
  ctx.drawImage(treemapImage, mapPixelW + gapPixelW, 0, treemapPixelW, pixelH);
  c.toBlob(b => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = filename("png");
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");
}

function svgToImage(svg) {
  const text = new XMLSerializer().serializeToString(svg);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(text);
  });
}

boot().catch(err => {
  document.getElementById("appError").textContent =
    `Could not load map assets: ${err.message}.`;
  console.error(err);
});
