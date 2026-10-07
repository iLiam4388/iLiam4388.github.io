/** 2D Rider: dependency-free, touch-first modeling and animation studio. */
const $ = (id) => document.getElementById(id);
const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const TAU = Math.PI * 2;
const STORAGE_KEY = "il-rider-2d-v1";
const MAX_OBJECTS = 150;
const MAX_PARTICLES = 240;
const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const uuid = () => globalThis.crypto?.randomUUID?.() || `r${Date.now()}_${Math.random().toString(36).slice(2)}`;
const round = (number) => Math.round(number * 1000) / 1000;
const transformKeys = ["x", "y", "rotation", "sx", "sy"];
const kinds = new Set(["rect", "circle", "triangle", "star", "hexagon", "text", "mesh", "meta", "liquid"]);
const shaders = new Set(["flat", "gloss", "metal", "neon", "toon", "stripe", "glass"]);
const bodyTypes = new Set(["none", "rigid", "soft", "static"]);
const colorPattern = /^#[0-9a-f]{6}$/i;
const view = { x: 0, y: 0, zoom: 60, width: 1, height: 1, dpr: 1 };
let scene = emptyScene();
let selectedId = null;
let time = 0;
let playing = false;
let lastFrame = 0;
let accumulator = 0;
let playbackPose = null;
let undoStack = [];
let redoStack = [];
let saveTimer = 0;
let toastTimer = 0;
let dirty = true;
let metaCacheKey = "";
let panelTrigger = null;
const bodyRuntime = new Map();
const fluidRuntime = new Map();
const metaCanvas = document.createElement("canvas");
const metaCtx = metaCanvas.getContext("2d");
const fontRegistry = new Map();

function emptyScene() {
  return { format: "2d-rider", version: 1, name: "Untitled 2D scene", objects: [], fonts: [], duration: 5, loop: true, gravity: 9.8, floor: 3, floorEnabled: true, background: "#181a20", grid: true };
}

/** Validate before replacing the live scene, including expensive font/geometry limits. */
export function validateProject(input) {
  if (!input || input.format !== "2d-rider" || input.version !== 1 || !Array.isArray(input.objects) || input.objects.length > MAX_OBJECTS) throw new Error("Choose a valid 2D Rider project (up to 150 objects).");
  const output = emptyScene();
  output.name = String(input.name || "Untitled 2D scene").slice(0, 80);
  output.duration = clamp(finite(input.duration, 5), 0.2, 120);
  output.gravity = clamp(finite(input.gravity, 9.8), -30, 30);
  output.floor = clamp(finite(input.floor, 3), -100, 100);
  output.floorEnabled = input.floorEnabled !== false;
  output.loop = input.loop !== false;
  output.grid = input.grid !== false;
  output.background = colorPattern.test(input.background) ? input.background : "#181a20";
  const ids = new Set();
  let particleCount = 0;
  output.fonts = (Array.isArray(input.fonts) ? input.fonts : []).map((font) => {
    if (!font || !/^RiderFont_[a-z0-9_]+$/i.test(font.family) || typeof font.data !== "string" || font.data.length > 5600000 || !/^data:(font\/(ttf|otf|woff|woff2)|application\/(octet-stream|x-font-ttf|font-woff));base64,[a-zA-Z0-9+/=]+$/.test(font.data)) throw new Error("This project contains an invalid font.");
    return { family: font.family, name: String(font.name).slice(0, 80), data: font.data };
  });
  if (output.fonts.length > 4 || output.fonts.reduce((sum, font) => sum + font.data.length, 0) > 12000000) throw new Error("A project may contain up to four fonts (8 MB total).");
  output.objects = input.objects.map((source) => {
    if (!source || !kinds.has(source.type) || typeof source.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(source.id) || ids.has(source.id)) throw new Error("Invalid or duplicate scene object.");
    ids.add(source.id);
    const object = makeObject(source.type);
    object.id = source.id;
    object.name = String(source.name || source.type).slice(0, 80);
    for (const key of ["x", "y"]) object[key] = clamp(finite(source[key]), -1000, 1000);
    object.rotation = clamp(finite(source.rotation), -36000, 36000);
    object.sx = clamp(finite(source.sx, 1), 0.05, 50);
    object.sy = clamp(finite(source.sy, 1), 0.05, 50);
    object.color = colorPattern.test(source.color) ? source.color : object.color;
    object.shader = shaders.has(source.shader) ? source.shader : "flat";
    object.opacity = clamp(finite(source.opacity, 1), 0.1, 1);
    object.physics = bodyTypes.has(source.physics) ? source.physics : "none";
    object.mass = clamp(finite(source.mass, 1), 0.1, 100);
    object.bounce = clamp(finite(source.bounce, 0.35), 0, 1);
    object.softness = clamp(finite(source.softness, 0.4), 0.05, 0.95);
    object.influence = clamp(finite(source.influence, 1), 0.5, 2.5);
    if (source.type === "text") {
      object.text = String(source.text ?? "Rider").slice(0, 160);
      object.font = ["sans-serif", "serif", "monospace", ...output.fonts.map((font) => font.family)].includes(source.font) ? source.font : "sans-serif";
    }
    if (source.type === "meta") {
      if (!Array.isArray(source.sources) || !source.sources.length || source.sources.length > 400) throw new Error("Invalid metaball sources.");
      object.sources = source.sources.map((point) => ({ x: clamp(finite(point.x), -100, 100), y: clamp(finite(point.y), -100, 100), r: clamp(finite(point.r, 0.35), 0.015, 10) }));
    }
    if (source.type === "mesh") {
      if (!Array.isArray(source.contours) || !source.contours.length || source.contours.length > 400 || source.contours.reduce((sum, ring) => sum + (Array.isArray(ring) ? ring.length : 20001), 0) > 20000) throw new Error("Invalid polygon mesh.");
      object.contours = source.contours.map((ring) => {
        if (!Array.isArray(ring) || ring.length < 3) throw new Error("Invalid mesh contour.");
        return ring.map((point) => ({ x: clamp(finite(point.x), -100, 100), y: clamp(finite(point.y), -100, 100) }));
      });
    }
    if (source.type === "liquid") {
      object.particleCount = clamp(Math.round(finite(source.particleCount, 80)), 12, MAX_PARTICLES);
      particleCount += object.particleCount;
      object.physics = "none";
    }
    if (particleCount > MAX_PARTICLES) throw new Error("This scene has more than 240 liquid particles.");
    if (Array.isArray(source.keyframes) && source.keyframes.length > 500) throw new Error("Too many keyframes on one object.");
    object.keyframes = (Array.isArray(source.keyframes) ? source.keyframes : []).map((key) => {
      if (!key || typeof key.time !== "number" || !Number.isFinite(key.time) || key.time < 0 || key.time > 120 || transformKeys.some((property) => typeof key[property] !== "number" || !Number.isFinite(key[property]))) throw new Error("Invalid animation keyframe.");
      const frame = { time: key.time };
      for (const property of transformKeys) frame[property] = clamp(finite(key[property], object[property]), property.startsWith("s") ? 0.05 : -36000, property.startsWith("s") ? 50 : 36000);
      return frame;
    }).sort((a, b) => a.time - b.time);
    if (object.keyframes.some((frame, index, frames) => index && frame.time === frames[index - 1].time)) throw new Error("Duplicate animation keyframe times.");
    output.duration = Math.max(output.duration, ...object.keyframes.map((frame) => frame.time));
    return object;
  });
  return output;
}

function makeObject(type, variant) {
  const count = scene?.objects?.filter((object) => object.type === type).length || 0;
  const colors = ["#b28cf3", "#66c6d4", "#f0ac71", "#88c991", "#eb829b"];
  const object = { id: uuid(), type, name: `${type === "meta" ? "Metaball" : type[0].toUpperCase() + type.slice(1)} ${count + 1}`, x: view.x, y: view.y - 0.6, rotation: 0, sx: 1, sy: 1, color: colors[count % colors.length], shader: "gloss", opacity: 1, physics: "none", mass: 1, bounce: 0.35, softness: 0.4, influence: 1, keyframes: [] };
  if (type === "text") Object.assign(object, { text: "Rider", font: "sans-serif" });
  if (type === "meta") object.sources = makeMetaSources(variant || "ball");
  if (type === "liquid") Object.assign(object, { particleCount: 80, color: "#5db9ee", shader: "glass" });
  return object;
}

function makeMetaSources(variant) {
  if (variant === "capsule") return [-0.6, -0.3, 0, 0.3, 0.6].map((x) => ({ x, y: 0, r: 0.3 }));
  if (variant === "chain") return Array.from({ length: 7 }, (_, i) => ({ x: (i - 3) * 0.34, y: Math.sin(i * 0.9) * 0.3, r: 0.28 }));
  if (variant === "ring") return Array.from({ length: 12 }, (_, i) => ({ x: Math.cos(i / 12 * TAU) * 0.8, y: Math.sin(i / 12 * TAU) * 0.8, r: 0.24 }));
  if (variant === "cluster") return [{ x: 0, y: 0, r: 0.42 }, ...Array.from({ length: 5 }, (_, i) => ({ x: Math.cos(i / 5 * TAU) * 0.64, y: Math.sin(i / 5 * TAU) * 0.64, r: 0.33 }))];
  return [{ x: 0, y: 0, r: 0.65 }];
}

function selected() { return scene.objects.find((object) => object.id === selectedId); }
function localToWorld(object, point) {
  const angle = object.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return { x: object.x + point.x * object.sx * c - point.y * object.sy * s, y: object.y + point.x * object.sx * s + point.y * object.sy * c };
}
function worldToLocal(object, point) {
  const angle = -object.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle), x = point.x - object.x, y = point.y - object.y;
  return { x: (x * c - y * s) / object.sx, y: (x * s + y * c) / object.sy };
}
function screenToWorld(x, y) { return { x: (x - view.width / 2) / view.zoom + view.x, y: (y - view.height / 2) / view.zoom + view.y }; }
function worldToScreen(x, y) { return { x: (x - view.x) * view.zoom + view.width / 2, y: (y - view.y) * view.zoom + view.height / 2 }; }

function textBounds(object) {
  ctx.save(); ctx.font = `bold 1px "${object.font}"`;
  const lines = object.text.split("\n"), width = Math.max(0.4, ...lines.map((line) => ctx.measureText(line).width));
  ctx.restore(); return { width, height: Math.max(1, lines.length * 1.2) };
}
function polygonPoints(object) {
  if (object.type === "mesh") return convexHull(object.contours.flat());
  if (object.type === "text") { const { width, height } = textBounds(object); return [{ x: -width / 2, y: -height / 2 }, { x: width / 2, y: -height / 2 }, { x: width / 2, y: height / 2 }, { x: -width / 2, y: height / 2 }]; }
  if (object.type === "meta") {
    return convexHull(object.sources.flatMap((source) => Array.from({ length: 8 }, (_, i) => ({ x: source.x + Math.cos(i / 8 * TAU) * source.r * object.influence, y: source.y + Math.sin(i / 8 * TAU) * source.r * object.influence }))));
  }
  if (object.type === "rect" || object.type === "liquid") return [{ x: -0.8, y: -0.6 }, { x: 0.8, y: -0.6 }, { x: 0.8, y: 0.6 }, { x: -0.8, y: 0.6 }];
  if (object.type === "triangle") return [{ x: 0, y: -0.85 }, { x: 0.8, y: 0.65 }, { x: -0.8, y: 0.65 }];
  const count = object.type === "hexagon" ? 6 : object.type === "star" ? 10 : 20;
  return Array.from({ length: count }, (_, i) => { const angle = i / count * TAU - Math.PI / 2, radius = object.type === "star" && i % 2 ? 0.36 : 0.8; return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }; });
}
function convexHull(points) {
  const list = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (list.length < 4) return list;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [], upper = [];
  for (const p of list) { while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  for (const p of list.reverse()) { while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
function pathPolygon(points) { if (!points.length) return; ctx.moveTo(points[0].x, points[0].y); for (const point of points.slice(1)) ctx.lineTo(point.x, point.y); ctx.closePath(); }
function objectPath(object) {
  ctx.beginPath();
  if (object.type === "circle") ctx.arc(0, 0, 0.8, 0, TAU);
  else if (object.type === "mesh") object.contours.forEach(pathPolygon);
  else pathPolygon(polygonPoints(object));
}

function setFill(object, bounds = 0.9) {
  ctx.shadowBlur = 0; ctx.globalAlpha = object.opacity;
  if (["gloss", "metal", "glass"].includes(object.shader)) {
    const gradient = ctx.createLinearGradient(-bounds, -bounds, bounds, bounds);
    gradient.addColorStop(0, "#ffffff"); gradient.addColorStop(object.shader === "metal" ? 0.42 : 0.3, object.color); gradient.addColorStop(object.shader === "metal" ? 0.48 : 1, object.shader === "glass" ? `${object.color}50` : object.color);
    if (object.shader === "metal") { gradient.addColorStop(0.55, "#e3e5ef"); gradient.addColorStop(1, object.color); }
    ctx.fillStyle = gradient;
  } else ctx.fillStyle = object.color;
  if (object.shader === "neon") { ctx.shadowColor = object.color; ctx.shadowBlur = 16; }
}
function drawObject(object, exportOnly = false) {
  if (object.type === "meta" && object.physics !== "soft") return;
  if (object.type === "liquid") { drawLiquid(object, exportOnly); return; }
  const runtime = bodyRuntime.get(object.id);
  ctx.save(); setFill(object);
  if (object.physics === "soft" && runtime?.nodes) {
    ctx.beginPath();
    if (object.type === "mesh" || object.type === "text") {
      const rings = object.type === "mesh" ? object.contours : runtime.textContours;
      rings?.forEach((ring) => pathPolygon(ring.map((point) => deformSoftPoint(object, runtime, point))));
    } else pathPolygon(runtime.nodes);
    ctx.fill("evenodd");
    ctx.lineWidth = 1.2 / view.zoom; ctx.strokeStyle = `${object.color}cc`; ctx.stroke();
  } else {
    ctx.translate(object.x, object.y); ctx.rotate(object.rotation * Math.PI / 180); ctx.scale(object.sx, object.sy);
    if (object.type === "text") {
      const { height } = textBounds(object); ctx.font = `bold 1px "${object.font}"`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      object.text.split("\n").forEach((line, i) => ctx.fillText(line, 0, -height / 2 + 0.6 + i * 1.2));
    } else {
      objectPath(object); ctx.fill("evenodd");
      if (object.shader === "stripe") {
        ctx.save(); ctx.clip("evenodd"); ctx.strokeStyle = "#ffffff66"; ctx.lineWidth = 0.08;
        const points = polygonPoints(object), range = Math.max(2, ...points.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))));
        for (let x = -range * 3; x < range * 3; x += 0.3) { ctx.beginPath(); ctx.moveTo(x, -range); ctx.lineTo(x + range * 2, range); ctx.stroke(); }
        ctx.restore();
      }
      if (["toon", "glass"].includes(object.shader)) { ctx.strokeStyle = object.shader === "toon" ? "#11141b" : "#ffffff99"; ctx.lineWidth = (object.shader === "toon" ? 3 : 1.4) / view.zoom; ctx.stroke(); }
    }
  }
  ctx.restore();
  if (!exportOnly && object.id === selectedId) drawSelection(object);
}
function drawSelection(object) {
  const points = polygonPoints(object).map((point) => localToWorld(object, point));
  const runtime = bodyRuntime.get(object.id);
  const actual = object.physics === "soft" && runtime?.nodes ? runtime.nodes : points;
  if (!actual.length) return;
  const minX = Math.min(...actual.map((p) => p.x)) - 0.1, maxX = Math.max(...actual.map((p) => p.x)) + 0.1;
  const minY = Math.min(...actual.map((p) => p.y)) - 0.1, maxY = Math.max(...actual.map((p) => p.y)) + 0.1;
  ctx.save(); ctx.lineWidth = 1.4 / view.zoom; ctx.strokeStyle = "#d5b9ff"; ctx.setLineDash([5 / view.zoom, 4 / view.zoom]); ctx.strokeRect(minX, minY, maxX - minX, maxY - minY); ctx.restore();
}
function rgb(color) { return [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16)); }
function drawMetaballs() {
  const objects = scene.objects.filter((object) => object.type === "meta" && object.physics !== "soft");
  if (!objects.length) return;
  const sources = objects.flatMap((object) => object.sources.map((source) => {
    const angle = object.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle), rx = source.r * object.sx * object.influence, ry = source.r * object.sy * object.influence;
    return { ...localToWorld(object, source), rx, ry, c, s, extentX: Math.hypot(rx * c, ry * s), extentY: Math.hypot(rx * s, ry * c), object, rgb: rgb(object.color) };
  }));
  const viewportLeft = view.x - view.width / view.zoom / 2, viewportRight = view.x + view.width / view.zoom / 2;
  const viewportTop = view.y - view.height / view.zoom / 2, viewportBottom = view.y + view.height / view.zoom / 2;
  const left = Math.max(viewportLeft, Math.min(...sources.map((s) => s.x - s.extentX * 3))), right = Math.min(viewportRight, Math.max(...sources.map((s) => s.x + s.extentX * 3)));
  const top = Math.max(viewportTop, Math.min(...sources.map((s) => s.y - s.extentY * 3))), bottom = Math.min(viewportBottom, Math.max(...sources.map((s) => s.y + s.extentY * 3)));
  if (right <= left || bottom <= top) return;
  const width = clamp(Math.ceil((right - left) * view.zoom / 3), 2, 180), height = clamp(Math.ceil((bottom - top) * view.zoom / 3), 2, 180);
  const key = JSON.stringify([sources.map((s) => [s.x, s.y, s.rx, s.ry, s.c, s.s, s.object.color, s.object.opacity, s.object.shader]), left, right, top, bottom, width, height]);
  if (key !== metaCacheKey) {
    metaCanvas.width = width; metaCanvas.height = height;
    const image = metaCtx.createImageData(width, height), stepX = (right - left) / width, stepY = (bottom - top) / height;
    for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
      const x = left + (px + 0.5) * stepX, y = top + (py + 0.5) * stepY;
      let field = 0, best = 0, nearest = sources[0], gx = 0, gy = 0;
      for (const s of sources) {
        const dx = x - s.x, dy = y - s.y, lx = dx * s.c + dy * s.s, ly = -dx * s.s + dy * s.c, rx2 = s.rx * s.rx, ry2 = s.ry * s.ry;
        const distance = Math.max(0.0001, lx * lx / rx2 + ly * ly / ry2), value = 1 / distance;
        field += value; gx += value * value * (lx / rx2 * s.c - ly / ry2 * s.s); gy += value * value * (lx / rx2 * s.s + ly / ry2 * s.c);
        if (value > best) { best = value; nearest = s; }
      }
      if (field < 0.92) continue;
      const index = (py * width + px) * 4, shade = nearest.object.shader === "flat" ? 1 : clamp(0.84 - (gx + gy) / (Math.hypot(gx, gy) || 1) * 0.22, 0.55, 1.15);
      for (let channel = 0; channel < 3; channel++) image.data[index + channel] = Math.min(255, nearest.rgb[channel] * shade);
      image.data[index + 3] = clamp((field - 0.92) / 0.14, 0, 1) * 255 * nearest.object.opacity;
    }
    metaCtx.putImageData(image, 0, 0); metaCacheKey = key;
  }
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(metaCanvas, left, top, right - left, bottom - top); ctx.restore();
}

function resize() {
  const rect = $("stage").getBoundingClientRect(); view.width = Math.max(1, rect.width); view.height = Math.max(1, rect.height); view.dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(view.width * view.dpr); canvas.height = Math.round(view.height * view.dpr); dirty = true; render();
}
function render(exportOnly = false) {
  if (!ctx) return;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0); ctx.clearRect(0, 0, view.width, view.height); ctx.fillStyle = scene.background; ctx.fillRect(0, 0, view.width, view.height);
  ctx.translate(view.width / 2, view.height / 2); ctx.scale(view.zoom, view.zoom); ctx.translate(-view.x, -view.y);
  if (scene.grid && !exportOnly) {
    const unit = view.zoom < 20 ? 5 : view.zoom > 150 ? 0.5 : 1;
    const left = view.x - view.width / view.zoom / 2, right = view.x + view.width / view.zoom / 2, top = view.y - view.height / view.zoom / 2, bottom = view.y + view.height / view.zoom / 2;
    ctx.beginPath(); ctx.strokeStyle = "#ffffff09"; ctx.lineWidth = 1 / view.zoom;
    for (let x = Math.floor(left / unit) * unit; x < right; x += unit) { ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
    for (let y = Math.floor(top / unit) * unit; y < bottom; y += unit) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
    ctx.stroke();
  }
  if (scene.floorEnabled) { ctx.beginPath(); ctx.moveTo(view.x - view.width / view.zoom / 2, scene.floor); ctx.lineTo(view.x + view.width / view.zoom / 2, scene.floor); ctx.strokeStyle = "#9b85bf44"; ctx.lineWidth = 1.5 / view.zoom; ctx.stroke(); }
  scene.objects.forEach((object) => drawObject(object, exportOnly)); drawMetaballs();
  if (!exportOnly) scene.objects.filter((object) => object.type === "meta" && object.id === selectedId && object.physics !== "soft").forEach(drawSelection);
  dirty = false;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = polygon[i], b = polygon[j]; if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside; }
  return inside;
}
function hitTest(point) {
  for (const object of [...scene.objects].reverse()) {
    const runtime = bodyRuntime.get(object.id), local = worldToLocal(object, point);
    if (object.physics === "soft" && runtime?.nodes ? pointInPolygon(point, runtime.nodes) : pointInPolygon(local, polygonPoints(object))) return object;
  }
  return null;
}

function history({ preserveSelectedPose = false } = {}) {
  stop(); undoStack.push(projectData()); if (undoStack.length > 30) undoStack.shift(); redoStack = [];
  const object = selected(), visiblePose = preserveSelectedPose && object ? Object.fromEntries(transformKeys.map((key) => [key, object[key]])) : null;
  restorePose(); if (visiblePose) Object.assign(object, visiblePose); playbackPose = null;
}
function projectData() {
  const project = clone(scene);
  if (playbackPose) for (const object of project.objects) { const pose = playbackPose.get(object.id); if (pose) Object.assign(object, pose); }
  return project;
}
/** Read-only diagnostics for browser regression tests and project integrations. */
export function getStudioState() {
  return { project: projectData(), time, playing, view: { ...view }, poses: scene.objects.map((o) => ({ id: o.id, x: o.x, y: o.y, rotation: o.rotation, sx: o.sx, sy: o.sy })), soft: [...bodyRuntime.entries()].filter(([, body]) => body.nodes).map(([id, body]) => ({ id, nodes: clone(body.nodes), origins: clone(body.origins), textContourCount: body.textContours?.length || 0 })), liquids: [...fluidRuntime.entries()].map(([id, particles]) => ({ id, particles: clone(particles) })) };
}
function changed({ geometry = false } = {}) {
  if (geometry) { bodyRuntime.clear(); fluidRuntime.clear(); }
  dirty = true; refresh(); scheduleSave();
}
function scheduleSave() {
  clearTimeout(saveTimer); $("saveStatus").textContent = "Saving on this device…";
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projectData())); $("saveStatus").textContent = "Saved on this device"; }
    catch { $("saveStatus").textContent = "Device storage is full. Save a project file to keep this scene."; }
  }, 400);
}
function toast(message) { $("toast").textContent = message; $("toast").hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $("toast").hidden = true, 3400); }
function selectObject(id) { selectedId = id; refresh(); dirty = true; }
function addObject(type, variant) {
  if (scene.objects.length >= MAX_OBJECTS) return toast("This scene is full (150 objects).");
  const used = scene.objects.filter((o) => o.type === "liquid").reduce((sum, o) => sum + o.particleCount, 0);
  if (type === "liquid" && MAX_PARTICLES - used < 12) return toast("At least 12 free particle slots are needed to add liquid (240 per scene).");
  history(); const object = makeObject(type, variant); if (type === "liquid") object.particleCount = Math.min(80, MAX_PARTICLES - used);
  scene.objects.push(object); selectedId = object.id; changed({ geometry: true }); closePanels();
  if (view.width < 320) fitScene();
  toast(type === "liquid" ? "Liquid added. Play to simulate." : `${object.name} added. Tap Edit to change it.`);
}
function refresh() {
  const object = selected(); $("projectName").value = scene.name; $("objectCount").textContent = scene.objects.length; $("nothingSelected").hidden = !!object; $("selectionEditor").hidden = !object;
  const list = $("sceneList"); list.replaceChildren();
  for (const item of scene.objects) { const button = document.createElement("button"); button.textContent = item.name; button.className = item.id === selectedId ? "selected" : ""; button.dataset.object = item.id; const sub = document.createElement("small"); sub.textContent = `${item.type}${item.physics !== "none" ? ` · ${item.physics} body` : ""}${item.keyframes.length ? ` · ${item.keyframes.length} keyframes` : ""}`; button.append(sub); list.append(button); }
  if (object) {
    $("objectName").value = object.name;
    for (const key of transformKeys) $(key).value = round(object[key]);
    $("uniformScale").value = round((object.sx + object.sy) / 2);
    for (const key of ["color", "shader", "opacity", "physics", "mass", "bounce", "softness", "influence"]) $(key).value = object[key];
    $("physics").disabled = object.type === "liquid"; $("textSection").hidden = object.type !== "text"; $("metaSection").hidden = object.type !== "meta";
    if (object.type === "text") { $("textContent").value = object.text; $("fontFamily").value = object.font; }
    const keyList = $("keyframeList"); keyList.replaceChildren();
    object.keyframes.forEach((frame, index) => { const row = document.createElement("div"), button = document.createElement("button"), remove = document.createElement("button"); button.textContent = `${frame.time.toFixed(2)} s · Go`; button.dataset.seek = frame.time; remove.textContent = "×"; remove.setAttribute("aria-label", `Remove keyframe at ${frame.time} seconds`); remove.dataset.removeKey = index; row.append(button, remove); keyList.append(row); });
  }
  $("duration").value = scene.duration; $("time").max = scene.duration; $("loop").checked = scene.loop; $("gravity").value = scene.gravity; $("floor").value = scene.floor; $("floorEnabled").checked = scene.floorEnabled; $("background").value = scene.background; $("grid").checked = scene.grid;
  $("undoBtn").disabled = !undoStack.length; $("redoBtn").disabled = !redoStack.length; updateTimeUI();
}
function updateTimeUI() { $("time").value = time; $("timeNumber").value = round(time); $("timeLabel").textContent = `${time.toFixed(2)} s`; $("keyframeTime").textContent = `${time.toFixed(2)} s`; }
function openPanel(id) {
  const panel = $(id), already = panel.classList.contains("open"), trigger = document.activeElement; closePanels(false); if (already) return;
  panelTrigger = trigger; panel.classList.add("open"); document.querySelectorAll(`[aria-controls="${id}"]`).forEach((button) => button.setAttribute("aria-expanded", "true")); panel.focus();
}
function closePanels(restoreFocus = true) { document.querySelectorAll(".panel.open").forEach((panel) => panel.classList.remove("open")); document.querySelectorAll("[aria-expanded=true]").forEach((button) => button.setAttribute("aria-expanded", "false")); if (restoreFocus && panelTrigger?.isConnected) panelTrigger.focus(); panelTrigger = null; }

export function sampleKeyframes(frames, sampleTime) {
  if (!frames.length) return null;
  if (sampleTime <= frames[0].time) return { ...frames[0] };
  if (sampleTime >= frames.at(-1).time) return { ...frames.at(-1) };
  const next = frames.findIndex((frame) => frame.time >= sampleTime), a = frames[next - 1], b = frames[next], t = (sampleTime - a.time) / (b.time - a.time);
  const output = {}; for (const key of transformKeys) output[key] = a[key] + (b[key] - a[key]) * t; return output;
}
function applyKeyframes() { for (const object of scene.objects) { const frame = sampleKeyframes(object.keyframes, time); if (frame) for (const key of transformKeys) object[key] = frame[key]; } }
function addKeyframe() {
  const object = selected(); if (!object) return toast("Select an object first.");
  if (object.keyframes.length >= 500) return toast("This object already has 500 keyframes.");
  history({ preserveSelectedPose: true }); const frame = { time: round(time) }; for (const key of transformKeys) frame[key] = object[key];
  object.keyframes = object.keyframes.filter((key) => Math.abs(key.time - frame.time) > 0.005); object.keyframes.push(frame); object.keyframes.sort((a, b) => a.time - b.time); changed(); toast(`Keyframe saved at ${frame.time.toFixed(2)} s`);
}
function capturePose() { return new Map(scene.objects.map((object) => [object.id, Object.fromEntries(transformKeys.map((key) => [key, object[key]]))])); }
function restorePose() { if (playbackPose) for (const object of scene.objects) { const pose = playbackPose.get(object.id); if (pose) Object.assign(object, pose); } bodyRuntime.clear(); fluidRuntime.clear(); }
function setPlayingUI() { $("playBtn").textContent = playing ? "Ⅱ Pause" : "▶︎ Play"; $("stagePlayBtn").textContent = playing ? "Ⅱ" : "▶︎"; $("stagePlayBtn").setAttribute("aria-label", playing ? "Pause animation and physics" : "Play animation and physics"); }
function stop() { playing = false; accumulator = 0; setPlayingUI(); }
function togglePlay() { if (playing) { stop(); refresh(); return; } if (!playbackPose) playbackPose = capturePose(); if (time >= scene.duration) { restorePose(); time = 0; } playing = true; accumulator = 0; lastFrame = 0; setPlayingUI(); }
function reset() { stop(); restorePose(); time = 0; applyKeyframes(); dirty = true; refresh(); }
function seek(value) {
  stop(); if (!playbackPose) playbackPose = capturePose(); restorePose();
  const target = clamp(finite(value), 0, scene.duration); time = 0; applyKeyframes();
  for (let tick = 1; tick <= Math.floor(target * 60 + 0.00001); tick++) { time = tick / 60; applyKeyframes(); physicsStep(1 / 60); }
  time = target; applyKeyframes(); dirty = true; refresh();
}

// Rigid bodies use convex-polygon SAT collision detection and impulse response.
// Concave stars and text collide as their convex outline; the rendered mesh keeps its holes.
function rigidState(object) {
  if (!bodyRuntime.has(object.id)) bodyRuntime.set(object.id, { vx: 0, vy: 0, angular: 0 });
  return bodyRuntime.get(object.id);
}
function worldPolygon(object) { return convexHull(polygonPoints(object)).map((point) => localToWorld(object, point)); }
function sat(a, b) {
  let depth = Infinity, normal = null;
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length], dx = q.x - p.x, dy = q.y - p.y, length = Math.hypot(dx, dy); if (!length) continue;
    const axis = { x: -dy / length, y: dx / length }, project = (points) => points.map((point) => point.x * axis.x + point.y * axis.y);
    const pa = project(a), pb = project(b), overlap = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
    if (overlap <= 0) return null;
    if (overlap < depth) { depth = overlap; normal = axis; }
  }
  if (!normal) return null;
  const center = (points) => ({ x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length });
  const ca = center(a), cb = center(b); if ((cb.x - ca.x) * normal.x + (cb.y - ca.y) * normal.y < 0) { normal.x *= -1; normal.y *= -1; }
  return { depth, normal };
}
function simulateRigid(dt) {
  const bodies = scene.objects.filter((o) => o.physics === "rigid" || o.physics === "static");
  const dynamic = (o) => o.physics === "rigid" && !o.keyframes.length;
  for (const object of bodies) if (dynamic(object)) {
    const body = rigidState(object); body.vy += scene.gravity * dt; body.vx *= 0.999; body.angular *= 0.996; object.x += body.vx * dt; object.y += body.vy * dt; object.rotation += body.angular * dt;
    if (scene.floorEnabled) {
      const points = worldPolygon(object), bottom = Math.max(...points.map((p) => p.y));
      if (bottom > scene.floor) { object.y -= bottom - scene.floor; if (body.vy > 0) body.vy = -body.vy * object.bounce; body.vx *= 0.96; body.angular *= 0.8; if (Math.abs(body.vy) < 0.05) body.vy = 0; }
    }
    if (Math.abs(object.x) > 1000 || Math.abs(object.y) > 1000) { object.x = clamp(object.x, -1000, 1000); object.y = clamp(object.y, -1000, 1000); body.vx = body.vy = 0; }
  }
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j]; if (!dynamic(a) && !dynamic(b)) continue;
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 12 * Math.max(a.sx, a.sy, b.sx, b.sy)) continue;
    const collision = sat(worldPolygon(a), worldPolygon(b)); if (!collision) continue;
    const ba = rigidState(a), bb = rigidState(b), invA = dynamic(a) ? 1 / a.mass : 0, invB = dynamic(b) ? 1 / b.mass : 0, sum = invA + invB, n = collision.normal;
    const amount = Math.max(0, collision.depth - 0.002) * 0.8 / sum;
    a.x -= n.x * amount * invA; a.y -= n.y * amount * invA; b.x += n.x * amount * invB; b.y += n.y * amount * invB;
    const speed = (bb.vx - ba.vx) * n.x + (bb.vy - ba.vy) * n.y; if (speed >= 0) continue;
    const impulse = -(1 + Math.min(a.bounce, b.bounce)) * speed / sum;
    ba.vx -= impulse * n.x * invA; ba.vy -= impulse * n.y * invA; bb.vx += impulse * n.x * invB; bb.vy += impulse * n.y * invB;
    const tangent = { x: -n.y, y: n.x }, friction = clamp(((bb.vx - ba.vx) * tangent.x + (bb.vy - ba.vy) * tangent.y) / sum, -impulse * 0.25, impulse * 0.25);
    ba.vx += friction * tangent.x * invA; ba.vy += friction * tangent.y * invA; bb.vx -= friction * tangent.x * invB; bb.vy -= friction * tangent.y * invB;
    if (invA) ba.angular += friction * 8 * invA; if (invB) bb.angular -= friction * 8 * invB;
  }
}

function softState(object) {
  const current = bodyRuntime.get(object.id); if (current?.nodes) return current;
  let points = polygonPoints(object); if (points.length < 8) points = points.flatMap((p, i) => { const next = points[(i + 1) % points.length]; return [p, { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 }]; });
  const nodes = points.slice(0, 64).map((point) => { const world = localToWorld(object, point); return { ...world, px: world.x, py: world.y }; });
  const springs = []; for (let i = 0; i < nodes.length; i++) for (const step of [1, 2, Math.floor(nodes.length / 2)]) { const j = (i + step) % nodes.length; springs.push({ i, j, length: Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) }); }
  const state = { nodes, springs, origins: nodes.map((node) => ({ x: node.x, y: node.y })) };
  if (object.type === "text") state.textContours = textMeshContours(object);
  bodyRuntime.set(object.id, state); return state;
}
function deformSoftPoint(object, state, point) {
  const world = localToWorld(object, point); let dx = 0, dy = 0, weights = 0;
  state.origins.forEach((origin, i) => { const weight = 1 / Math.max(0.0001, (world.x - origin.x) ** 2 + (world.y - origin.y) ** 2); dx += (state.nodes[i].x - origin.x) * weight; dy += (state.nodes[i].y - origin.y) * weight; weights += weight; });
  return { x: world.x + dx / weights, y: world.y + dy / weights };
}
function collideParticle(point, radius, colliders, bounce = 0.1) {
  if (scene.floorEnabled && point.y + radius > scene.floor) { const velocity = point.y - point.py; point.y = scene.floor - radius; point.py = point.y + Math.max(0, velocity) * bounce; point.px = point.x - (point.x - point.px) * 0.97; }
  for (const object of colliders) {
    const polygon = worldPolygon(object); if (!pointInPolygon(point, polygon)) continue;
    let distance = Infinity, closest = null;
    for (let i = 0; i < polygon.length; i++) { const a = polygon[i], b = polygon[(i + 1) % polygon.length], dx = b.x - a.x, dy = b.y - a.y, t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1), x = a.x + dx * t, y = a.y + dy * t, d = Math.hypot(point.x - x, point.y - y); if (d < distance) { distance = d; closest = { x, y, dx, dy }; } }
    if (closest) { const length = Math.hypot(closest.dx, closest.dy) || 1; point.x = closest.x + closest.dy / length * radius; point.y = closest.y - closest.dx / length * radius; point.px = point.x; point.py = point.y; }
  }
}
function simulateSoft(dt) {
  const colliders = scene.objects.filter((o) => o.physics === "rigid" || o.physics === "static");
  for (const object of scene.objects.filter((o) => o.physics === "soft")) {
    const state = softState(object); if (object.keyframes.length) { bodyRuntime.delete(object.id); softState(object); continue; }
    for (const node of state.nodes) { const vx = (node.x - node.px) * 0.992, vy = (node.y - node.py) * 0.992; node.px = node.x; node.py = node.y; node.x += vx; node.y += vy + scene.gravity * dt * dt; }
    for (let pass = 0; pass < 5; pass++) {
      for (const spring of state.springs) { const a = state.nodes[spring.i], b = state.nodes[spring.j], dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 0.0001, correction = (length - spring.length) / length * (1 - object.softness) * 0.5; a.x += dx * correction; a.y += dy * correction; b.x -= dx * correction; b.y -= dy * correction; }
      state.nodes.forEach((node) => collideParticle(node, 0.025, colliders, object.bounce));
    }
  }
}

function liquidState(object) {
  if (!fluidRuntime.has(object.id)) {
    const cols = Math.ceil(Math.sqrt(object.particleCount));
    fluidRuntime.set(object.id, Array.from({ length: object.particleCount }, (_, i) => { const p = localToWorld(object, { x: ((i % cols) - cols / 2) * 0.16, y: (Math.floor(i / cols) - cols / 2) * 0.16 }); return { ...p, px: p.x, py: p.y }; }));
  }
  return fluidRuntime.get(object.id);
}
function drawLiquid(object, exportOnly = false) {
  const particles = liquidState(object); ctx.save(); ctx.fillStyle = object.color; ctx.globalAlpha = object.opacity * 0.85;
  for (const point of particles) { ctx.beginPath(); ctx.arc(point.x, point.y, 0.098, 0, TAU); ctx.fill(); }
  ctx.restore(); if (object.id === selectedId && !playing && !exportOnly) drawSelection(object);
}
function simulateLiquid(dt) {
  const particles = scene.objects.filter((o) => o.type === "liquid").flatMap(liquidState); if (!particles.length) return;
  const colliders = scene.objects.filter((o) => o.physics === "rigid" || o.physics === "static"), cellSize = 0.32, radius = 0.072;
  for (const p of particles) { const vx = (p.x - p.px) * 0.985, vy = (p.y - p.py) * 0.985; p.px = p.x; p.py = p.y; p.x += clamp(vx, -0.2, 0.2); p.y += clamp(vy, -0.2, 0.2) + scene.gravity * dt * dt; }
  for (let pass = 0; pass < 3; pass++) {
    const hash = new Map(); for (let i = 0; i < particles.length; i++) { const p = particles[i], key = `${Math.floor(p.x / cellSize)},${Math.floor(p.y / cellSize)}`; if (!hash.has(key)) hash.set(key, []); hash.get(key).push(i); }
    for (let i = 0; i < particles.length; i++) { const a = particles[i], cx = Math.floor(a.x / cellSize), cy = Math.floor(a.y / cellSize);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (const j of hash.get(`${cx + ox},${cy + oy}`) || []) {
        if (j <= i) continue; const b = particles[j], dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 0.0001; if (distance > cellSize) continue;
        const displacement = distance < radius * 2 ? (radius * 2 - distance) * 0.4 : -(1 - distance / cellSize) * 0.0015, nx = dx / distance, ny = dy / distance;
        a.x -= nx * displacement; a.y -= ny * displacement; b.x += nx * displacement; b.y += ny * displacement;
        if (!pass) { const vx = ((b.x - b.px) - (a.x - a.px)) * 0.018, vy = ((b.y - b.py) - (a.y - a.py)) * 0.018; a.px -= vx; a.py -= vy; b.px += vx; b.py += vy; }
      }
      collideParticle(a, radius, colliders, 0.04);
      const left = -12, right = 12; if (a.x < left || a.x > right) { a.x = clamp(a.x, left, right); a.px = a.x; }
    }
  }
}
function physicsStep(dt) { simulateRigid(dt); simulateSoft(dt); simulateLiquid(dt); }
function frame(now) {
  const elapsed = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0; lastFrame = now;
  if (playing) {
    accumulator += elapsed;
    while (accumulator >= 1 / 60) {
      time += 1 / 60;
      if (time >= scene.duration) { if (scene.loop) { restorePose(); time = 0; } else { time = scene.duration; stop(); } }
      applyKeyframes(); physicsStep(1 / 60); accumulator = Math.max(0, accumulator - 1 / 60); if (!playing) break;
    }
    dirty = true; updateTimeUI();
  }
  if (dirty) render(); requestAnimationFrame(frame);
}

function rasterText(object) {
  const bounds = textBounds(object), unit = 48, margin = 2;
  const raster = document.createElement("canvas"); raster.width = clamp(Math.ceil(bounds.width * unit) + margin * 2, 8, 2048); raster.height = clamp(Math.ceil(bounds.height * unit) + margin * 2, 8, 1024);
  const c = raster.getContext("2d", { willReadFrequently: true }), scale = Math.min(unit, (raster.width - margin * 2) / bounds.width, (raster.height - margin * 2) / bounds.height);
  c.fillStyle = "white"; c.font = `bold ${scale}px "${object.font}"`; c.textAlign = "center"; c.textBaseline = "middle";
  object.text.split("\n").forEach((line, i) => c.fillText(line, raster.width / 2, (raster.height - bounds.height * scale) / 2 + scale * (0.6 + i * 1.2)));
  return { width: raster.width, height: raster.height, pixels: c.getImageData(0, 0, raster.width, raster.height).data, scale };
}
/** Trace directed exposed raster-cell edges into closed polygon rings; holes remain rings. */
export function traceRasterContours(width, height, filled) {
  const edges = new Map(), occupied = (x, y) => x >= 0 && x < width && y >= 0 && y < height && filled[y * width + x];
  const add = (x1, y1, x2, y2) => { const key = `${x1},${y1}`; if (!edges.has(key)) edges.set(key, []); edges.get(key).push({ x: x2, y: y2 }); };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (occupied(x, y)) { if (!occupied(x, y - 1)) add(x, y, x + 1, y); if (!occupied(x + 1, y)) add(x + 1, y, x + 1, y + 1); if (!occupied(x, y + 1)) add(x + 1, y + 1, x, y + 1); if (!occupied(x - 1, y)) add(x, y + 1, x, y); }
  const rings = [];
  while (edges.size) {
    const startKey = edges.keys().next().value, [x, y] = startKey.split(",").map(Number), ring = [{ x, y }]; let current = startKey, guard = width * height * 4;
    while (guard-- > 0) { const destinations = edges.get(current); if (!destinations?.length) break; const next = destinations.pop(); if (!destinations.length) edges.delete(current); current = `${next.x},${next.y}`; if (current === startKey) break; ring.push(next); }
    const simple = ring.filter((point, index) => { const prev = ring[(index + ring.length - 1) % ring.length], next = ring[(index + 1) % ring.length]; return (point.x - prev.x) * (next.y - point.y) !== (point.y - prev.y) * (next.x - point.x); });
    if (simple.length >= 3) rings.push(simple);
  }
  return rings;
}
function convertText(mode) {
  const object = selected(); if (object?.type !== "text") return;
  if (!object.text.trim()) return toast("Write some text first.");
  const raster = rasterText(object), { width, height, pixels, scale } = raster;
  if (mode === "mesh") {
    const contours = textMeshContours(object, raster);
    if (!contours.length) return toast("This text has no visible outlines.");
    if (contours.flat().length > 20000 || contours.length > 400) return toast("This text is too detailed. Use fewer letters to convert it.");
    history(); object.type = "mesh"; object.contours = contours; object.name = `Text mesh · ${object.text.slice(0, 20)}`; delete object.text; delete object.font;
  } else {
    const sources = [], stride = Math.max(4, Math.ceil(Math.sqrt(width * height / 1000)));
    for (let y = stride / 2 | 0; y < height; y += stride) for (let x = stride / 2 | 0; x < width; x += stride) if (pixels[(y * width + x) * 4 + 3] > 100) sources.push({ x: (x - width / 2) / scale, y: (y - height / 2) / scale, r: stride / scale * 0.56 });
    if (!sources.length) return toast("Use larger text or a heavier font to create metaballs.");
    if (sources.length > 400) return toast("Use fewer letters to convert this text.");
    history(); object.type = "meta"; object.sources = sources; object.name = `Text blobs · ${object.text.slice(0, 20)}`; delete object.text; delete object.font;
  }
  changed({ geometry: true }); toast(mode === "mesh" ? "Text converted to editable polygon mesh." : "Text converted to merging metaballs.");
}
function textMeshContours(object, raster = rasterText(object)) {
  const { width, height, pixels, scale } = raster, filled = new Uint8Array(width * height);
  for (let i = 0; i < filled.length; i++) filled[i] = pixels[i * 4 + 3] > 120 ? 1 : 0;
  return traceRasterContours(width, height, filled).map((ring) => ring.map((point) => ({ x: (point.x - width / 2) / scale, y: (point.y - height / 2) / scale })));
}
function refreshFontOptions() {
  const select = $("fontFamily"); for (const option of [...select.options]) if (option.value.startsWith("RiderFont_")) option.remove();
  for (const font of scene.fonts) { const option = document.createElement("option"); option.value = font.family; option.textContent = font.name; select.append(option); }
}
async function loadProjectFonts(project) {
  for (const font of project.fonts) {
    if (fontRegistry.has(font.family)) continue;
    const face = new FontFace(font.family, `url(${font.data})`); await face.load(); document.fonts.add(face); fontRegistry.set(font.family, face);
  }
}
async function uploadFont(file) {
  if (!file) return; const object = selected(); if (object?.type !== "text") return;
  if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) return toast("Choose a TTF, OTF, WOFF or WOFF2 font.");
  if (file.size > 4 * 1024 * 1024 || scene.fonts.length >= 4) return toast("Upload up to four fonts, each smaller than 4 MB.");
  if (scene.fonts.reduce((sum, font) => sum + font.data.length, 0) + file.size * 1.34 > 12000000) return toast("Project fonts must fit within 8 MB.");
  try {
    const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("Could not read that font.")); reader.readAsDataURL(file); });
    const extension = file.name.split(".").at(-1).toLowerCase(), normalized = data.replace(/^data:[^;]*;/, `data:font/${extension};`), family = `RiderFont_${uuid().replaceAll("-", "_")}`;
    const font = { family, name: file.name.slice(0, 80), data: normalized }; await loadProjectFonts({ fonts: [font] }); history(); scene.fonts.push(font); object.font = family; refreshFontOptions(); changed({ geometry: true }); toast("Font loaded and included in project saves.");
  } catch { toast("That font could not be loaded. Try a different font file."); }
}

function download(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function filename(extension) { return `${scene.name.replace(/[^a-z0-9_-]/gi, "_").slice(0, 60) || "2d-rider"}.${extension}`; }
async function importProject(file) {
  if (!file) return;
  if (file.size > 18 * 1024 * 1024) return toast("Choose a project smaller than 18 MB.");
  try { const project = validateProject(JSON.parse(await file.text())); await loadProjectFonts(project); history(); scene = project; selectedId = scene.objects[0]?.id || null; time = 0; playbackPose = null; refreshFontOptions(); changed({ geometry: true }); fitScene(); closePanels(); toast("Project opened."); }
  catch (error) { toast(error.message || "This project could not be opened."); }
}
function fitScene() {
  const points = scene.objects.flatMap((object) => polygonPoints(object).map((point) => localToWorld(object, point)));
  if (!points.length) { view.x = view.y = 0; view.zoom = Math.max(16, Math.min(65, view.width / 6, view.height / 5)); dirty = true; return; }
  const minX = Math.min(...points.map((p) => p.x)), maxX = Math.max(...points.map((p) => p.x)), minY = Math.min(...points.map((p) => p.y)), maxY = Math.max(...points.map((p) => p.y));
  view.x = (minX + maxX) / 2; view.y = (minY + maxY) / 2; view.zoom = clamp(Math.min(view.width / (maxX - minX + 1), view.height / (maxY - minY + 1)) * 0.82, 5, 400); dirty = true;
}

// Pointer capture keeps dragging reliable on watches; two fingers pinch and pan together.
const pointers = new Map(); let drag = null, pinch = null;
canvas.addEventListener("pointerdown", (event) => {
  if (event.button > 0) return; event.preventDefault(); canvas.focus(); stop();
  const rect = canvas.getBoundingClientRect(), point = { x: event.clientX - rect.left, y: event.clientY - rect.top }; pointers.set(event.pointerId, point); canvas.setPointerCapture(event.pointerId);
  if (pointers.size === 2) { const [a, b] = [...pointers.values()], middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom, anchor: screenToWorld(middle.x, middle.y) }; drag = null; return; }
  const world = screenToWorld(point.x, point.y), object = hitTest(world);
  if (object) { selectObject(object.id); drag = { kind: "object", id: object.id, start: world, x: object.x, y: object.y, moved: false }; }
  else { selectObject(null); drag = { kind: "pan", x: point.x, y: point.y, viewX: view.x, viewY: view.y }; }
});
canvas.addEventListener("pointermove", (event) => {
  if (!pointers.has(event.pointerId)) return; const rect = canvas.getBoundingClientRect(), point = { x: event.clientX - rect.left, y: event.clientY - rect.top }; pointers.set(event.pointerId, point);
  if (pointers.size === 2 && pinch) { const [a, b] = [...pointers.values()], middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; view.zoom = clamp(pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.distance), 5, 400); view.x = pinch.anchor.x - (middle.x - view.width / 2) / view.zoom; view.y = pinch.anchor.y - (middle.y - view.height / 2) / view.zoom; dirty = true; return; }
  if (!drag) return;
  if (drag.kind === "pan") { view.x = drag.viewX - (point.x - drag.x) / view.zoom; view.y = drag.viewY - (point.y - drag.y) / view.zoom; dirty = true; }
  else {
    const world = screenToWorld(point.x, point.y), object = scene.objects.find((item) => item.id === drag.id); if (!object) return;
    if (!drag.moved && Math.hypot(world.x - drag.start.x, world.y - drag.start.y) * view.zoom > 3) { history({ preserveSelectedPose: true }); drag.moved = true; }
    if (drag.moved) { object.x = clamp(drag.x + world.x - drag.start.x, -1000, 1000); object.y = clamp(drag.y + world.y - drag.start.y, -1000, 1000); bodyRuntime.delete(object.id); fluidRuntime.delete(object.id); dirty = true; }
  }
});
function finishPointer(event) { pointers.delete(event.pointerId); if (drag?.moved) changed({ geometry: true }); if (pointers.size < 2) pinch = null; drag = null; }
canvas.addEventListener("pointerup", finishPointer); canvas.addEventListener("pointercancel", finishPointer);
canvas.addEventListener("wheel", (event) => { event.preventDefault(); const rect = canvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top, anchor = screenToWorld(x, y); view.zoom = clamp(view.zoom * Math.exp(-event.deltaY * 0.001), 5, 400); view.x = anchor.x - (x - view.width / 2) / view.zoom; view.y = anchor.y - (y - view.height / 2) / view.zoom; dirty = true; }, { passive: false });

document.querySelectorAll("[data-add]").forEach((button) => button.addEventListener("click", () => addObject(button.dataset.add)));
document.querySelectorAll("[data-meta]").forEach((button) => button.addEventListener("click", () => addObject("meta", button.dataset.meta)));
document.querySelectorAll("[data-panel]").forEach((button) => button.addEventListener("click", () => openPanel(button.dataset.panel)));
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closePanels));
$("projectMenuBtn").addEventListener("click", () => openPanel("projectPanel"));
$("sceneList").addEventListener("click", (event) => { const button = event.target.closest("[data-object]"); if (button) { selectObject(button.dataset.object); if (window.innerWidth <= 640) { closePanels(); openPanel("editPanel"); } } });
$("addLiquidBtn").addEventListener("click", () => addObject("liquid"));
for (const key of [...transformKeys, "color", "shader", "opacity", "physics", "mass", "bounce", "softness", "influence"]) $(key).addEventListener("change", () => {
  const object = selected(); if (!object) return; history({ preserveSelectedPose: transformKeys.includes(key) });
  if (key === "color" || key === "shader" || key === "physics") object[key] = $(key).value;
  else object[key] = clamp(finite($(key).value, object[key]), key.startsWith("s") && key !== "softness" ? 0.05 : key === "mass" ? 0.1 : key === "opacity" ? 0.1 : key === "influence" ? 0.5 : ["bounce", "softness"].includes(key) ? 0 : -36000, ["sx", "sy"].includes(key) ? 50 : key === "mass" ? 100 : ["bounce", "softness", "opacity"].includes(key) ? 1 : key === "influence" ? 2.5 : 36000);
  changed({ geometry: true });
});
$("uniformScale").addEventListener("change", () => { const object = selected(); if (!object) return; history({ preserveSelectedPose: true }); object.sx = object.sy = clamp(finite($("uniformScale").value, 1), 0.05, 50); changed({ geometry: true }); });
function quickTransform(property, delta, multiply = false) { const object = selected(); if (!object) return; history({ preserveSelectedPose: true }); if (property === "scale") { object.sx = clamp(object.sx * delta, 0.05, 50); object.sy = clamp(object.sy * delta, 0.05, 50); } else object[property] = multiply ? object[property] * delta : object[property] + delta; changed({ geometry: true }); }
$("rotateLeftBtn").addEventListener("click", () => quickTransform("rotation", -15)); $("rotateRightBtn").addEventListener("click", () => quickTransform("rotation", 15)); $("smallerBtn").addEventListener("click", () => quickTransform("scale", 0.85)); $("largerBtn").addEventListener("click", () => quickTransform("scale", 1.15));
$("objectName").addEventListener("change", () => { const object = selected(); if (!object) return; history(); object.name = $("objectName").value.trim().slice(0, 80) || object.type; changed(); });
$("projectName").addEventListener("change", () => { history(); scene.name = $("projectName").value.trim().slice(0, 80) || "Untitled 2D scene"; changed(); });
$("textContent").addEventListener("change", () => { const object = selected(); if (object?.type !== "text") return; history(); object.text = $("textContent").value.slice(0, 160); changed({ geometry: true }); });
$("fontFamily").addEventListener("change", () => { const object = selected(); if (object?.type !== "text") return; history(); object.font = $("fontFamily").value; changed({ geometry: true }); });
$("uploadFontBtn").addEventListener("click", () => $("fontFile").click()); $("fontFile").addEventListener("change", async () => { await uploadFont($("fontFile").files[0]); $("fontFile").value = ""; });
$("textMeshBtn").addEventListener("click", () => convertText("mesh")); $("textMetaBtn").addEventListener("click", () => convertText("meta"));
function deleteSelected() { if (!selected()) return; history(); scene.objects = scene.objects.filter((object) => object.id !== selectedId); selectedId = null; changed({ geometry: true }); }
$("deleteBtn").addEventListener("click", deleteSelected);
$("duplicateBtn").addEventListener("click", () => { const object = selected(); if (!object) return; if (scene.objects.length >= MAX_OBJECTS) return toast("This scene is full."); if (object.type === "liquid" && scene.objects.filter((o) => o.type === "liquid").reduce((sum, o) => sum + o.particleCount, 0) + object.particleCount > MAX_PARTICLES) return toast("Liquid is limited to 240 particles per scene."); history(); const copy = clone(object); copy.id = uuid(); copy.name = `${object.name} copy`.slice(0, 80); copy.x += 0.5; copy.y += 0.3; copy.keyframes.forEach((key) => { key.x += 0.5; key.y += 0.3; }); scene.objects.push(copy); selectedId = copy.id; changed({ geometry: true }); });
$("addKeyframeBtn").addEventListener("click", addKeyframe); $("timelineKeyBtn").addEventListener("click", addKeyframe);
$("keyframeList").addEventListener("click", (event) => { const button = event.target.closest("button"); if (!button) return; if (button.dataset.seek !== undefined) seek(button.dataset.seek); else if (button.dataset.removeKey !== undefined) { const object = selected(); if (object) { history(); object.keyframes.splice(Number(button.dataset.removeKey), 1); changed(); } } });
$("playBtn").addEventListener("click", togglePlay); $("stagePlayBtn").addEventListener("click", togglePlay); $("resetBtn").addEventListener("click", reset); $("time").addEventListener("input", () => seek($("time").value)); $("timeNumber").addEventListener("change", () => seek($("timeNumber").value));
for (const key of ["duration", "gravity", "floor"]) $(key).addEventListener("change", () => { history(); const limits = key === "duration" ? [0.2, 120] : key === "floor" ? [-100, 100] : [-30, 30]; scene[key] = clamp(finite($(key).value, scene[key]), ...limits); if (key === "duration") { const lastKey = Math.max(0, ...scene.objects.flatMap((o) => o.keyframes.map((frame) => frame.time))); if (scene.duration < lastKey) { scene.duration = lastKey; toast(`Duration kept at ${lastKey.toFixed(2)} s to preserve existing keyframes.`); } time = Math.min(time, scene.duration); } changed(); });
for (const key of ["loop", "floorEnabled", "grid"]) $(key).addEventListener("change", () => { history(); scene[key] = $(key).checked; changed(); });
$("background").addEventListener("change", () => { history(); scene.background = $("background").value; changed(); });
$("zoomOutBtn").addEventListener("click", () => { view.zoom = clamp(view.zoom / 1.3, 5, 400); dirty = true; }); $("zoomInBtn").addEventListener("click", () => { view.zoom = clamp(view.zoom * 1.3, 5, 400); dirty = true; }); $("fitBtn").addEventListener("click", fitScene);
$("saveBtn").addEventListener("click", () => { download(new Blob([JSON.stringify(projectData(), null, 2)], { type: "application/json" }), filename("2drider")); scheduleSave(); toast("Project downloaded."); });
$("exportBtn").addEventListener("click", () => { render(true); canvas.toBlob((blob) => { if (blob) download(blob, filename("png")); dirty = true; }, "image/png"); });
$("openBtn").addEventListener("click", () => $("projectFile").click()); $("projectFile").addEventListener("change", async () => { await importProject($("projectFile").files[0]); $("projectFile").value = ""; });
$("newBtn").addEventListener("click", () => { if (scene.objects.length && !confirm("Start a new 2D scene? Save your current project first if you want to keep it.")) return; history(); scene = emptyScene(); selectedId = null; time = 0; playbackPose = null; refreshFontOptions(); changed({ geometry: true }); fitScene(); closePanels(); });
async function travelHistory(direction) {
  const stack = direction === "undo" ? undoStack : redoStack, opposite = direction === "undo" ? redoStack : undoStack; if (!stack.length) return;
  stop(); opposite.push(projectData()); scene = stack.pop(); selectedId = scene.objects.some((o) => o.id === selectedId) ? selectedId : null; time = clamp(time, 0, scene.duration); playbackPose = null; await loadProjectFonts(scene); refreshFontOptions(); changed({ geometry: true });
}
$("undoBtn").addEventListener("click", () => travelHistory("undo")); $("redoBtn").addEventListener("click", () => travelHistory("redo"));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { closePanels(); stop(); return; }
  if (event.key === "Tab") {
    const panel = document.querySelector(".panel.open");
    if (panel) { const targets = [...panel.querySelectorAll("button,a,input,select,textarea")].filter((node) => !node.disabled && node.getClientRects().length), first = targets[0], last = targets.at(-1); if (targets.length && (document.activeElement === panel || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); } }
  }
  if (event.target.closest("input,textarea,select")) return;
  if (event.code === "Space") { event.preventDefault(); togglePlay(); }
  else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSelected(); }
  else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); $("saveBtn").click(); }
  else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); travelHistory(event.shiftKey ? "redo" : "undo"); }
  else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && selected()) { event.preventDefault(); const object = selected(), amount = event.shiftKey ? 1 : 0.1; history({ preserveSelectedPose: true }); object.x += event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0; object.y += event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0; changed({ geometry: true }); }
});
document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
new ResizeObserver(resize).observe($("stage"));
async function start() {
  let restored = false;
  try { const stored = localStorage.getItem(STORAGE_KEY); if (stored) { const loaded = validateProject(JSON.parse(stored)); await loadProjectFonts(loaded); scene = loaded; restored = true; } }
  catch { toast("The saved scene could not be restored. Open a project to recover it."); }
  if (!restored) {
    const first = makeObject("circle"); Object.assign(first, { x: -1.1, y: -0.8, physics: "rigid", color: "#b28cf3" });
    const second = makeObject("rect"); Object.assign(second, { x: 1.1, y: 0.3, rotation: -12, color: "#66c6d4" }); scene.objects.push(first, second);
  }
  selectedId = scene.objects[0]?.id || null; refreshFontOptions(); resize(); fitScene(); refresh(); scheduleSave(); requestAnimationFrame(frame);
}
start();
