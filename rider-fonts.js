import * as THREE from "three";
import { Font } from "three/addons/loaders/FontLoader.js";
import { TTFLoader } from "three/addons/loaders/TTFLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

export const MAX_FONT_BYTES = 8 * 1024 * 1024;
const DEFAULT_FONT_URL = new URL(
  "./assets/fonts/helvetiker_regular.typeface.json",
  import.meta.url,
);
const fontCache = new WeakMap();
let defaultFont = null;
let defaultFontPromise = null;

function fontLabel(value, fallback = "Uploaded font") {
  return String(value || fallback)
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069<>]/g, "")
    .trim().slice(0, 100) || fallback;
}

function finiteNumber(value, label, limit = 1e7) {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > limit) {
    throw new Error(`Invalid font ${label}.`);
  }
  return value;
}

function cleanOutline(outline) {
  if (outline == null || outline === "") return "";
  if (typeof outline !== "string") throw new Error("Invalid glyph outline.");
  if (outline.length > 100000) throw new Error("A font glyph is too complex to render safely.");
  const tokens = outline.trim().split(/\s+/);
  if (tokens.length > 12000) throw new Error("A font glyph is too complex to render safely.");
  const counts = { m: 2, l: 2, q: 4, b: 6, z: 0 };
  let hasMove = false;
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++];
    if (!Object.hasOwn(counts, command)) throw new Error("Unsupported glyph outline command.");
    if (command === "m") hasMove = true;
    else if (!hasMove) throw new Error("A glyph outline must start with a move command.");
    const count = counts[command];
    if (i + count > tokens.length) throw new Error("Incomplete glyph outline.");
    for (let n = 0; n < count; n++) {
      const token = tokens[i++];
      if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(token)) {
        throw new Error("Invalid glyph coordinate.");
      }
      finiteNumber(Number(token), "coordinate");
    }
  }
  return tokens.join(" ");
}

function fallbackGlyph(resolution) {
  // Provide a visible question mark even when an uploaded font omits it.
  const outline = "m 100 700 l 100 850 l 220 950 l 480 950 l 600 850 l 600 650 l 500 550 l 400 500 l 400 350 l 250 350 l 250 570 l 430 660 l 450 700 l 450 790 l 400 830 l 260 830 l 220 790 l 220 700 l 100 700 m 250 220 l 400 220 l 400 80 l 250 80 l 250 220";
  return {
    ha: resolution * 0.7,
    o: outline.split(" ").map((token) => /^[ml]$/.test(token) ? token : String(Number(token) * resolution / 1000)).join(" "),
  };
}

/** Return plain, validated typeface data suitable for saving inside a project. */
export function normalizeFontData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The font must be Three.js typeface JSON.");
  }
  let serialized;
  try {
    serialized = JSON.stringify(data);
  } catch {
    throw new Error("The font contains invalid or circular data.");
  }
  if (new TextEncoder().encode(serialized).byteLength > MAX_FONT_BYTES) {
    throw new Error("Choose a font smaller than 8 MiB.");
  }
  const resolution = finiteNumber(data.resolution, "resolution", 100000);
  if (resolution <= 0) throw new Error("Font resolution must be positive.");
  if (!data.glyphs || typeof data.glyphs !== "object" || Array.isArray(data.glyphs)) {
    throw new Error("The font has no glyphs.");
  }
  const entries = Object.entries(data.glyphs);
  if (!entries.length || entries.length > 20000) throw new Error("The font has an unsupported glyph count.");
  const glyphs = Object.create(null);
  let outlines = 0;
  for (const [character, glyph] of entries) {
    if (Array.from(character).length !== 1 || !glyph || typeof glyph !== "object") {
      throw new Error("Invalid font glyph.");
    }
    const ha = finiteNumber(glyph.ha, "glyph advance");
    if (ha < 0) throw new Error("A glyph advance cannot be negative.");
    const o = cleanOutline(glyph.o);
    if (o) outlines++;
    glyphs[character] = { ha, o };
  }
  if (!outlines) throw new Error("The font contains no drawable glyphs.");
  if (!Object.hasOwn(glyphs, "?")) glyphs["?"] = fallbackGlyph(resolution);
  if (!Object.hasOwn(glyphs, " ")) glyphs[" "] = { ha: resolution * 0.35, o: "" };
  const sourceBounds = data.boundingBox;
  if (!sourceBounds || typeof sourceBounds !== "object") throw new Error("The font has no bounding box.");
  const boundingBox = {};
  for (const key of ["xMin", "xMax", "yMin", "yMax"]) {
    boundingBox[key] = finiteNumber(sourceBounds[key], "bounding box");
  }
  if (boundingBox.xMin > boundingBox.xMax || boundingBox.yMin >= boundingBox.yMax) {
    throw new Error("Invalid font bounding box.");
  }
  const normalized = {
    glyphs,
    resolution,
    boundingBox,
    familyName: fontLabel(data.familyName),
    underlineThickness: data.underlineThickness == null ? resolution * 0.05 : finiteNumber(data.underlineThickness, "underline thickness"),
    ascender: data.ascender == null ? boundingBox.yMax : finiteNumber(data.ascender, "ascender"),
    descender: data.descender == null ? boundingBox.yMin : finiteNumber(data.descender, "descender"),
  };
  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > MAX_FONT_BYTES) {
    throw new Error("The converted font is larger than 8 MiB.");
  }
  return normalized;
}

/** Fetch the bundled font once; a failed download can be retried. */
export async function loadDefaultFont() {
  if (defaultFont) return defaultFont;
  if (!defaultFontPromise) {
    defaultFontPromise = (async () => {
      const response = await fetch(DEFAULT_FONT_URL);
      if (!response.ok) throw new Error("The default text font could not be loaded.");
      defaultFont = new Font(normalizeFontData(await response.json()));
      return defaultFont;
    })().catch((error) => {
      defaultFontPromise = null;
      throw error;
    });
  }
  return defaultFontPromise;
}

/** Read a local typeface JSON, TrueType, or OpenType font without uploading it. */
export async function readFontFile(file) {
  if (!file || !Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_FONT_BYTES) {
    throw new Error("Choose a font file between 1 byte and 8 MiB.");
  }
  const extension = String(file.name || "").split(".").pop().toLowerCase();
  if (!["json", "ttf", "otf"].includes(extension)) {
    throw new Error("Choose a .json, .ttf, or .otf font.");
  }
  let parsed;
  try {
    parsed = extension === "json"
      ? JSON.parse(await file.text())
      : new TTFLoader().parse(await file.arrayBuffer());
  } catch {
    throw new Error("This font could not be read. Use a valid Three.js JSON, TrueType, or OpenType font.");
  }
  const fontData = normalizeFontData(parsed);
  return {
    fontData,
    fontFamily: fontData.familyName,
    fontName: fontLabel(file.name || fontData.familyName),
  };
}

function boundedNumber(value, fallback, min, max) {
  return Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
}

/** Create editable text geometry. Call loadDefaultFont before creating default text. */
export function createTextGeometry(record, { mode = "3d" } = {}) {
  const text = record?.text || {};
  let font = defaultFont;
  if (text.fontData) {
    font = fontCache.get(text.fontData);
    if (!font) {
      font = new Font(normalizeFontData(text.fontData));
      fontCache.set(text.fontData, font);
    }
  }
  if (!font) throw new Error("Load the default font before adding text.");
  const content = Array.from(String(text.content ?? "Text").replace(/\r\n?/g, "\n").slice(0, 1000))
    .map((character) => character === "\n" || Object.hasOwn(font.data.glyphs, character) ? character : "?")
    .join("");
  let pointBudget = 0;
  const glyphCosts = new Map();
  for (const character of Array.from(content)) {
    if (character === "\n") continue;
    if (!glyphCosts.has(character)) {
      const outline = font.data.glyphs[character].o || "";
      const curves = (outline.match(/[qb]/g) || []).length;
      const lines = (outline.match(/[ml]/g) || []).length;
      glyphCosts.set(character, curves * 8 + lines);
    }
    pointBudget += glyphCosts.get(character);
    if (pointBudget > 120000) {
      throw new Error("This text is too complex. Use fewer characters or a simpler font.");
    }
  }
  const size = boundedNumber(text.size, 1, 0.02, 1000);
  const geometry = mode === "2d"
    ? new THREE.ShapeGeometry(font.generateShapes(content, size), 8)
    : new TextGeometry(content, {
      font,
      size,
      depth: boundedNumber(text.depth, 0.2, 0.001, 1000),
      curveSegments: 8,
      bevelEnabled: false,
    });
  if (geometry.getAttribute("position")?.count) {
    geometry.computeBoundingBox();
    geometry.center();
    geometry.computeVertexNormals();
  }
  return geometry;
}
