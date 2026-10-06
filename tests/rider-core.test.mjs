import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// The deployed app uses browser ES modules; loading from a data URL avoids package.json assumptions.
const source = await readFile(
  new URL("../rider-core.js", import.meta.url),
  "utf8",
);
const {
  PRIMITIVES,
  PARAMETER_LIMITS,
  MAX_OBJECTS,
  MAX_PROJECT_BYTES,
  MAX_GEOMETRY_VALUES,
  createObjectRecord,
  createTemplate,
  normalizeProject,
  serializeProject,
  History,
  safeName,
} = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);

function triangle() {
  return {
    metadata: {
      version: 4.6,
      type: "BufferGeometry",
      generator: "BufferGeometry.toJSON",
    },
    uuid: "triangle-fixture",
    type: "BufferGeometry",
    userData: { source: "local STL" },
    data: {
      attributes: {
        position: {
          itemSize: 3,
          type: "Float32Array",
          array: [0, 0, 0, 1, 0, 0, 0, 1, 0],
          normalized: false,
        },
        normal: {
          itemSize: 3,
          type: "Float32Array",
          array: [0, 0, 1, 0, 0, 1, 0, 0, 1],
          normalized: false,
        },
        uv: {
          itemSize: 2,
          type: "Float32Array",
          array: [0, 0, 1, 0, 0, 1],
          normalized: false,
        },
      },
      index: { type: "Uint16Array", array: [0, 1, 2] },
      groups: [{ start: 0, count: 3, materialIndex: 0 }],
      boundingSphere: { center: [0.5, 0.5, 0], radius: 0.70710678 },
    },
  };
}
const projectWith = (...objects) => ({
  version: 2,
  name: "Test project",
  objects,
});

test("all primitive defaults create independent complete records", () => {
  assert.equal(PRIMITIVES.length, 8);
  for (const definition of PRIMITIVES) {
    const first = createObjectRecord(definition.type);
    const second = createObjectRecord(definition.type);
    assert.deepEqual(first.parameters, definition.defaults);
    assert.notEqual(first.id, second.id);
    assert.deepEqual(first.rotation, [0, 0, 0]);
    assert.deepEqual(first.scale, [1, 1, 1]);
    first.position[0] = 10;
    assert.equal(second.position[0], 0);
  }
  assert.equal(Object.isFrozen(PRIMITIVES[0].defaults), true);
  assert.equal(Object.isFrozen(PARAMETER_LIMITS.radius), true);
});

test("version 2 round-trip preserves mesh geometry, transforms, emission and flags", () => {
  const geometry = triangle();
  const object = createObjectRecord("custom", {
    id: "mesh_A",
    name: "A precise imported part",
    geometry,
    position: [2, 3, -4],
    rotation: [0.4, 0.5, 0.6],
    scale: [-2, 0.5, 3],
    material: {
      color: "#123456",
      metalness: 0.8,
      roughness: 0.25,
      opacity: 0.7,
      emissive: "#fedcba",
      emissiveIntensity: 2.5,
    },
    visible: false,
    locked: true,
  });
  const input = {
    ...projectWith(object),
    selectionId: object.id,
    environment: { background: "#102030", grid: false, exposure: 2 },
  };
  const saved = JSON.parse(serializeProject(input));
  const result = normalizeProject(saved);
  assert.deepEqual(result.objects[0], object);
  assert.deepEqual(result.objects[0].geometry, geometry);
  assert.deepEqual(result.environment, input.environment);
  assert.equal(result.selectionId, object.id);
  assert.equal("warnings" in saved, false);
  geometry.data.attributes.position.array[0] = 99;
  assert.equal(object.geometry.data.attributes.position.array[0], 0);
});

test("light settings survive saves independently of mesh materials", () => {
  const light = createObjectRecord("light", {
    name: "Warm fill",
    position: [4, 6, 2],
    light: { color: "#fca", intensity: 14, range: 60, decay: 1.5 },
  });
  const result = normalizeProject(serializeProject(projectWith(light)));
  assert.deepEqual(result.objects[0], light);
  assert.equal(result.objects[0].light.color, "#ffccaa");
});

test("version 1 preserves saved transform and material fields during upgrade", () => {
  const result = normalizeProject({
    version: 1,
    objects: [
      {
        name: "Old metaball",
        kind: "meta",
        p: [1, 2, 3],
        s: [2, 3, 4],
        influence: 1.7,
        material: {
          base: "#346789",
          metal: 0.4,
          rough: 0.6,
          emit: "#ff8800",
          estr: 1.3,
        },
      },
    ],
  });
  const object = result.objects[0];
  assert.equal(result.version, 2);
  assert.equal(object.type, "meta");
  assert.deepEqual(object.position, [1, 2, 3]);
  assert.deepEqual(object.scale, [2, 3, 4]);
  assert.equal(object.parameters.influence, 1.7);
  assert.equal(object.material.emissiveIntensity, 1.3);
  assert.equal(object.material.emissive, "#ff8800");
  assert.ok(result.warnings.some((warning) => warning.includes("legacy")));
});

test("legacy lost STL geometry produces a clearly reported placeholder", () => {
  const result = normalizeProject({
    objects: [{ kind: "stl", name: "Old mesh", p: [1, 0, 0] }],
  });
  assert.equal(result.objects[0].type, "box");
  assert.ok(
    result.warnings.some((warning) =>
      warning.includes("did not include its mesh"),
    ),
  );
});

test("legacy STL with saved geometry remains editable custom geometry", () => {
  const geometry = triangle();
  const result = normalizeProject({
    version: 1,
    objects: [{ kind: "stl", geometry }],
  });
  assert.equal(result.objects[0].type, "custom");
  assert.deepEqual(result.objects[0].geometry, geometry);
});

test("valid empty projects are accepted but malformed project shapes are rejected", () => {
  assert.equal(normalizeProject({ version: 2, objects: [] }).objects.length, 0);
  for (const input of [
    null,
    "",
    "{}",
    "[]",
    "{",
    {},
    [],
    { objects: {} },
    { version: 3, objects: [] },
    { version: "2", objects: [] },
  ]) {
    assert.throws(() => normalizeProject(input), TypeError);
  }
});

test("imports reject unknown or incomplete records without changing source data", () => {
  const existing = projectWith(createObjectRecord("box"));
  const before = JSON.stringify(existing);
  for (const object of [
    null,
    {},
    { type: "unknown" },
    { type: "custom" },
    { type: "box", position: [1, 2] },
    { type: "box", material: [] },
  ]) {
    assert.throws(() => normalizeProject(projectWith(object)), TypeError);
  }
  assert.equal(JSON.stringify(existing), before);
});

test("numeric null, strings and non-finite values are rejected rather than coerced", () => {
  for (const value of [null, "", "1", NaN, Infinity, -Infinity]) {
    assert.throws(
      () => createObjectRecord("box", { position: [value, 1, 1] }),
      TypeError,
    );
    assert.throws(
      () => createObjectRecord("box", { material: { roughness: value } }),
      TypeError,
    );
    assert.throws(
      () => createObjectRecord("box", { parameters: { width: value } }),
      TypeError,
    );
  }
  assert.throws(() => createObjectRecord("box", { position: null }), TypeError);
  assert.throws(
    () => createObjectRecord("box", { material: { color: null } }),
    TypeError,
  );
  assert.throws(
    () => createObjectRecord("box", { visible: "false" }),
    TypeError,
  );
  assert.throws(
    () => createObjectRecord("light", { light: { range: null } }),
    TypeError,
  );
});

test("finite out-of-range values are bounded with warnings and mirrors are preserved", () => {
  const result = normalizeProject(
    projectWith({
      type: "box",
      position: [1e6, 0, 0],
      scale: [-2, 0, 1],
      material: { metalness: 2, roughness: -1 },
      parameters: { width: -5 },
    }),
  );
  const object = result.objects[0];
  assert.equal(object.position[0], 10000);
  assert.equal(object.scale[0], -2);
  assert.equal(object.scale[1], 0.001);
  assert.equal(object.material.metalness, 1);
  assert.equal(object.material.roughness, 0);
  assert.equal(object.parameters.width, 0.001);
  assert.ok(result.warnings.length >= 5);
});

test("duplicate and unsafe identifiers are repaired to unique IDs", () => {
  const result = normalizeProject(
    projectWith(
      { type: "box", id: "same" },
      { type: "sphere", id: "same" },
      { type: "cone", id: "<unsafe>" },
    ),
  );
  const ids = result.objects.map((object) => object.id);
  assert.equal(new Set(ids).size, 3);
  assert.equal(ids[0], "same");
  assert.ok(result.warnings.length >= 2);
});

test("names strip controls and HTML brackets but preserve useful Unicode", () => {
  assert.equal(safeName("  Résumé <part>\u0000  "), "Résumé part");
  assert.equal(safeName("x".repeat(100)).length, 80);
  assert.equal(safeName("  "), "Untitled");
  assert.throws(() => safeName({}), TypeError);
});

test("custom geometry validation rejects malformed attributes, indices and groups", () => {
  const alterations = [
    (g) => {
      g.data.attributes.position.itemSize = 2;
    },
    (g) => {
      g.data.attributes.position.array[0] = NaN;
    },
    (g) => {
      g.data.attributes.normal.array.pop();
    },
    (g) => {
      g.data.index.array[0] = 3;
    },
    (g) => {
      g.data.index.array[0] = 0.5;
    },
    (g) => {
      g.data.groups[0].count = 4;
    },
    (g) => {
      g.data.drawRange = { start: 0, count: 4 };
    },
    (g) => {
      g.data.attributes.position.type = "NotAnArray";
    },
    (g) => {
      g.data.attributes.position.type = "Float64Array";
    },
    (g) => {
      delete g.data.attributes.position.type;
    },
    (g) => {
      g.data.attributes.position.normalized = "false";
    },
    (g) => {
      g.data.morphAttributes = {
        position: [{ itemSize: 3, type: "Float32Array", array: [0, 0, 0] }],
      };
    },
    (g) => {
      g.data.morphTargetsRelative = "false";
    },
    (g) => {
      g.data.attributes.normal.itemSize = 1;
      g.data.attributes.normal.array = [1, 1, 1];
    },
    (g) => {
      g.data.attributes.position.type = "Uint8Array";
      g.data.attributes.position.array[0] = -1;
    },
    (g) => {
      g.data.attributes.position.type = "Uint8Array";
      g.data.attributes.position.array[0] = 0.5;
    },
    (g) => {
      g.data.boundingSphere.radius = -1;
    },
    (g) => {
      g.data.boundingSphere.center = [1e30, 0, 0];
    },
  ];
  for (const alter of alterations) {
    const geometry = triangle();
    alter(geometry);
    assert.throws(() => createObjectRecord("custom", { geometry }), TypeError);
  }
  assert.throws(
    () => createObjectRecord("custom", { geometry: {} }),
    TypeError,
  );
  const unsafe = triangle();
  unsafe.userData = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.throws(
    () => createObjectRecord("custom", { geometry: unsafe }),
    TypeError,
  );
  assert.equal({}.polluted, undefined);
});

test("index values must be representable in their saved array type", () => {
  const geometry = {
    type: "BufferGeometry",
    data: {
      attributes: {
        position: {
          itemSize: 3,
          type: "Float32Array",
          array: Array(258 * 3).fill(0),
        },
      },
      index: { type: "Uint8Array", array: [0, 1, 257] },
    },
  };
  assert.throws(() => createObjectRecord("custom", { geometry }), /array type/);
  geometry.data.index.type = "Uint16Array";
  assert.doesNotThrow(() => createObjectRecord("custom", { geometry }));
});

test("a saved geometry payload is never discarded on a primitive import", () => {
  const geometry = triangle();
  const result = normalizeProject(projectWith({ type: "box", geometry }));
  assert.equal(result.objects[0].type, "custom");
  assert.deepEqual(result.objects[0].geometry, geometry);
  assert.ok(result.warnings.length);
});

test("project and geometry limits reject oversized data before conversion", () => {
  assert.throws(
    () =>
      normalizeProject({
        version: 2,
        objects: Array(MAX_OBJECTS + 1).fill({ type: "box" }),
      }),
    TypeError,
  );
  assert.throws(
    () => normalizeProject(" ".repeat(MAX_PROJECT_BYTES + 1)),
    /too large/,
  );
  const geometry = triangle();
  geometry.data.attributes = {
    position: {
      itemSize: 3,
      type: "Float32Array",
      array: Array(MAX_GEOMETRY_VALUES + 2).fill(0),
    },
  };
  assert.throws(
    () => createObjectRecord("custom", { geometry }),
    /geometry exceeds/,
  );
});

test("combined geometry is capped so every valid project fits the history data budget", () => {
  const geometry = {
    type: "BufferGeometry",
    data: {
      attributes: {
        position: {
          itemSize: 3,
          type: "Float32Array",
          array: Array(2100000).fill(0),
        },
      },
    },
  };
  assert.throws(
    () =>
      normalizeProject(
        projectWith(
          { id: "first", type: "custom", geometry },
          { id: "second", type: "custom", geometry },
        ),
      ),
    /combined geometry/,
  );
});

test("history snapshots are independent and undo/redo return independent copies", () => {
  const state = { objects: [{ position: [0, 0, 0] }] };
  const history = new History(state);
  state.objects[0].position[0] = 100;
  assert.equal(history.current.objects[0].position[0], 0);
  history.push(state);
  state.objects[0].position[0] = 200;
  const restored = history.undo();
  assert.equal(restored.objects[0].position[0], 0);
  restored.objects[0].position[0] = 999;
  assert.equal(history.current.objects[0].position[0], 0);
  assert.equal(history.redo().objects[0].position[0], 100);
});

test("history ignores unchanged snapshots and clears redo only for a new edit", () => {
  const history = new History({ value: 0 });
  assert.equal(history.push({ value: 0 }), false);
  assert.equal(history.canUndo, false);
  history.push({ value: 1 });
  history.push({ value: 2 });
  assert.deepEqual(history.undo(), { value: 1 });
  assert.equal(history.canRedo, true);
  assert.equal(history.push({ value: 1 }), false);
  assert.equal(history.canRedo, true);
  history.push({ value: 3 });
  assert.equal(history.canRedo, false);
  assert.deepEqual(history.undo(), { value: 1 });
});

test("history retains its configured limit and resets cleanly", () => {
  const history = new History({ value: 0 }, 3);
  for (let value = 1; value <= 5; value++) history.push({ value });
  assert.deepEqual(history.undo(), { value: 4 });
  assert.deepEqual(history.undo(), { value: 3 });
  assert.equal(history.canUndo, false);
  assert.deepEqual(history.undo(), { value: 3 });
  history.reset({ value: 10 });
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
  assert.deepEqual(history.current, { value: 10 });
  for (const limit of [0, 1, 201, NaN, 1.5])
    assert.throws(() => new History({}, limit), TypeError);
});

test("history trims expensive snapshots while retaining the previous state", () => {
  const history = new History({ value: 0 });
  const largeText = "x".repeat(22 * 1024 * 1024);
  for (let value = 1; value <= 8; value++) history.push({ value, largeText });
  assert.deepEqual(history.undo().value, 7);
  let undos = 1;
  while (history.canUndo) {
    history.undo();
    undos++;
  }
  assert.ok(
    undos < 8,
    "memory budget should trim the oldest expensive snapshots",
  );
  assert.ok(undos >= 1, "at least the previous state should remain");
});

test("every template produces valid editable objects with new identifiers", () => {
  for (const name of ["robot", "rocket", "desk"]) {
    const first = createTemplate(name);
    const second = createTemplate(name);
    assert.ok(first.length >= 10);
    assert.equal(new Set(first.map((object) => object.id)).size, first.length);
    assert.ok(first.every((object) => object.position[1] >= 0));
    assert.ok(
      first.every((object) => !second.some((other) => other.id === object.id)),
    );
    const roundTrip = normalizeProject(serializeProject(projectWith(...first)));
    assert.deepEqual(roundTrip.objects, first);
  }
  assert.throws(() => createTemplate("unavailable"), TypeError);
});
