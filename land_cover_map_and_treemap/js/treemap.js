/*
 * treemap.js — rendering.
 * render(container, data, state, handlers).
*/
import {
  CLASS_COLOUR, LEGEND_ORDER, GROUPING, SYMBOLS,
  LAYOUT, LABEL_PX, GEO_PATTERNS, PATTERN_OPACITY, patternId,
} from "./config.js";

const { W, H, SCALE, LABEL_MIN_PCT, SUB_PAD, LEGEND_H, LEGEND_GAP, MIN_STRIP_PX } = LAYOUT;
const SUBCLASS_FILL_OPACITY = 0.72;
const SUB_INSET = Math.max(6, SUB_PAD);
const SUB_GAP = 2.2;
const SELECTED_CELL_FILTER = "selected-cell-shadow";
const SELECTED_OUTLINE_INSET = 2.4;

// data shaping

export function classPctForView(data, view) {
  return data.views[view];
}

function subclassEntries(data, pct, view, cls) {
  const entries = data.subclassMap[cls] ?? [{ name: cls, colour: CLASS_COLOUR[cls] }];
  const values = data.subclassViews[view] ?? {};
  const mapped = entries.map((e, i, arr) => ({
    ...e,
    kind: "sub",
    parentClass: cls,
    subIndex: i,
    subCount: arr.length,
    value: +(values[e.name] ?? 0),
  }));
  const total = d3.sum(mapped, e => e.value);
  if (total > 0 || (pct[cls] || 0) <= 0) return mapped;
  return [{
    name: cls, kind: "sub", parentClass: cls,
    subIndex: 0, subCount: 1, value: pct[cls],
    colour: CLASS_COLOUR[cls],
  }];
}

export function subclassColour(data, cls, sub, i, n, entry = null) {
  const given = entry?.colour ?? data.subclassMap?.[cls]?.find(e => e.name === sub)?.colour;
  if (given) return given;
  const base = d3.hsl(CLASS_COLOUR[cls]);
  const spread = n === 1 ? 0 : (i / (n - 1) - 0.5) * 0.22;
  return d3.hsl(base.h, base.s, Math.max(0.14, Math.min(0.86, base.l + spread))).formatHex();
}

function fillSpecKey(fill) {
  return JSON.stringify(fill, Object.keys(fill).sort());
}

function defineSubclassFillPatterns(defs, data) {
  const fillIds = new Map();
  const entries = Object.values(data.subclassMap ?? {}).flat();
  entries.forEach(entry => {
    if (!entry.fill) return;
    const key = fillSpecKey(entry.fill);
    if (fillIds.has(key)) return;
    const id = `sub-fill-${fillIds.size}`;
    fillIds.set(key, id);
    const size = entry.fill.size ?? 8;
    const pat = defs.append("pattern")
      .attr("id", id)
      .attr("width", size)
      .attr("height", size)
      .attr("patternUnits", "userSpaceOnUse");
    if (entry.fill.base) {
      pat.append("rect").attr("width", size).attr("height", size).attr("fill", entry.fill.base);
    }
    if (entry.fill.type === "hatch") {
      const d = entry.fill.direction === "\\"
        ? `M0,0 L${size},${size}`
        : `M0,${size} L${size},0`;
      pat.append("path")
        .attr("d", d)
        .attr("stroke", entry.fill.stroke ?? "#000")
        .attr("stroke-width", entry.fill.strokeWidth ?? 1.2)
        .attr("fill", "none");
    }
  });
  return fillIds;
}

function subclassFill(data, entry, fillIds) {
  if (entry.fill) return `url(#${fillIds.get(fillSpecKey(entry.fill))})`;
  return subclassColour(data, entry.parentClass, entry.name, entry.subIndex, entry.subCount, entry);
}

function geographyShares(data, cls) {
  // normalised share of this class attributable to each region, or null.
  const shares = data.geography?.shareByClass?.[cls];
  if (!shares) return null;
  const total = d3.sum(shares);
  return total > 0 ? shares.map(s => s / total) : null;
}

function buildHierarchy(pct) {
  const groups = [];
  for (const [gname, cats] of Object.entries(GROUPING)) {
    const children = cats
      .filter(c => (pct[c] || 0) > 0)
      .map(c => ({ name: c, kind: "class", value: pct[c], children: null }));
    if (children.length) groups.push({ name: gname, kind: "group", children });
  }
  return groups;
}

function classHierarchy(pct) {
  // NB: no .sort() — insertion order preserved, matching how my python
  // version feeds squarify (grouping dict order, unsorted).
  return d3.hierarchy({ name: "root", children: buildHierarchy(pct) }).sum(d => d.value || 0);
}

function layoutTree(root, withSubPadding) {
  const tm = d3.treemap().tile(d3.treemapSquarify.ratio(1)).size([W, H]).round(false);
  if (withSubPadding) {
    tm.paddingOuter(d => (d.depth === 2 && d.children?.length > 1 ? SUB_PAD : 0))
      .paddingInner(d => (d.depth === 2 ? SUB_PAD * 0.75 : 0));
  }
  const laid = tm(root);
  flipLayoutY(laid, H);
  return laid;
}

function layoutSubclassLeaves(data, pct, view, classNodes) {
  const leaves = [];
  classNodes.forEach(classNode => {
    const kids = subclassEntries(data, pct, view, classNode.data.name).filter(d => d.value > 0);
    if (!kids.length) return;
    const w = classNode.x1 - classNode.x0;
    const h = classNode.y1 - classNode.y0;
    const inset = Math.max(0, Math.min(SUB_INSET, (w - 1) / 2, (h - 1) / 2));
    const innerW = Math.max(0, w - 2 * inset);
    const innerH = Math.max(0, h - 2 * inset);
    if (innerW <= 0 || innerH <= 0) return;

    const root = d3.hierarchy({ name: classNode.data.name, children: kids })
      .sum(d => d.value || 0);
    d3.treemap()
      .tile(d3.treemapSquarify.ratio(1))
      .size([innerW, innerH])
      .paddingInner(kids.length > 1 ? SUB_GAP : 0)
      .round(false)(root);
    flipLayoutY(root, innerH);
    root.leaves().forEach(d => {
      d.x0 += classNode.x0 + inset;
      d.x1 += classNode.x0 + inset;
      d.y0 += classNode.y0 + inset;
      d.y1 += classNode.y0 + inset;
      leaves.push(d);
    });
  });
  return leaves;
}

function flipLayoutY(root, height) {
  root.each(d => {
    const y0 = d.y0;
    d.y0 = height - d.y1;
    d.y1 = height - y0;
  });
}

// symbol drawing

/*
 * Draw a class symbol, positioned by its rendered bounding box.
 * opts.anchor:
 *   "centre" — bbox centre placed at (opts.cx, opts.cy)      [legend patches]
 *   "corner" — bbox bottom-left placed at (opts.x, opts.y)   [treemap cells]
 * Returns the group, or null (no symbol defined / exceeds maxW×maxH).
*/
export function drawSymbol(parent, clsName, opts) {
  const sym = SYMBOLS[clsName];
  if (!sym) return null; // no symbol defined — render nothing, by design
  const { anchor = "centre", scaleMult = 1, maxW = Infinity, maxH = Infinity } = opts;
  const offset = Array.isArray(sym.offset) ? sym.offset : (sym.offset?.[anchor] ?? [0, 0]);
  const dx = (offset[0] ?? 0) * SCALE * scaleMult;
  const dy = (offset[1] ?? 0) * SCALE * scaleMult;

  const g = parent.append("g")
    .attr("pointer-events", "none")
    .attr("aria-hidden", "true");
  let bw, bh;

  if (sym.type === "text") {
    const lines = sym.glyph.split("\n");
    const text = g.append("text").attr("text-anchor", "middle").attr("fill", sym.colour);
    const renderText = fs => {
      text.attr("font-size", fs).attr("transform", null);
      text.selectAll("*").remove();
      const lh = fs * (sym.lineSpacing ?? 1) * 1.2;
      lines.forEach((ln, i) =>
        text.append("tspan").attr("x", 0)
          .attr("y", (i - (lines.length - 1) / 2) * lh + fs * 0.35)
          .text(ln));
      const bb = text.node().getBBox();
      text.attr("transform", `translate(${-(bb.x + bb.width / 2)},${-(bb.y + bb.height / 2)})`);
      bw = bb.width; bh = bb.height;
    };
    renderText(sym.fontSize * SCALE * scaleMult);
    const k = fitScale(bw, bh, maxW, maxH);
    if (k < 1) {
      if (k < 0.6) { g.remove(); return null; }
      renderText(sym.fontSize * SCALE * scaleMult * k);
    }
  } else {
    const boxPx = sym.box * SCALE * scaleMult;
    const path = g.append("path").attr("d", sym.d)
      .attr("fill", sym.fill).attr("stroke", sym.stroke)
      .attr("stroke-linecap", "round").attr("stroke-linejoin", "round");
    const bb = path.node().getBBox();
    const baseS = (0.9 * boxPx) / Math.max(bb.width, bb.height);
    let s = baseS;
    const applyPathScale = () => {
      path
        .attr("transform", `scale(${s}) translate(${-(bb.x + bb.width / 2)},${-(bb.y + bb.height / 2)})`)
        .attr("stroke-width", (sym.strokeWidth * SCALE * scaleMult) / baseS);
      bw = bb.width * s; bh = bb.height * s;
    };
    applyPathScale();
    const k = fitScale(bw, bh, maxW, maxH);
    if (k < 1) {
      if (k < 0.6) { g.remove(); return null; }
      s *= k;
      applyPathScale();
    }
  }

  g.attr("transform", anchor === "centre"
    ? `translate(${opts.cx + dx},${opts.cy + dy})`
    : `translate(${opts.x + bw / 2 + dx},${opts.y - bh / 2 + dy})`);
  return g;
}

function fitScale(bw, bh, maxW, maxH) {
  if (bw <= 0 || bh <= 0) return 1;
  const k = Math.min(maxW / bw, maxH / bh);
  return Number.isFinite(k) ? k : 1;
}

const SYMBOL_MARGIN = 11; // ~ the 0.03 unit offsets in the mpl version
const MIN_LABEL_SYMBOL_GAP = 8;

// main render

export const fmtPct = v => (v >= 1 ? `${Math.round(v)}%` : v >= 0.05 ? `${v.toFixed(1)}%` : "<0.1%");

export function render(container, data, state, handlers = {}) {
  const host = d3.select(container);
  host.selectAll("*").remove();

  const pct = classPctForView(data, state.view);
  const baseLegendH = legendBaseHeight(data, pct, state);
  const legendH = baseLegendH + geographyLegendExtra(data, state);
  const svgH = H + LEGEND_GAP + legendH;
  const svg = host.append("svg")
    .attr("viewBox", `0 0 ${W} ${svgH}`)
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .attr("font-family", "Arial, Helvetica, sans-serif");

  const defs = svg.append("defs");
  defineSelectedCellFilter(defs);
  const subclassFillIds = defineSubclassFillPatterns(defs, data);
  GEO_PATTERNS.forEach((p, i) => {
    const pat = defs.append("pattern").attr("id", patternId(i))
      .attr("width", p.size).attr("height", p.size)
      .attr("patternUnits", "userSpaceOnUse");
    p.draw(pat);
    pat.selectAll("*").attr("opacity", PATTERN_OPACITY);
  });

  const plot = svg.append("g");

  if (state.drill) renderDrill(plot, data, pct, state, handlers, subclassFillIds);
  else {
    const root = layoutTree(classHierarchy(pct), false);
    if (state.mode === "subclasses") {
      const classNodes = root.descendants().filter(d => d.depth === 2);
      classNodes.forEach(d => {
        plot.append("rect")
          .attr("x", d.x0).attr("y", d.y0)
          .attr("width", d.x1 - d.x0).attr("height", d.y1 - d.y0)
          .attr("fill", CLASS_COLOUR[d.data.name])
          .attr("stroke", "#000").attr("stroke-width", 0.9);
      });
      renderCells(plot, data, layoutSubclassLeaves(data, pct, state.view, classNodes), state, handlers, "sub", subclassFillIds);
    } else {
      renderCells(plot, data, root.descendants().filter(d => d.depth === 2), state, handlers, "class", subclassFillIds);
    }
  }

  renderLegend(svg, data, pct, state, legendH, baseLegendH, subclassFillIds);
  return svg;
}

function renderCells(plot, data, nodes, state, handlers, kind, subclassFillIds) {
  let selectedCell = null;
  for (const node of nodes) {
    const { x0, y0, x1, y1 } = node;
    const w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) continue;

    const clsName = kind === "class" ? node.data.name : node.data.parentClass;
    const cellName = node.data.name;
    const fill = kind === "class"
      ? CLASS_COLOUR[clsName]
      : subclassFill(data, node.data, subclassFillIds);

    const selected = kind === "class" && state.selectedClass === clsName;
    const g = plot.append("g").attr("class", selected ? "cell selected" : "cell").attr("tabindex", 0)
      .attr("aria-label", `${cellName}, ${fmtPct(node.value)}`);
    if (selected) selectedCell = g;

    g.append("rect").attr("class", "base")
      .attr("x", x0).attr("y", y0).attr("width", w).attr("height", h)
      .attr("fill", fill)
      .attr("fill-opacity", kind === "sub" ? SUBCLASS_FILL_OPACITY : null)
      .attr("stroke", kind === "class" ? "#000" : "none")
      .attr("stroke-width", kind === "class" ? 0.9 : 0);

    if (state.geography) {
      const shares = geographyShares(data, clsName);
      if (shares) {
        let yAcc = y0;
        shares.forEach((s, ri) => {
          const sh = s * h;
          if (sh >= MIN_STRIP_PX) {
            g.append("rect")
              .attr("x", x0).attr("y", yAcc).attr("width", w).attr("height", sh)
              .attr("fill", `url(#${patternId(ri)})`).attr("pointer-events", "none");
            if (ri > 0) g.append("line")
              .attr("x1", x0).attr("x2", x1).attr("y1", yAcc).attr("y2", yAcc)
              .attr("stroke", "#000").attr("stroke-width", 0.4).attr("stroke-opacity", 0.6);
          }
          yAcc += sh;
        });
      }
    }

    const labelText = `${Math.round(node.value)}%`;
    const minLabelW = labelText.length <= 2 ? LABEL_PX * 1.75 : LABEL_PX * 2.4;
    let label = null;
    if (node.value >= LABEL_MIN_PCT && w > minLabelW && h > LABEL_PX * 1.5) {
      label = g.append("text")
        .attr("x", x0 + 7).attr("y", y0 + LABEL_PX * 1.02)
        .attr("font-size", LABEL_PX)
        .attr("fill", labelColour(kind, clsName, fill, node.data))
        .attr("pointer-events", "none")
        .text(labelText);
    }

    // class symbol: always at class level; at sub level, once per parent
    // (anchored in the largest child)
    const isSymbolHost = kind === "class" ||
      node.parent.children.every(sib => sib === node || sib.value <= node.value);
    if (isSymbolHost) {
      const symbolOpts = {
        anchor: "corner",
        x: x0 + SYMBOL_MARGIN, y: y1 - SYMBOL_MARGIN,
        maxW: w - 2 * SYMBOL_MARGIN, maxH: h - 2 * SYMBOL_MARGIN,
      };
      let symbol = drawSymbol(g, clsName, symbolOpts);
      if (symbol && label) {
        const labelBox = label.node().getBBox();
        const symbolBox = symbol.node().getBBox();
        const minimumSymbolY = labelBox.y + labelBox.height + MIN_LABEL_SYMBOL_GAP;
        if (symbolBox.y < minimumSymbolY) {
          symbol.remove();
          symbol = drawSymbol(g, clsName, {
            ...symbolOpts,
            maxH: Math.min(symbolOpts.maxH, y1 - SYMBOL_MARGIN - minimumSymbolY),
          });
        }
      }
    }

    if (selected && w > 2 * SELECTED_OUTLINE_INSET && h > 2 * SELECTED_OUTLINE_INSET) {
      g.append("rect").attr("class", "selection-outline")
        .attr("x", x0 + SELECTED_OUTLINE_INSET)
        .attr("y", y0 + SELECTED_OUTLINE_INSET)
        .attr("width", w - 2 * SELECTED_OUTLINE_INSET)
        .attr("height", h - 2 * SELECTED_OUTLINE_INSET)
        .attr("fill", "none")
        .attr("stroke", "#000")
        .attr("stroke-width", 2.4)
        .attr("filter", `url(#${SELECTED_CELL_FILTER})`)
        .attr("pointer-events", "none");
    }

    g.on("mousemove", ev => { g.classed("hover", true); g.raise(); handlers.onHover?.(ev, { clsName, cellName, value: node.value, kind }); })
     .on("mouseleave", () => { g.classed("hover", false); selectedCell?.raise(); handlers.onLeave?.(); })
     .on("click", ev => { ev.stopPropagation(); handlers.onSelect?.(clsName); })
     .on("keydown", ev => { if (ev.key === "Enter") handlers.onSelect?.(clsName); });
  }
  selectedCell?.raise();
}

function defineSelectedCellFilter(defs) {
  defs.append("filter")
    .attr("id", SELECTED_CELL_FILTER)
    .attr("x", "-10%").attr("y", "-10%")
    .attr("width", "120%").attr("height", "120%")
    .append("feDropShadow")
    .attr("dx", 0).attr("dy", 0).attr("stdDeviation", 2)
    .attr("flood-color", "#000").attr("flood-opacity", 0.55);
}

function renderDrill(plot, data, pct, state, handlers, subclassFillIds) {
  const cls = state.drill;
  const kids = subclassEntries(data, pct, state.view, cls);
  const root = d3.hierarchy({ name: cls, children: kids }).sum(d => d.value || 0);
  const innerH = H - 2 * SUB_INSET;
  d3.treemap()
    .tile(d3.treemapSquarify.ratio(1))
    .size([W - 2 * SUB_INSET, innerH])
    .paddingInner(kids.length > 1 ? SUB_GAP : 0)(root);
  flipLayoutY(root, innerH);
  plot.append("rect").attr("width", W).attr("height", H)
    .attr("fill", CLASS_COLOUR[cls]).attr("stroke", "#000").attr("stroke-width", 0.9);
  root.leaves().forEach(d => { d.x0 += SUB_INSET; d.x1 += SUB_INSET; d.y0 += SUB_INSET; d.y1 += SUB_INSET; });
  renderCells(plot, data, root.leaves(), state, handlers, "sub", subclassFillIds);
}

// legend (inside the SVG => exports carry it)

/* Legend geometry mirrors matplotlib version's fractions of its axis:
 * patch 0.116 × 0.153, row pitch 0.185, column split after 4 items, and
 * the second column starting one row higher (level with the title) —
 * exactly as `_draw_legend` lays it out. All px derived from those. */
const GEO_TITLE_Y = 34;
const TITLE_TO_PATCH = (0.887 - 0.753) * LEGEND_H;
const LEG = {
  x0: 0.0074 * W,                 // left margin (~ 8px)
  col2x: 0.489 * W,                // second column x (~ 508px)
  swW: 0.116 * W,                 // patch width  (~ 125px)
  swH: 0.153 * LEGEND_H,          // patch height (~ 50px)
  pitch: 0.185 * LEGEND_H,        // row pitch    (~ 61px)
  titleY: (1 - 0.887) * LEGEND_H, // title baseline (~ 37px)
  col1top: (1 - 0.753) * LEGEND_H,// first patch top, col 1 (~ 82px)
  labelDx: 0.127 * W,             // label x offset from patch (~ 137px)
  labelFS: 10.9 * SCALE,
  geoTitleY: GEO_TITLE_Y,
  geoHeader: GEO_TITLE_Y + TITLE_TO_PATCH,
  geoPad: 14,
};
const SUB_LEG = {
  x0: LEG.x0,
  col2x: 0.50 * W,
  swW: 0.075 * W,
  swH: 0.102 * LEGEND_H,
  pitch: 0.128 * LEGEND_H,
  top: LEG.col1top,
  labelDx: 0.086 * W,
  labelFS: 8.6 * SCALE,
  pad: 16,
};

function legendBaseHeight(data, pct, state) {
  if (state.mode !== "subclasses") return LEGEND_H;
  const rows = Math.ceil(subclassLegendItems(data, pct, state).length / 2);
  return Math.max(LEGEND_H, SUB_LEG.top + rows * SUB_LEG.pitch + SUB_LEG.pad);
}

export function geographyLegendExtra(data, state) {
  const n = data.geography?.regions?.length ?? 0;
  if (!state.geography || !n) return 0;
  return LEG.geoHeader + Math.ceil(n / 2) * LEG.pitch + LEG.geoPad;
}

function renderLegend(svg, data, pct, state, legendH, baseLegendH, subclassFillIds) {
  const g = svg.append("g").attr("transform", `translate(0,${H + LEGEND_GAP})`);
  g.append("rect").attr("x", 1).attr("y", 1)
    .attr("width", W - 2).attr("height", legendH - 2)
    .attr("fill", "none").attr("stroke", "lightgrey")
    .attr("stroke-width", 1.7).attr("stroke-dasharray", "6 5");
  g.append("text").attr("x", LEG.x0).attr("y", LEG.titleY)
    .attr("font-size", LABEL_PX).attr("font-weight", "bold").text("Legend");

  if (state.mode === "subclasses") {
    const items = subclassLegendItems(data, pct, state);
    const split = Math.ceil(items.length / 2);
    items.forEach((entry, ix) => {
      const col = ix < split ? 0 : 1;
      const row = col ? ix - split : ix;
      const x = col ? SUB_LEG.col2x : SUB_LEG.x0;
      const y = SUB_LEG.top + row * SUB_LEG.pitch;
      drawSubclassLegendPatch(g, data, entry, x, y, subclassFillIds);
      g.append("text").attr("x", x + SUB_LEG.labelDx).attr("y", y + SUB_LEG.swH / 2 + SUB_LEG.labelFS * 0.35)
        .attr("font-size", SUB_LEG.labelFS)
        .text(entry.name);
    });
  } else {
    const items = LEGEND_ORDER.filter(c => (pct[c] || 0) > 0);
    items.forEach((c, ix) => {
      const col = ix < 4 ? 0 : 1;
      const row = col ? ix - 4 : ix;
      const x = col ? LEG.col2x : LEG.x0;
      // column 2 sits one full row higher, level with the title
      const y = LEG.col1top - (col ? LEG.pitch : 0) + row * LEG.pitch;
      g.append("rect").attr("x", x).attr("y", y)
        .attr("width", LEG.swW).attr("height", LEG.swH)
        .attr("fill", CLASS_COLOUR[c]);
      drawSymbol(g, c, { anchor: "centre", cx: x + LEG.swW / 2, cy: y + LEG.swH / 2 });
      g.append("text").attr("x", x + LEG.labelDx).attr("y", y + LEG.swH / 2 + LEG.labelFS * 0.35)
        .attr("font-size", LEG.labelFS)
        .text(pct[c] < 1 ? `${c} (< 1%)` : c);
    });
  }

  const regions = data.geography?.regions;
  if (state.geography && regions) {
    const gy = baseLegendH - 6;
    g.append("line").attr("x1", LEG.x0).attr("x2", W - LEG.x0)
      .attr("y1", gy).attr("y2", gy)
      .attr("stroke", "lightgrey").attr("stroke-width", 1.2).attr("stroke-dasharray", "4 4");
    g.append("text").attr("x", LEG.x0).attr("y", gy + LEG.geoTitleY)
      .attr("font-size", LABEL_PX).attr("font-weight", "bold").text("Geography");
    const split = Math.ceil(regions.length / 2);
    regions.forEach((r, i) => {
      const col = i < split ? 0 : 1;
      const row = col ? i - split : i;
      const x = col ? LEG.col2x : LEG.x0;
      const y = gy + LEG.geoHeader + row * LEG.pitch;
      g.append("rect").attr("x", x).attr("y", y)
        .attr("width", LEG.swW).attr("height", LEG.swH)
        .attr("fill", "#b9b9b9");
      g.append("rect").attr("x", x).attr("y", y)
        .attr("width", LEG.swW).attr("height", LEG.swH)
        .attr("fill", `url(#${patternId(i)})`);
      g.append("text").attr("x", x + LEG.labelDx).attr("y", y + LEG.swH / 2 + LEG.labelFS * 0.35)
        .attr("font-size", LEG.labelFS).text(r);
    });
  }
}

function subclassLegendItems(data, pct, state) {
  const items = [];
  LEGEND_ORDER.forEach(cls => {
    if ((pct[cls] || 0) <= 0) return;
    subclassEntries(data, pct, state.view, cls)
      .filter(entry => entry.value > 0)
      .forEach(entry => items.push(entry));
  });
  return items;
}

function drawSubclassLegendPatch(g, data, entry, x, y, subclassFillIds) {
  if (entry.fill) {
    g.append("rect").attr("x", x).attr("y", y)
      .attr("width", SUB_LEG.swW).attr("height", SUB_LEG.swH)
      .attr("fill", entry.fill.base ?? "#fff");
    g.append("rect").attr("x", x).attr("y", y)
      .attr("width", SUB_LEG.swW).attr("height", SUB_LEG.swH)
      .attr("fill", subclassFill(data, entry, subclassFillIds));
    g.append("rect").attr("x", x).attr("y", y)
      .attr("width", SUB_LEG.swW).attr("height", SUB_LEG.swH)
      .attr("fill", "none").attr("stroke", "#000").attr("stroke-width", 0.9);
    return;
  }

  g.append("rect").attr("x", x).attr("y", y)
    .attr("width", SUB_LEG.swW).attr("height", SUB_LEG.swH)
    .attr("fill", CLASS_COLOUR[entry.parentClass]);
  g.append("rect").attr("x", x).attr("y", y)
    .attr("width", SUB_LEG.swW).attr("height", SUB_LEG.swH)
    .attr("fill", subclassFill(data, entry, subclassFillIds))
    .attr("fill-opacity", SUBCLASS_FILL_OPACITY);
}

function labelColour(kind, clsName, fill, entry) {
  if (kind === "class") return clsName === "Urban" ? "#323232" : "#fff";
  return "#fff";
}
