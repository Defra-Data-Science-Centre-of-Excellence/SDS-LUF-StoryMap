// map.js - map rendering and categorical raster isolation.

const idRasterCache = new Map();
const regionMaskCache = new Map();
let rasterRequest = 0;

const MAP_ARIA_ORDER = [
  "Arable and horticulture",
  "Semi-Natural grassland",
  "Improved grassland",
  "Urban",
  "Mountain, heath and bog",
  "Broadleaved woodland",
  "Coniferous woodland",
  "Coastal and water",
  "Solar energy",
];

// load only the requested mode's ID raster - isolation data is not needed for the initial map
export async function loadMapIdRasters(mapData, mode = null) {
  const images = mode
    ? { [mode]: mapData.idImages?.[mode] }
    : mapData.idImages ?? {};
  await Promise.all(Object.values(images).filter(Boolean).map(url => loadIdRaster(url, mapData)));
}

export function updateSelectedRegionOpacity(container, state) {
  d3.select(container)
    .select(".map-regions path.is-selected")
    .attr("fill-opacity", selectedRegionOpacity(state));
}

export function renderMap(container, mapData, state, handlers = {}) {
  const host = d3.select(container);
  const mode = state.mode === "subclasses" ? "subclasses" : "classes";
  const previousSvg = host.select("svg").node();
  const previousImage = previousSvg?.querySelector("image");
  const previousHref = previousImage?.getAttribute("href");
  const previousMode = previousSvg?.getAttribute("data-raster-mode");
  const previousIsolation = previousSvg?.getAttribute("data-raster-isolation");
  const keepPreviousRaster = Boolean(
    state.isolation && previousIsolation && previousMode === mode && previousHref,
  );

  host.selectAll("*").remove();
  host.on("click.clear-selection", ev => {
    if (ev.target.closest?.(".map-regions")) return;
    handlers.onClear?.();
  });

  const activeView = state.previewView ?? state.view;
  const selectedRegion = mapData.regions.find(region => state.view === region.alt);
  const selectedOutlineWidth = 4.2;
  const hoverOutlineWidth = 3.6;

  if (selectedRegion) preloadRegionMask(selectedRegion, mapData);

  const svg = host.append("svg")
    .attr("viewBox", `0 0 ${mapData.width} ${mapData.height}`)
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .attr("role", "img")
    .attr("data-raster-mode", mode)
    .attr("data-raster-isolation", state.isolation ?? "")
    .attr("aria-label", mapAriaLabel(state));

  const backdrop = svg.append("g").attr("class", "map-backdrop");
  mapData.countries.forEach(d => {
    backdrop.append("path")
      .attr("d", d)
      .attr("fill", "#f2f2f2")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("fill-rule", "evenodd");
  });

  const rasterImage = svg.append("image")
    .attr("href", keepPreviousRaster ? previousHref : mapData.images[mode])
    .attr("x", 0).attr("y", 0)
    .attr("width", mapData.width)
    .attr("height", mapData.height)
    .attr("preserveAspectRatio", "none")
    .attr("pointer-events", "none");
  applyRasterIsolation(rasterImage, mapData, mode, state.isolation, selectedRegion);

  let hoverOutline = null;
  const regions = svg.append("g").attr("class", "map-regions");
  const showHoverOutline = region => {
    setRegionStrokesVisible(regions, false);
    preloadRegionMask(region, mapData);
    if (hoverOutline) {
      setRegionOutline(hoverOutline, region, hoverOutlineWidth);
      hoverOutline.attr("display", null);
    }
    handlers.onPreview?.(region.alt);
  };
  const hideHoverOutline = () => {
    setRegionStrokesVisible(regions, true);
    if (hoverOutline) hoverOutline.attr("display", "none");
    handlers.onPreview?.(null);
  };

  [...mapData.regions]
    .sort((a, b) => regionLayerRank(a, state, activeView) - regionLayerRank(b, state, activeView))
    .forEach(region => {
      const selected = state.view === region.alt;
      const previewed = state.previewView === region.alt;
      const active = activeView === region.alt;
      const selectedOpacity = selectedRegionOpacity(state);
      const fillOpacity = selected ? selectedOpacity : previewed || active ? 0.52 : 0;
      const inactiveStroke = mode === "classes" ? "#fff" : "#555";
      const inactiveStrokeWidth = mode === "classes" ? 2.4 : 1.7;
      const strokeWidth = selected ? 4.2 : previewed || active ? 3.2 : inactiveStrokeWidth;
      const strokeOpacity = selected || previewed || active ? 1 : 0.9;
      regions.append("path")
        .attr("d", region.d)
        .attr("class", selected ? "is-selected" : previewed ? "is-preview" : null)
        .attr("fill", region.colour)
        .attr("fill-opacity", fillOpacity)
        .attr("stroke", selected ? "#111" : previewed || active ? "#222" : inactiveStroke)
        .attr("stroke-width", strokeWidth)
        .attr("stroke-opacity", strokeOpacity)
        .attr("data-stroke-opacity", strokeOpacity)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("fill-rule", "evenodd")
        .attr("pointer-events", "all")
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr("aria-label", `${region.alt} - show land cover composition`)
        .attr("aria-pressed", selected ? "true" : "false")
        .on("pointerenter", ev => {
          d3.select(ev.currentTarget).raise();
          showHoverOutline(region);
        })
        .on("pointerleave", hideHoverOutline)
        .on("focus", ev => {
          d3.select(ev.currentTarget).raise();
          showHoverOutline(region);
        })
        .on("blur", hideHoverOutline)
        .on("click", ev => {
          ev.stopPropagation();
          handlers.onSelect?.(region.alt);
        })
        .on("keydown", ev => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            handlers.onSelect?.(region.alt);
          }
        });
    });

  // keep the national outline legible above the white ALT boundaries.
  const englandPath = svg.append("path")
    .attr("d", mapData.england)
    .attr("fill", "none")
    .attr("stroke", "dimgrey")
    .attr("stroke-width", 2.8)
    .attr("fill-rule", "evenodd")
    .attr("pointer-events", "none");

  const overlays = svg.append("g")
    .attr("class", "map-region-overlays")
    .attr("pointer-events", "none");
  const previewRegion = mapData.regions.find(region => state.previewView === region.alt);
  if (selectedRegion) drawRegionOutline(overlays, selectedRegion, selectedOutlineWidth);
  if (previewRegion) drawRegionOutline(overlays, previewRegion, hoverOutlineWidth);
  hoverOutline = makeRegionOutline(overlays, hoverOutlineWidth).attr("display", "none");

  drawAttribution(svg, mapData, englandPath);
  return svg;
}

function mapAriaLabel(state) {
  const values = state.viewData;
  if (!values) return "Land cover map of England";

  const composition = MAP_ARIA_ORDER
    .filter(name => values[name] !== undefined)
    .map(name => `${name}, ${ariaPercentage(values[name])}`)
    .join("; ");
  const region = state.view && state.view !== "national"
    ? ` for the region '${state.view}', selected with a black outline`
    : "";
  return `A thematic map of England with a matching treemap chart and legend showing broad habitat land cover categories and their proportions${region}, given as: ${composition}.`;
}

function ariaPercentage(value) {
  return value < 1 ? "less than 1%" : `${Math.round(value)}%`;
}

function selectedRegionOpacity(state) {
  return state.isolation
    ? state.isolationOpacity ?? (state.regionOpacity ?? 0.62) * 0.3
    : state.regionOpacity ?? 0.62;
}

function regionLayerRank(region, state, activeView) {
  if (state.view === region.alt) return 3;
  if (state.previewView === region.alt) return 2;
  if (activeView === region.alt) return 1;
  return 0;
}

function drawRegionOutline(parent, region, width) {
  setRegionOutline(makeRegionOutline(parent, width), region, width);
}

function makeRegionOutline(parent, width) {
  return parent.append("path")
    .attr("fill", "none")
    .attr("stroke", "#111")
    .attr("stroke-width", width)
    .attr("stroke-opacity", 1)
    .attr("stroke-linejoin", "round")
    .attr("stroke-linecap", "round")
    .attr("fill-rule", "evenodd");
}

function setRegionOutline(path, region, width) {
  path.attr("d", region.d).attr("stroke-width", width);
}

function setRegionStrokesVisible(regions, visible) {
  regions.selectAll("path")
    .attr("stroke-opacity", function () {
      return visible ? (this.getAttribute("data-stroke-opacity") ?? 0.9) : 0;
    });
}

function preloadRegionMask(region, mapData) {
  loadRegionMask(region, mapData).catch(error => console.error(error));
}

async function loadIdRaster(url, mapData) {
  if (idRasterCache.has(url)) return idRasterCache.get(url);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = mapData.width;
      canvas.height = mapData.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const ids = new Uint8Array(canvas.width * canvas.height);
      for (let i = 0; i < ids.length; i += 1) ids[i] = pixels[i * 4];
      resolve({ ids, width: canvas.width, height: canvas.height });
    };
    image.onerror = () => reject(new Error(`Could not load ID raster: ${url}`));
    image.src = url;
  });
  idRasterCache.set(url, promise);
  try {
    const raster = await promise;
    idRasterCache.set(url, raster);
    return raster;
  } catch (error) {
    idRasterCache.delete(url);
    throw error;
  }
}

function applyRasterIsolation(image, mapData, mode, isolation, region) {
  const request = ++rasterRequest;
  const selectedIds = mapData.isolationIds?.[mode]?.[isolation] ?? [];
  if (!isolation || !selectedIds.length) {
    image.attr("href", mapData.images[mode]);
    return;
  }

  const idUrl = mapData.idImages?.[mode];
  const cached = idUrl ? idRasterCache.get(idUrl) : null;
  if (!cached) {
    image.attr("href", mapData.images[mode]);
    loadMapIdRasters(mapData, mode)
      .then(() => {
        if (request === rasterRequest && image.node().isConnected) {
          applyRasterIsolation(image, mapData, mode, isolation, region);
        }
      })
      .catch(error => console.error(error));
    return;
  }

  Promise.all([
    Promise.resolve(cached),
    region ? loadRegionMask(region, mapData) : Promise.resolve(null),
  ]).then(([raster, regionMask]) => {
    if (request !== rasterRequest || !image.node().isConnected) return;
    const canvas = document.createElement("canvas");
    canvas.width = raster.width;
    canvas.height = raster.height;
    const context = canvas.getContext("2d");
    const output = context.createImageData(raster.width, raster.height);
    const selected = new Set(selectedIds);
    const colours = mapData.colourLuts?.[mode] ?? {};
    const dimmed = cssColourToRgba(isolationDimColour(colours, isolation, mapData));
    for (let i = 0; i < raster.ids.length; i += 1) {
      const id = raster.ids[i];
      const offset = i * 4;
      if (id === 0) continue;
      const rgba = selected.has(id) && (!regionMask || regionMask[i])
        ? cssColourToRgba(isolatedColour(colours[id]) ?? "#000000")
        : dimmed;
      output.data[offset] = rgba[0];
      output.data[offset + 1] = rgba[1];
      output.data[offset + 2] = rgba[2];
      output.data[offset + 3] = rgba[3];
    }
    context.putImageData(output, 0, 0);
    if (request !== rasterRequest || !image.node().isConnected) return;
    // Keep the href update in this selection turn. An asynchronous toBlob
    // callback can leave Chrome displaying the old image until the next
    // pointer event, even though the isolation state has already changed.
    image.attr("href", canvas.toDataURL("image/png"));
  });
}

function loadRegionMask(region, mapData) {
  if (regionMaskCache.has(region.alt)) return regionMaskCache.get(region.alt);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = mapData.width;
      canvas.height = mapData.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const alpha = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const mask = new Uint8Array(canvas.width * canvas.height);
      for (let i = 0; i < mask.length; i += 1) mask[i] = alpha[i * 4 + 3];
      resolve(mask);
    };
    image.onerror = () => reject(new Error(`Could not rasterise region mask: ${region.alt}`));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${mapData.width}" height="${mapData.height}" viewBox="0 0 ${mapData.width} ${mapData.height}" preserveAspectRatio="none"><path d="${region.d}" fill="#000"/></svg>`;
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  regionMaskCache.set(region.alt, promise);
  return promise;
}

function isolatedColour(entry) {
  if (typeof entry === "string") return entry;
  return entry?.isolatedColour ?? entry?.colour;
}

function isolationDimColour(colours, isolation, mapData) {
  const entry = Object.values(colours).find(value => value.name === isolation);
  return entry?.isolationDimColour ?? mapData.isolation?.dimColour;
}

function cssColourToRgba(colour) {
  const text = colour.trim().replace(/^#/, "");
  const hex = text.length === 3
    ? text.split("").map(value => value + value).join("")
    : text;
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
    hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255,
  ];
}

function drawAttribution(svg, mapData, englandPath) {
  const attribution = mapData.attribution
    ?? "© Natural England copyright.\nContains OS data © Crown copyright and database rights 2026 OS AC0000805307.";
  const lines = attribution.split(/\n+/).filter(Boolean);
  if (!lines.length) return;

  const fontSize = 22;
  const lineGap = 27;
  const englandBox = englandPath.node()?.getBBox();
  const rightEdge = englandBox ? englandBox.x + englandBox.width : mapData.width;
  const marginY = 14;
  const text = svg.append("text")
    .attr("class", "map-attribution")
    .attr("x", rightEdge)
    .attr("y", mapData.height - marginY - (lines.length - 1) * lineGap)
    .attr("text-anchor", "end")
    .attr("font-family", "Arial, Helvetica, sans-serif")
    .attr("font-size", fontSize)
    .attr("fill", "#000")
    .attr("pointer-events", "none");

  lines.forEach((line, i) => {
    text.append("tspan")
      .attr("x", rightEdge)
      .attr("dy", i ? lineGap : 0)
      .text(line);
  });
}
