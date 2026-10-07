import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// The browser module initializes canvas/UI eagerly. Isolate its actual pure
// functions and constants for Node; no renderer or implementation is mocked.
const source = await readFile(new URL("../rider-2d.js", import.meta.url), "utf8");
const functionSource = (name) => {
  const match = source.match(new RegExp(`(?:^|\\n)(?:export )?function ${name}\\([^]*?\\n\\}`, "m"));
  assert.ok(match, `Missing pure function ${name}`);
  return match[0].trim().replace(/^export /, "");
};
const constants = source.slice(source.indexOf("const TAU"), source.indexOf("let scene"));
const names = ["emptyScene", "makeObject", "makeMetaSources", "validateProject", "sampleKeyframes", "traceRasterContours"];
const pureSource = `${constants}\nlet scene;\n${names.map(functionSource).join("\n")}\nscene=emptyScene();\nexport { validateProject, sampleKeyframes, traceRasterContours };`;
const { validateProject, sampleKeyframes, traceRasterContours } = await import("data:text/javascript;base64," + Buffer.from(pureSource).toString("base64"));
const object = (id, overrides = {}) => ({ id, type: "rect", name: "A rectangle", x: 1, y: -2, rotation: 45, sx: 1.5, sy: 2, color: "#123456", shader: "neon", opacity: 0.7, physics: "rigid", mass: 3, bounce: 0.2, softness: 0.3, influence: 1.4, keyframes: [], ...overrides });
const project = (...objects) => ({ format: "2d-rider", version: 1, name: "A 2D scene", duration: 6, loop: false, gravity: 9.2, floor: 4, floorEnabled: false, background: "#102030", grid: false, fonts: [], objects });

test("2D projects preserve transforms, animation, shaders and physics through JSON saves", () => {
  const input = project(object("box", {
    keyframes: [{ time: 0, x: -2, y: 0, rotation: 0, sx: 1, sy: 1 }, { time: 3, x: 3, y: 4, rotation: 360, sx: 2, sy: 3 }],
  }));
  const imported = validateProject(input);
  const saved = validateProject(JSON.parse(JSON.stringify(imported)));
  assert.deepEqual(saved, imported);
  for (const key of ["x", "y", "rotation", "sx", "sy", "shader", "opacity", "physics", "mass", "bounce", "softness", "influence", "keyframes"])
    assert.deepEqual(imported.objects[0][key], input.objects[0][key]);
  for (const key of ["duration", "loop", "gravity", "floor", "floorEnabled", "background", "grid"])
    assert.deepEqual(imported[key], input[key]);
  imported.objects[0].keyframes[0].x = 100;
  assert.equal(input.objects[0].keyframes[0].x, -2);
});

test("uploaded fonts and text-to-mesh or metaball sources preserve their geometry", () => {
  const font = { family: "RiderFont_local_1", name: "A font.ttf", data: "data:font/ttf;base64,AAEAAA==" };
  const input = {
    ...project(
      object("text", { type: "text", text: "Résumé\n<title>", font: font.family }),
      object("mesh", { type: "mesh", contours: [[{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }], [{ x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }, { x: 0, y: 0.5 }]] }),
      object("meta", { type: "meta", sources: [{ x: -1, y: 0.3, r: 0.25 }, { x: 1, y: -0.3, r: 0.4 }] }),
    ), fonts: [font],
  };
  const output = validateProject(input);
  assert.deepEqual(output.fonts, [font]);
  assert.equal(output.objects[0].text, "Résumé\n<title>");
  assert.equal(output.objects[0].font, font.family);
  assert.deepEqual(output.objects[1].contours, input.objects[1].contours);
  assert.deepEqual(output.objects[2].sources, input.objects[2].sources);
  output.objects[1].contours[0][0].x = 500;
  assert.equal(input.objects[1].contours[0][0].x, -1);
});

test("2D validation rejects wrong formats, duplicate IDs, malformed geometry and excess work", () => {
  for (const input of [null, {}, { ...project(), version: 2 }, { ...project(), format: "3d-rider" }, project(object("same"), object("same")), project(object("unknown", { type: "camera" })), project(object("badMesh", { type: "mesh", contours: [[{ x: 0, y: 0 }]] })), project(object("badMeta", { type: "meta", sources: [] })), project(object("keys", { keyframes: Array(501).fill({ time: 0 }) })), project(...Array.from({ length: 151 }, (_, i) => object(`o${i}`)))])
    assert.throws(() => validateProject(input));
  assert.throws(() => validateProject({ ...project(), fonts: [{ family: "bad", data: "https://example.invalid/font.ttf" }] }));
  assert.throws(() => validateProject(project(object("water1", { type: "liquid", particleCount: 150 }), object("water2", { type: "liquid", particleCount: 150 }))));
});

test("2D keyframe interpolation handles movement, scaling, full turns and independent output", () => {
  const frames = [{ time: 0, x: 0, y: 2, rotation: 0, sx: 1, sy: 2 }, { time: 2, x: 4, y: -2, rotation: 360, sx: 3, sy: 4 }];
  assert.equal(sampleKeyframes([], 1), null);
  assert.deepEqual(sampleKeyframes(frames, 1), { x: 2, y: 0, rotation: 180, sx: 2, sy: 3 });
  const first = sampleKeyframes(frames, -1);
  first.x = 500;
  assert.equal(frames[0].x, 0);
  assert.deepEqual(sampleKeyframes(frames, 3), frames[1]);
});

const signedArea = (points) => points.reduce((sum, point, index) => { const next = points[(index + 1) % points.length]; return sum + point.x * next.y - next.x * point.y; }, 0) / 2;

test("raster contours trace actual text-like holes without filling their interior", () => {
  const filled = Uint8Array.from([1, 1, 1, 1, 0, 1, 1, 1, 1]);
  const rings = traceRasterContours(3, 3, filled);
  assert.equal(rings.length, 2);
  assert.ok(rings.every((ring) => ring.length >= 4));
  assert.equal(rings.reduce((sum, ring) => sum + signedArea(ring), 0), 8);
  assert.ok(rings.some((ring) => signedArea(ring) < 0), "the hole has the opposite winding");
});

test("raster contours preserve disconnected characters and ignore empty images", () => {
  assert.deepEqual(traceRasterContours(2, 2, new Uint8Array(4)), []);
  const rings = traceRasterContours(5, 2, Uint8Array.from([1, 1, 0, 1, 1, 1, 1, 0, 1, 1]));
  assert.equal(rings.length, 2);
  assert.equal(rings.reduce((sum, ring) => sum + signedArea(ring), 0), 8);
  assert.ok(rings.every((ring) => ring.length === 4), "straight pixel runs reduce to rectangle corners");
});
