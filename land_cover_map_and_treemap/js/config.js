// config.js - record of visual components

export const CLASSES = [
  { id: 1, name: "Broadleaved woodland",    colour: "#117733" },
  { id: 2, name: "Coniferous woodland",     colour: "#44aa99" },
  { id: 3, name: "Arable and horticulture", colour: "#999933" },
  { id: 4, name: "Improved grassland",      colour: "#cc6677" },
  { id: 5, name: "Semi-Natural grassland",  colour: "#aa4499" },
  { id: 6, name: "Mountain, heath and bog", colour: "#882255" },
  { id: 7, name: "Coastal and water",       colour: "#8080ff" },
  { id: 8, name: "Urban",                   colour: "#dddddd" },
  { id: 9, name: "Solar energy",            colour: "#f9c056" },
];

export const CLASS_COLOUR = Object.fromEntries(CLASSES.map(c => [c.name, c.colour]));

export const LEGEND_ORDER = [
  "Arable and horticulture", "Solar energy", "Improved grassland",
  "Semi-Natural grassland", "Mountain, heath and bog", "Broadleaved woodland",
  "Coniferous woodland", "Coastal and water", "Urban",
];

export const GROUPING = {
  "Group A": ["Improved grassland", "Arable and horticulture"],
  "Group B": ["Urban"],
  "Group C": ["Mountain, heath and bog", "Solar energy", "Coniferous woodland", "Coastal and water"],
  "Group D": ["Semi-Natural grassland", "Broadleaved woodland"],
};

/*
 * Symbols. type: "path" | "text". box/strokeWidth/offset in pt
 * LAYOUT.SCALE converts to px
 * offset may be [dx, dy] or {centre: [dx, dy], corner: [dx, dy]}.
 * A class with no entry renders without a symbol.
*/
export const SYMBOLS = {
  "Arable and horticulture": {
    type: "text",
    glyph: "\u2022 \u2022 \u2022 \u2022 \u2022\n\u2022 \u2022 \u2022 \u2022",
    fontSize: 12.5, lineSpacing: 0.45, colour: "#000",
    offset: { centre: [0, 0], corner: [0, 4] },
  },
  "Solar energy": {
    type: "path",
    d: "M 70,50 A 20,20 0 1 1 30,50 A 20,20 0 1 1 70,50 Z M 50,4 V 20 M 50,80 V 96 M 4,50 H 20 M 80,50 H 96 M 17.5,17.5 30.2,30.2 M 69.8,69.8 82.5,82.5 M 82.5,17.5 69.8,30.2 M 30.2,69.8 17.5,82.5",
    box: 15, fill: "none", stroke: "#000", strokeWidth: 1.1,
  },
  "Improved grassland": {
    type: "path",
    d: "M 87.956779,34.08091 57.11842,64.919273 M 12.07009,34.08091 42.73428,64.745102 M 50,0 V 68.269997 M 12.725,79.59005 87.275002,79.61904 M 0,63.774792 100,63.803772 M 36.185001,95.449997 h 27.629998",
    box: 18, fill: "none", stroke: "#000", strokeWidth: 1.1,
  },
  "Semi-Natural grassland": {
    type: "path",
    d: "M 91.956696,38.481335 61.118336,69.319702 M 8.0703363,38.481335 38.734524,69.145531 M 50,0 v 68.269997",
    box: 15, fill: "none", stroke: "#fff", strokeWidth: 1.1,
  },
  "Broadleaved woodland": {
    type: "path",
    d: "M 100,50 A 50,50 0 0 1 50,100 50,50 0 0 1 0,50 50,50 0 0 1 50,0 50,50 0 0 1 100,50 Z M 50,71.5 v 68.571",
    box: 17, fill: "none", stroke: "#fff", strokeWidth: 0.7,
  },
  "Coniferous woodland": {
    type: "path",
    d: "m 19.593645,20.466757 c -2.952792,-2.902619 -5.857093,-5.859309 -8.84037,-8.72794 -1.1169679,-0.729954 -1.9857689,0.464957 -2.7025949,1.162345 -2.594515,2.598174 -5.242345,5.147702 -7.80329601,7.776502 -1.035017,1.504558 1.45563701,2.938221 2.35697101,1.426367 2.015793,-1.998894 4.031583,-3.99779 6.047375,-5.996685 0.01802,2.861933 -0.03626,5.72753 0.02753,8.58714 0.335757,1.784509 3.1180519,1.067146 2.6839889,-0.645888 0,-2.647082 0,-5.294168 0,-7.941252 2.181268,2.137784 4.314527,4.329103 6.526226,6.432958 1.305922,0.900172 2.863073,-0.962697 1.70416,-2.073547 z m 0,-5.690517 C 16.640853,11.873621 13.736552,8.9169306 10.753275,6.0482991 9.6363071,5.3183466 8.7675061,6.5132579 8.0506801,7.2106451 5.4561651,9.8088196 2.8083351,12.358348 0.24738409,14.987146 c -1.035017,1.504562 1.45563701,2.938221 2.35697101,1.426368 2.015793,-1.998894 4.031583,-3.99779 6.047375,-5.996684 0.01802,2.861932 -0.03626,5.72753 0.02753,8.587139 0.335757,1.784509 3.1180519,1.067146 2.6839889,-0.645887 0,-2.647084 0,-5.29417 0,-7.941252 2.181268,2.137783 4.314527,4.329102 6.526226,6.432956 1.305922,0.900173 2.863073,-0.962697 1.70416,-2.073546 z m 0,-5.8202604 C 16.640858,6.0533748 13.736521,3.0967488 10.753275,0.22810214 9.6363091,-0.50194366 8.7675291,0.69312364 8.0506741,1.3904738 5.4561631,3.9886185 2.8083321,6.5381143 0.24738409,9.1668866 -0.78762191,10.671443 1.7030391,12.10523 2.6043571,10.593256 c 2.015793,-1.9988624 4.031582,-3.9977272 6.047373,-5.9965907 0.01824,3.7581533 -0.03657,7.5200117 0.02753,11.2758417 0.335749,1.78449 3.1180969,1.067127 2.6839889,-0.645917 0,-3.543307 0,-7.0866164 0,-10.6299247 2.181263,2.1377671 4.314558,4.3290223 6.526226,6.4328917 1.305891,0.90028 2.863073,-0.96279 1.704159,-2.0735774 z m 0,17.3992304 c -2.952788,-2.902606 -5.857115,-5.859247 -8.84037,-8.727888 -1.1169659,-0.730018 -1.9857539,0.465002 -2.7025999,1.162364 -2.594512,2.59815 -5.242343,5.147653 -7.80329101,7.77643 -1.035006,1.504556 1.45565501,2.938342 2.35697301,1.426371 2.015793,-1.998865 4.031582,-3.997728 6.047373,-5.996593 0,6.805224 0,13.610452 0,20.415678 0.903844,0 1.8076879,0 2.7115319,0 0,-6.805226 0,-13.610454 0,-20.415678 2.181263,2.137768 4.314557,4.329024 6.526226,6.432893 1.305891,0.90028 2.863073,-0.962788 1.704157,-2.073577 z",
    box: 17, fill: "#000", stroke: "none", strokeWidth: 0,
  },
  "Mountain, heath and bog": {
    type: "path",
    d: "m7.71348,95.45l42.22264,-73.88972l42.22256,73.88972l-84.4452,0z",
    box: 16, fill: "none", stroke: "#fff", strokeWidth: 1,
  },
  "Coastal and water": {
    type: "path",
    d: "M 46.738236,0.0127324 C 60.889824,12.013425 74.275269,6.2187008 82.464972,0.00346596 M -0.02826656,65.576328 C 8.3933233,60.505355 20.365671,57.650977 32.859913,68.893758 m 64.938833,0.03431 c 7.229084,-5.816 19.170644,-11.924287 32.201594,-4.113434 M -0.02826656,37.60071 C 9.8444228,31.655969 24.596933,28.757506 39.349441,48.046177 c 25.650567,33.537713 51.301132,0 51.301132,0 0,0 18.246297,-23.85675 39.349767,-11.207159 M -0.02845226,9.6265321 C 9.8442383,3.6817158 24.59684,0.78309487 39.349441,20.071888 c 25.650567,33.537712 51.301132,0 51.301132,0 0,0 18.246297,-23.8567575 39.349777,-11.2071538",
    box: 22, fill: "none", stroke: "#fff", strokeWidth: 0.8,
  },
  "Urban": {
    type: "path",
    d: "m 0,15 v 8 h 150 v -8 z m 0,62 v 8 H 150 V 77 Z M 17,0 v 15 h 8 V 0 Z m 54,0 v 15 h 8 V 0 Z m 54,0.12109375 V 15 h 8 V 0.12109375 Z M 17,23 v 54 h 8 V 23 Z m 54,0 v 54 h 8 V 23 Z m 54,0 v 54 h 8 V 23 Z M 17,85 v 15 h 8 V 85 Z m 54,0 v 15 h 8 V 85 Z m 54,0 v 15.12109 h 8 V 85 Z",
    box: 25, fill: "#000", stroke: "none", strokeWidth: 0,
  },
};

/*
 * Layout constants — 1:1 with the matplotlib figure.
 * Original mpl axes was 5.7 in = 410.4 pt wide, extent NORM_X:NORM_Y.
*/
const W = 1080;
export const LAYOUT = {
  W,
  H: Math.round(W * (2 / 2.96)),   // NORM_Y / NORM_X
  SCALE: W / 410.4,                // pt -> px
  LABEL_MIN_PCT: 1,
  SUB_PAD: 5,                      // parent-colour inset border, px
  LEGEND_H: 330,                   // base height; grows when geography legend shown
  LEGEND_GAP: 8,
  MIN_STRIP_PX: 7,                 // geography strips thinner than this defer to tooltip
};
export const LABEL_PX = 12 * LAYOUT.SCALE;

/*
 * Geography hatch patterns for overlay/legend patch styling.
 * Assignment to regions is by index into data.geography.regions.
 * Mixed geometry, line width, and (sparingly) colour — the two
 * coloured strokes sit outside the class palette's hue range.
*/
// Patterns for different geographies/regions
export const GEO_PATTERNS = [
  { size: 10, draw: p => p.append("path").attr("d", "M0,10 L10,0 M-2,2 L2,-2 M8,12 L12,8").attr("stroke", "#10224f").attr("stroke-width", 1.8).attr("fill", "none") },
  { size: 10, draw: p => p.append("path").attr("d", "M0,0 L10,10 M-2,8 L2,12 M8,-2 L12,2").attr("stroke", "#ffffff").attr("stroke-width", 1.6).attr("fill", "none") },
  { size:  9, draw: p => p.append("circle").attr("cx", 4).attr("cy", 4).attr("r", 1.5).attr("fill", "#000") },
  { size:  8, draw: p => p.append("path").attr("d", "M4,0 V9").attr("stroke", "#000").attr("stroke-width", 1.2).attr("fill", "none") },
  { size:  8, draw: p => p.append("path").attr("d", "M0,4 H9").attr("stroke", "#ffffff").attr("stroke-width", 1.2).attr("fill", "none") },
  { size: 11, draw: p => p.append("path").attr("d", "M0,5 H11 M5,0 V11").attr("stroke", "#000").attr("stroke-width", 0.8).attr("fill", "none") },
  { size: 11, draw: p => p.append("circle").attr("cx", 5).attr("cy", 5).attr("r", 2.4).attr("fill", "none").attr("stroke", "#4a2c0f").attr("stroke-width", 1.4) },
  { size: 10, draw: p => p.append("path").attr("d", "M0,2 H4 M6,7 H10").attr("stroke", "#000").attr("stroke-width", 1.4).attr("fill", "none") },
];
export const PATTERN_OPACITY = 0.55;
export const patternId = i => `geo-pat-${i}`;
