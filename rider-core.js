/**
 * Serializable modeling state for 3D Rider. This module deliberately has no renderer dependencies.
 * Validate an entire import before replacing the live scene.
 */
export const PROJECT_VERSION = 2;
export const MAX_OBJECTS = 1000;
export const MAX_PROJECT_BYTES = 48 * 1024 * 1024;
export const MAX_GEOMETRY_VALUES = 4000000;
export const MAX_HISTORY_BYTES = 192 * 1024 * 1024;
export const MAX_KEYFRAMES = 500;
export const MAX_META_SOURCES = 512;
export const MAX_FONT_BYTES = 8 * 1024 * 1024;

const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const PRIMITIVES = freeze([
  { type: "box", label: "Box", defaults: { width: 1, height: 1, depth: 1 } },
  {
    type: "sphere",
    label: "Sphere",
    defaults: { radius: 0.65, widthSegments: 40, heightSegments: 24 },
  },
  {
    type: "cylinder",
    label: "Cylinder",
    defaults: {
      radiusTop: 0.6,
      radiusBottom: 0.6,
      height: 1.5,
      radialSegments: 32,
    },
  },
  {
    type: "cone",
    label: "Cone",
    defaults: { radius: 0.7, height: 1.6, radialSegments: 32 },
  },
  {
    type: "torus",
    label: "Torus",
    defaults: {
      radius: 0.65,
      tube: 0.2,
      radialSegments: 16,
      tubularSegments: 64,
    },
  },
  { type: "plane", label: "Plane", defaults: { width: 2, height: 2 } },
  {
    type: "meta",
    label: "Metaball",
    defaults: { radius: 0.65, influence: 1.25, variant: "ball" },
  },
  { type: "text", label: "Text", defaults: {} },
  { type: "light", label: "Point light", defaults: {} },
]);

export const PARAMETER_LIMITS = freeze({
  width: [0.001, 1000],
  height: [0.001, 1000],
  depth: [0.001, 1000],
  radius: [0.001, 1000],
  radiusTop: [0, 1000],
  radiusBottom: [0, 1000],
  tube: [0.001, 1000],
  influence: [0.1, 5],
  widthSegments: [3, 128],
  heightSegments: [2, 128],
  radialSegments: [3, 128],
  tubularSegments: [3, 256],
});

const DEFINITIONS = new Map(PRIMITIVES.map((item) => [item.type, item]));
const MATERIAL_DEFAULTS = freeze({
  shader: "standard",
  color: "#d6dbe5",
  metalness: 0.12,
  roughness: 0.38,
  opacity: 1,
  emissive: "#000000",
  emissiveIntensity: 0,
});
export const DEFAULT_ENVIRONMENT = freeze({
  background: "#181a20",
  grid: true,
  exposure: 1.15,
});
export const SHADERS = freeze(["standard", "toon", "normal", "glass", "metal", "matte", "unlit"]);
export const META_VARIANTS = freeze(["ball", "ellipsoid", "capsule", "chain", "cluster", "ring", "sheet"]);
export const PHYSICS_TYPES = freeze(["none", "static", "rigid", "soft", "liquid"]);
export const DEFAULT_TIMELINE = freeze({ duration: 10, fps: 30, loop: true });
export const DEFAULT_PHYSICS = freeze({
  type: "none", mass: 1, restitution: 0.35, friction: 0.4, stiffness: 0.65,
  velocity: [0, 0, 0], angularVelocity: [0, 0, 0],
});
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;
const LEGACY_TYPES = {
  cube: "box",
  ball: "sphere",
  point: "light",
  pointlight: "light",
  metaball: "meta",
  stl: "custom",
  mesh: "custom",
};

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(path, message) {
  throw new TypeError(path + ": " + message);
}

function warning(warnings, message) {
  if (warnings && warnings.length < 200) warnings.push(message);
}

function number(value, fallback, min, max, path, warnings, integer = false) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value))
    fail(path, "expected a finite number");
  let bounded = Math.min(max, Math.max(min, value));
  if (integer) bounded = Math.round(bounded);
  if (bounded !== value)
    warning(warnings, path + " was bounded to " + bounded + ".");
  return bounded;
}

function pick(primary, fallback) {
  return primary === undefined ? fallback : primary;
}

function boolean(value, fallback, path) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") fail(path, "expected true or false");
  return value;
}

function choice(value, fallback, options, path) {
  if (value === undefined) return fallback;
  if (!options.includes(value)) fail(path, "expected one of " + options.join(", "));
  return value;
}

function normalizePhysics(source, path, warnings) {
  const settings = source === undefined ? {} : source;
  if (!isRecord(settings)) fail(path, "expected physics settings");
  const result = {
    type: choice(settings.type, "none", PHYSICS_TYPES, path + ".type"),
    velocity: vector(settings.velocity, [0, 0, 0], path + ".velocity", warnings),
    angularVelocity: vector(settings.angularVelocity, [0, 0, 0], path + ".angularVelocity", warnings, "rotation"),
  };
  for (const [key, min, max] of [
    ["mass", 0.01, 10000], ["restitution", 0, 1], ["friction", 0, 1], ["stiffness", 0.01, 1],
  ]) result[key] = number(settings[key], DEFAULT_PHYSICS[key], min, max, path + "." + key, warnings);
  return result;
}

function normalizeKeyframes(source, transform, path, warnings, projectBudget) {
  if (source === undefined) return [];
  if (!Array.isArray(source) || source.length > MAX_KEYFRAMES)
    fail(path, "expected at most " + MAX_KEYFRAMES + " keyframes");
  if (projectBudget) {
    projectBudget.keyframes = (projectBudget.keyframes || 0) + source.length;
    if (projectBudget.keyframes > 20000) fail("project.keyframes", "maximum 20000 keyframes");
  }
  const byTime = new Map();
  source.forEach((frame, index) => {
    const framePath = path + "[" + index + "]";
    if (!isRecord(frame)) fail(framePath, "expected keyframe settings");
    const time = number(frame.time, 0, 0, 3600, framePath + ".time", warnings);
    const normalized = {
      time,
      position: vector(frame.position, transform.position, framePath + ".position", warnings),
      rotation: vector(frame.rotation, transform.rotation, framePath + ".rotation", warnings, "rotation"),
      scale: vector(frame.scale, transform.scale, framePath + ".scale", warnings, "scale"),
      interpolation: choice(frame.interpolation, "linear", ["linear", "smooth", "step"], framePath + ".interpolation"),
    };
    if (byTime.has(time)) warning(warnings, framePath + " replaced an earlier keyframe at the same time.");
    byTime.set(time, normalized);
  });
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

function normalizeText(source, path, warnings, projectBudget) {
  const settings = source === undefined ? {} : source;
  if (!isRecord(settings)) fail(path, "expected text settings");
  let content = settings.content ?? "Rider";
  if (typeof content !== "string") fail(path + ".content", "expected text");
  if (content.length > 2048) {
    content = content.slice(0, 2048);
    warning(warnings, path + ".content was shortened to 2048 characters.");
  }
  content = content.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  let fontData = null;
  if (settings.fontData !== undefined && settings.fontData !== null) {
    if (!isRecord(settings.fontData) || !isRecord(settings.fontData.glyphs))
      fail(path + ".fontData", "expected a Three.js typeface with glyphs");
    const glyphs = Object.values(settings.fontData.glyphs);
    if (!glyphs.length || glyphs.length > 65536 || typeof settings.fontData.resolution !== "number" || !Number.isFinite(settings.fontData.resolution) || settings.fontData.resolution <= 0 || settings.fontData.resolution > 100000)
      fail(path + ".fontData", "expected glyphs and a positive typeface resolution");
    for (const glyph of glyphs) {
      if (!isRecord(glyph) || typeof glyph.ha !== "number" || !Number.isFinite(glyph.ha) || (glyph.o !== undefined && typeof glyph.o !== "string"))
        fail(path + ".fontData.glyphs", "expected glyph advance and optional text outline");
    }
    fontData = cloneJSON(settings.fontData, path + ".fontData");
    const bytes = JSON.stringify(fontData).length;
    if (bytes > MAX_FONT_BYTES) fail(path + ".fontData", "font exceeds 8 MB");
    if (projectBudget) {
      projectBudget.fontBytes = (projectBudget.fontBytes || 0) + bytes;
      if (projectBudget.fontBytes > MAX_FONT_BYTES * 2) fail("project.fontData", "combined fonts exceed 16 MB");
    }
  }
  return {
    content,
    fontFamily: safeName(settings.fontFamily, "Helvetiker", 100),
    fontName: safeName(settings.fontName, "Helvetiker", 100),
    fontData,
    size: number(settings.size, 1, 0.01, 100, path + ".size", warnings),
    depth: number(settings.depth, 0.15, 0.001, 100, path + ".depth", warnings),
  };
}

export function safeName(value, fallback = "Untitled", maxLength = 80) {
  if (value === undefined) return fallback;
  if (typeof value !== "string") fail("name", "expected text");
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069<>]/g, "")
    .trim();
  return cleaned.slice(0, maxLength) || fallback;
}

function color(value, fallback, path) {
  if (value === undefined) return fallback;
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 0xffffff
  ) {
    return "#" + value.toString(16).padStart(6, "0");
  }
  if (typeof value !== "string") fail(path, "expected a hexadecimal color");
  const text = value.toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  if (/^#[0-9a-f]{3}$/.test(text))
    return (
      "#" +
      text
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
    );
  fail(path, "expected a hexadecimal color");
}

function vector(value, fallback, path, warnings, kind = "position") {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || value.length !== 3)
    fail(path, "expected exactly three numbers");
  const limit =
    kind === "rotation" ? Math.PI * 100 : kind === "scale" ? 1000 : 10000;
  return value.map((component, index) => {
    let result = number(
      component,
      fallback[index],
      -limit,
      limit,
      path + "[" + index + "]",
      warnings,
    );
    if (kind === "scale" && Math.abs(result) < 0.001) {
      result = result < 0 ? -0.001 : 0.001;
      warning(warnings, path + "[" + index + "] was bounded away from zero.");
    }
    return result;
  });
}

export function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function")
    return globalThis.crypto.randomUUID();
  return (
    "rider_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 12)
  );
}

function cloneJSON(value, path = "state", budget = { count: 0 }, depth = 0) {
  if (++budget.count > MAX_GEOMETRY_VALUES * 2) fail(path, "data is too large");
  if (depth > 32) fail(path, "data is nested too deeply");
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(path, "expected finite JSON data");
    return value;
  }
  if (Array.isArray(value))
    return value.map((item, index) =>
      cloneJSON(item, path + "[" + index + "]", budget, depth + 1),
    );
  if (
    isRecord(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  ) {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === "__proto__" || key === "prototype" || key === "constructor")
        fail(path, "unsafe property");
      result[key] = cloneJSON(item, path + "." + key, budget, depth + 1);
    }
    return result;
  }
  fail(path, "expected serializable JSON data");
}

function normalizeGeometry(value, path, projectGeometryBudget) {
  if (
    !isRecord(value) ||
    (value.type !== undefined && value.type !== "BufferGeometry")
  ) {
    fail(path, "expected BufferGeometry JSON");
  }
  const data = value.data;
  if (
    !isRecord(data) ||
    !isRecord(data.attributes) ||
    !isRecord(data.attributes.position)
  ) {
    fail(path, "missing position attribute");
  }
  const position = data.attributes.position;
  if (
    position.itemSize !== 3 ||
    !Array.isArray(position.array) ||
    !position.array.length ||
    position.array.length % 3
  ) {
    fail(path + ".position", "expected nonempty triples of positions");
  }
  const vertexCount = position.array.length / 3;
  let componentCount = 0;
  const typedArrays = new Set([
    "Float32Array",
    "Uint32Array",
    "Uint16Array",
    "Uint8Array",
    "Int32Array",
    "Int16Array",
    "Int8Array",
    "Uint8ClampedArray",
  ]);
  const integerRanges = {
    Uint32Array: [0, 4294967295],
    Uint16Array: [0, 65535],
    Uint8Array: [0, 255],
    Uint8ClampedArray: [0, 255],
    Int32Array: [-2147483648, 2147483647],
    Int16Array: [-32768, 32767],
    Int8Array: [-128, 127],
  };
  const semanticSizes = {
    position: [3],
    normal: [3],
    tangent: [4],
    uv: [2],
    uv1: [2],
    uv2: [2],
    uv3: [2],
    color: [3, 4],
    skinIndex: [4],
    skinWeight: [4],
  };
  const validateAttribute = (attribute, name, semanticName = name) => {
    if (
      !isRecord(attribute) ||
      !Number.isInteger(attribute.itemSize) ||
      attribute.itemSize < 1 ||
      attribute.itemSize > 16 ||
      !Array.isArray(attribute.array) ||
      attribute.array.length / attribute.itemSize !== vertexCount
    ) {
      fail(
        path + ".attributes." + name,
        "attribute count must match positions",
      );
    }
    if (!typedArrays.has(attribute.type))
      fail(path + ".attributes." + name, "missing or unsupported array type");
    if (
      attribute.normalized !== undefined &&
      typeof attribute.normalized !== "boolean"
    )
      fail(path + ".attributes." + name, "normalized must be true or false");
    if (
      semanticSizes[semanticName] &&
      !semanticSizes[semanticName].includes(attribute.itemSize)
    )
      fail(path + ".attributes." + name, "invalid standard attribute size");
    componentCount += attribute.array.length;
    if (componentCount > MAX_GEOMETRY_VALUES)
      fail(path, "geometry exceeds " + MAX_GEOMETRY_VALUES + " values");
    for (const component of attribute.array) {
      if (
        typeof component !== "number" ||
        !Number.isFinite(component) ||
        Math.abs(component) > 1000000000
      ) {
        fail(path + ".attributes." + name, "expected bounded finite values");
      }
      const integerRange = integerRanges[attribute.type];
      if (
        integerRange &&
        (!Number.isInteger(component) ||
          component < integerRange[0] ||
          component > integerRange[1])
      ) {
        fail(
          path + ".attributes." + name,
          "value cannot be represented by its array type",
        );
      }
    }
  };
  for (const [name, attribute] of Object.entries(data.attributes))
    validateAttribute(attribute, name);
  if (data.morphAttributes !== undefined) {
    if (!isRecord(data.morphAttributes))
      fail(path + ".morphAttributes", "expected morph attribute settings");
    for (const [name, targets] of Object.entries(data.morphAttributes)) {
      if (!Array.isArray(targets) || targets.length > 100)
        fail(
          path + ".morphAttributes." + name,
          "expected bounded morph targets",
        );
      targets.forEach((attribute, index) =>
        validateAttribute(attribute, "morph." + name + "[" + index + "]", name),
      );
    }
  }
  if (
    data.morphTargetsRelative !== undefined &&
    typeof data.morphTargetsRelative !== "boolean"
  )
    fail(path + ".morphTargetsRelative", "expected true or false");
  let drawCount = vertexCount;
  if (data.index !== undefined) {
    if (!isRecord(data.index) || !Array.isArray(data.index.array))
      fail(path + ".index", "expected an index array");
    if (!["Uint8Array", "Uint16Array", "Uint32Array"].includes(data.index.type))
      fail(path + ".index", "missing or unsupported index array type");
    componentCount += data.index.array.length;
    if (componentCount > MAX_GEOMETRY_VALUES)
      fail(path, "geometry has too many values");
    for (const index of data.index.array) {
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= vertexCount ||
        index > integerRanges[data.index.type][1]
      )
        fail(
          path + ".index",
          "index is outside the position attribute or array type",
        );
    }
    drawCount = data.index.array.length;
  }
  if (data.groups !== undefined) {
    if (!Array.isArray(data.groups) || data.groups.length > 10000)
      fail(path + ".groups", "expected bounded groups");
    data.groups.forEach((group) => {
      if (
        !isRecord(group) ||
        !Number.isInteger(group.start) ||
        !Number.isInteger(group.count) ||
        !Number.isInteger(group.materialIndex) ||
        group.start < 0 ||
        group.count < 0 ||
        group.start + group.count > drawCount ||
        group.materialIndex < 0 ||
        group.materialIndex > 1000
      ) {
        fail(path + ".groups", "invalid geometry group");
      }
    });
  }
  if (data.drawRange !== undefined) {
    const range = data.drawRange;
    if (
      !isRecord(range) ||
      !Number.isInteger(range.start) ||
      !Number.isInteger(range.count) ||
      range.start < 0 ||
      range.count < 0 ||
      range.start + range.count > drawCount
    )
      fail(path + ".drawRange", "invalid draw range");
  }
  if (data.boundingSphere !== undefined) {
    const bounds = data.boundingSphere;
    if (
      !isRecord(bounds) ||
      !Array.isArray(bounds.center) ||
      bounds.center.length !== 3 ||
      bounds.center.some(
        (component) =>
          typeof component !== "number" ||
          !Number.isFinite(component) ||
          Math.abs(component) > 1000000000,
      ) ||
      typeof bounds.radius !== "number" ||
      !Number.isFinite(bounds.radius) ||
      bounds.radius < 0 ||
      bounds.radius > 10000000000
    ) {
      fail(path + ".boundingSphere", "invalid geometry bounds");
    }
  }
  if (projectGeometryBudget) {
    projectGeometryBudget.count += componentCount;
    if (projectGeometryBudget.count > MAX_GEOMETRY_VALUES)
      fail(
        "project.geometry",
        "combined geometry exceeds " + MAX_GEOMETRY_VALUES + " values",
      );
  }
  return cloneJSON(value, path);
}

function normalizeObject(
  source,
  index,
  usedIds,
  warnings,
  legacy = false,
  geometryBudget,
) {
  const path = "objects[" + index + "]";
  if (!isRecord(source)) fail(path, "expected an object record");
  let type = source.type ?? (legacy ? source.kind : undefined);
  if (typeof type !== "string") fail(path + ".type", "missing object type");
  type = type.toLowerCase();
  if (legacy) type = LEGACY_TYPES[type] || type;
  if (!DEFINITIONS.has(type) && type !== "custom")
    fail(path + ".type", 'unknown object type "' + type + '"');
  if (type === "custom" && source.geometry === undefined && legacy) {
    type = "box";
    warning(
      warnings,
      'Legacy object "' +
        safeName(source.name, "Imported mesh") +
        '" did not include its mesh. A box placeholder was restored.',
    );
  } else if (type === "custom" && source.geometry === undefined) {
    fail(path + ".geometry", "custom objects require saved geometry");
  }
  if (source.geometry !== undefined && type !== "custom") {
    type = "custom";
    warning(warnings, path + " uses its saved custom geometry.");
  }
  const definition = DEFINITIONS.get(type);
  let id = source.id;
  if (typeof id !== "string" || !ID_PATTERN.test(id) || usedIds.has(id)) {
    id = createId();
    while (usedIds.has(id)) id = createId();
    if (source.id !== undefined)
      warning(warnings, path + " received a new unique identifier.");
  }
  usedIds.add(id);
  const originalName = source.name;
  const name = safeName(
    originalName,
    definition ? definition.label : "Imported mesh",
  );
  if (originalName !== undefined && name !== originalName)
    warning(warnings, path + ".name was cleaned.");
  let materialSource = source.material;
  if (materialSource === undefined) materialSource = {};
  if (!isRecord(materialSource))
    fail(path + ".material", "expected material settings");
  const material = {
    shader: choice(materialSource.shader, "standard", SHADERS, path + ".material.shader"),
    color: color(
      pick(materialSource.color, legacy ? materialSource.base : undefined),
      MATERIAL_DEFAULTS.color,
      path + ".material.color",
    ),
    metalness: number(
      pick(materialSource.metalness, legacy ? materialSource.metal : undefined),
      MATERIAL_DEFAULTS.metalness,
      0,
      1,
      path + ".material.metalness",
      warnings,
    ),
    roughness: number(
      pick(materialSource.roughness, legacy ? materialSource.rough : undefined),
      MATERIAL_DEFAULTS.roughness,
      0,
      1,
      path + ".material.roughness",
      warnings,
    ),
    opacity: number(
      materialSource.opacity,
      MATERIAL_DEFAULTS.opacity,
      0,
      1,
      path + ".material.opacity",
      warnings,
    ),
    emissive: color(
      pick(materialSource.emissive, legacy ? materialSource.emit : undefined),
      MATERIAL_DEFAULTS.emissive,
      path + ".material.emissive",
    ),
    emissiveIntensity: number(
      pick(
        materialSource.emissiveIntensity,
        legacy ? materialSource.estr : undefined,
      ),
      MATERIAL_DEFAULTS.emissiveIntensity,
      0,
      100,
      path + ".material.emissiveIntensity",
      warnings,
    ),
  };
  const parametersSource =
    source.parameters === undefined ? {} : source.parameters;
  if (!isRecord(parametersSource))
    fail(path + ".parameters", "expected primitive parameters");
  const parameters = {};
  for (const [key, defaultValue] of Object.entries(
    definition?.defaults || {},
  )) {
    if (key === "variant") {
      parameters.variant = choice(parametersSource.variant, "ball", META_VARIANTS, path + ".parameters.variant");
      continue;
    }
    const limits = PARAMETER_LIMITS[key];
    const value = pick(
      parametersSource[key],
      legacy && key === "influence" ? source.influence : undefined,
    );
    parameters[key] = number(
      value,
      defaultValue,
      limits[0],
      limits[1],
      path + ".parameters." + key,
      warnings,
      key.endsWith("Segments"),
    );
  }
  if (
    type === "cylinder" &&
    parameters.radiusTop === 0 &&
    parameters.radiusBottom === 0
  )
    fail(path + ".parameters", "cylinder needs a nonzero radius");
  const result = {
    id,
    name,
    type,
    position: vector(
      pick(source.position, legacy ? source.p : undefined),
      [0, 0, 0],
      path + ".position",
      warnings,
    ),
    rotation: vector(
      pick(source.rotation, legacy ? source.r : undefined),
      [0, 0, 0],
      path + ".rotation",
      warnings,
      "rotation",
    ),
    scale: vector(
      pick(source.scale, legacy ? source.s : undefined),
      [1, 1, 1],
      path + ".scale",
      warnings,
      "scale",
    ),
    material,
    parameters,
    visible: boolean(source.visible, true, path + ".visible"),
    locked: boolean(source.locked, false, path + ".locked"),
    physics: normalizePhysics(source.physics, path + ".physics", warnings),
  };
  result.keyframes = normalizeKeyframes(source.keyframes, result, path + ".keyframes", warnings, geometryBudget);
  if (type === "text" || source.text !== undefined)
    result.text = normalizeText(source.text, path + ".text", warnings, geometryBudget);
  if (source.metaSources !== undefined) {
    if (!Array.isArray(source.metaSources) || source.metaSources.length > MAX_META_SOURCES)
      fail(path + ".metaSources", "expected at most " + MAX_META_SOURCES + " field sources");
    result.metaSources = source.metaSources.map((item, sourceIndex) => {
      const itemPath = path + ".metaSources[" + sourceIndex + "]";
      if (!isRecord(item)) fail(itemPath, "expected a field source");
      return {
        position: vector(item.position, [0, 0, 0], itemPath + ".position", warnings),
        radius: number(item.radius, 0.1, 0.001, 1000, itemPath + ".radius", warnings),
      };
    });
  }
  if (source.geometry !== undefined)
    result.geometry = normalizeGeometry(
      source.geometry,
      path + ".geometry",
      geometryBudget,
    );
  if (type === "light") {
    const settings = source.light === undefined ? {} : source.light;
    if (!isRecord(settings)) fail(path + ".light", "expected light settings");
    result.light = {
      color: color(settings.color, "#ffffff", path + ".light.color"),
      intensity: number(
        settings.intensity,
        3,
        0,
        1000,
        path + ".light.intensity",
        warnings,
      ),
      range: number(
        settings.range,
        20,
        0,
        10000,
        path + ".light.range",
        warnings,
      ),
      decay: number(settings.decay, 2, 0, 10, path + ".light.decay", warnings),
    };
  } else if (source.light !== undefined) {
    fail(path + ".light", "only light objects can contain light settings");
  }
  return result;
}

export function createObjectRecord(type, overrides = {}) {
  if (!isRecord(overrides)) fail("object", "expected object overrides");
  return normalizeObject({ ...overrides, type }, 0, new Set(), []);
}

/** Returns a fully validated project. Repairs are reported in warnings; invalid data throws. */
export function normalizeProject(input) {
  let source = input;
  if (typeof input === "string") {
    if (input.length > MAX_PROJECT_BYTES) fail("project", "file is too large");
    try {
      source = JSON.parse(input);
    } catch {
      fail("project", "invalid JSON");
    }
  }
  if (!isRecord(source)) fail("project", "expected a project object");
  if (
    source.version !== undefined &&
    source.version !== 1 &&
    source.version !== 2
  )
    fail("project.version", "unsupported version");
  if (!Array.isArray(source.objects))
    fail("project.objects", "expected an objects array");
  if (source.objects.length > MAX_OBJECTS)
    fail("project.objects", "maximum " + MAX_OBJECTS + " objects");
  const legacy = source.version !== 2;
  const warnings = [];
  if (legacy && source.objects.length)
    warning(warnings, "This legacy project was upgraded to version 2.");
  const usedIds = new Set();
  const geometryBudget = { count: 0 };
  const objects = source.objects.map((object, index) =>
    normalizeObject(object, index, usedIds, warnings, legacy, geometryBudget),
  );
  const settings = source.environment === undefined ? {} : source.environment;
  if (!isRecord(settings))
    fail("project.environment", "expected environment settings");
  const timeline = source.timeline === undefined ? {} : source.timeline;
  if (!isRecord(timeline)) fail("project.timeline", "expected timeline settings");
  let duration = number(timeline.duration, 10, 0.1, 3600, "project.timeline.duration", warnings);
  const lastKeyframe = objects.reduce((last, object) => Math.max(last, object.keyframes.at(-1)?.time || 0), 0);
  if (lastKeyframe > duration) {
    duration = lastKeyframe;
    warning(warnings, "The timeline was extended to include its last keyframe.");
  }
  const project = {
    version: PROJECT_VERSION,
    name: safeName(source.name, "Untitled project"),
    objects,
    mode: choice(source.mode, "3d", ["2d", "3d"], "project.mode"),
    timeline: {
      duration,
      fps: number(timeline.fps, 30, 1, 60, "project.timeline.fps", warnings, true),
      loop: boolean(timeline.loop, true, "project.timeline.loop"),
    },
    environment: {
      background: color(
        settings.background,
        DEFAULT_ENVIRONMENT.background,
        "project.environment.background",
      ),
      grid: boolean(
        settings.grid,
        DEFAULT_ENVIRONMENT.grid,
        "project.environment.grid",
      ),
      exposure: number(
        settings.exposure,
        DEFAULT_ENVIRONMENT.exposure,
        0.1,
        5,
        "project.environment.exposure",
        warnings,
      ),
    },
    warnings,
  };
  if (source.selectionId !== undefined) {
    if (source.selectionId !== null && typeof source.selectionId !== "string")
      fail("project.selectionId", "expected an object identifier");
    project.selectionId = objects.some(
      (object) => object.id === source.selectionId,
    )
      ? source.selectionId
      : null;
  }
  return project;
}

export function serializeProject(project) {
  const normalized = normalizeProject(project);
  delete normalized.warnings;
  return JSON.stringify(normalized, null, 2);
}

/** Deep-cloned, bounded snapshots. Commit once at the end of a drag or slider gesture. */
export class History {
  constructor(initialState = {}, limit = 50) {
    if (!Number.isInteger(limit) || limit < 2 || limit > 200)
      fail("history.limit", "expected an integer from 2 to 200");
    this.limit = limit;
    this.reset(initialState);
  }
  get canUndo() {
    return this._index > 0;
  }
  get canRedo() {
    return this._index < this._entries.length - 1;
  }
  get current() {
    return cloneJSON(this._entries[this._index]);
  }
  _snapshot(state) {
    const budget = { count: 0 };
    const snapshot = cloneJSON(state, "state", budget);
    const key = JSON.stringify(snapshot);
    // Includes JSON text and a conservative allowance for array/object storage.
    return { snapshot, key, bytes: budget.count * 16 + key.length * 2 };
  }
  reset(state = {}) {
    const { snapshot, key, bytes } = this._snapshot(state);
    this._entries = [snapshot];
    this._sizes = [bytes];
    this._index = 0;
    this._key = key;
    return this.current;
  }
  push(state) {
    const { snapshot, key, bytes } = this._snapshot(state);
    if (key === this._key) return false;
    this._entries.splice(this._index + 1);
    this._sizes.splice(this._index + 1);
    this._entries.push(snapshot);
    this._sizes.push(bytes);
    let retainedBytes = this._sizes.reduce((total, size) => total + size, 0);
    while (
      this._entries.length > this.limit ||
      (retainedBytes > MAX_HISTORY_BYTES && this._entries.length > 2)
    ) {
      this._entries.shift();
      retainedBytes -= this._sizes.shift();
    }
    this._index = this._entries.length - 1;
    this._key = key;
    return true;
  }
  undo() {
    if (this.canUndo) this._index -= 1;
    this._key = JSON.stringify(this._entries[this._index]);
    return this.current;
  }
  redo() {
    if (this.canRedo) this._index += 1;
    this._key = JSON.stringify(this._entries[this._index]);
    return this.current;
  }
}

export const TEMPLATES = freeze([
  {
    id: "robot",
    label: "Friendly robot",
    description: "A character assembled from editable shapes.",
  },
  {
    id: "rocket",
    label: "Explorer rocket",
    description: "A rocket with a capsule, engine and fins.",
  },
  {
    id: "desk",
    label: "Studio desk",
    description: "A desk, monitor and stool ready to customize.",
  },
]);

/** Templates remain independent editable objects, with fresh identifiers on every insertion. */
export function createTemplate(name) {
  const objects = [];
  const part = (type, label, position, parameters, colorValue, extra = {}) => {
    objects.push(
      createObjectRecord(type, {
        name: label,
        position,
        parameters,
        ...extra,
        material: {
          color: colorValue,
          metalness: 0.12,
          roughness: 0.4,
          ...extra.material,
        },
      }),
    );
  };
  if (name === "robot") {
    part(
      "box",
      "Robot · body",
      [0, 1.85, 0],
      { width: 1.35, height: 1.45, depth: 0.75 },
      "#547fe7",
    );
    part(
      "box",
      "Robot · head",
      [0, 3.02, 0],
      { width: 1.15, height: 0.78, depth: 0.8 },
      "#e2e8f3",
      { material: { metalness: 0.45 } },
    );
    part(
      "box",
      "Robot · face",
      [0, 3.07, 0.415],
      { width: 0.94, height: 0.46, depth: 0.045 },
      "#192233",
    );
    for (const sign of [-1, 1]) {
      part(
        "sphere",
        "Robot · " + (sign < 0 ? "left" : "right") + " eye",
        [sign * 0.25, 3.1, 0.46],
        { radius: 0.085 },
        "#65e7ec",
        {
          scale: [1, 1, 0.3],
          material: { emissive: "#65e7ec", emissiveIntensity: 0.6 },
        },
      );
      part(
        "cylinder",
        "Robot · " + (sign < 0 ? "left" : "right") + " arm",
        [sign * 0.98, 1.92, 0],
        { radiusTop: 0.18, radiusBottom: 0.2, height: 1.1 },
        "#e2e8f3",
        { rotation: [0, 0, sign * 0.18] },
      );
      part(
        "box",
        "Robot · " + (sign < 0 ? "left" : "right") + " leg",
        [sign * 0.37, 0.65, 0],
        { width: 0.4, height: 0.85, depth: 0.46 },
        "#a8b7d0",
      );
      part(
        "box",
        "Robot · " + (sign < 0 ? "left" : "right") + " foot",
        [sign * 0.37, 0.17, 0.12],
        { width: 0.54, height: 0.34, depth: 0.74 },
        "#263957",
      );
    }
    part(
      "cylinder",
      "Robot · antenna",
      [0, 3.6, 0],
      { radiusTop: 0.035, radiusBottom: 0.035, height: 0.42 },
      "#a8b7d0",
    );
    part(
      "sphere",
      "Robot · antenna tip",
      [0, 3.83, 0],
      { radius: 0.1 },
      "#f4b65c",
    );
    part(
      "box",
      "Robot · chest badge",
      [0, 2.1, 0.405],
      { width: 0.55, height: 0.22, depth: 0.06 },
      "#f4b65c",
    );
  } else if (name === "rocket") {
    part(
      "cylinder",
      "Rocket · capsule",
      [0, 2.1, 0],
      { radiusTop: 0.64, radiusBottom: 0.64, height: 2.4 },
      "#e2e8f3",
      { material: { metalness: 0.45, roughness: 0.24 } },
    );
    part(
      "cone",
      "Rocket · nose",
      [0, 3.75, 0],
      { radius: 0.64, height: 0.9 },
      "#ec765b",
    );
    part(
      "cylinder",
      "Rocket · engine",
      [0, 0.73, 0],
      { radiusTop: 0.43, radiusBottom: 0.53, height: 0.34 },
      "#293954",
      { material: { metalness: 0.75 } },
    );
    part(
      "torus",
      "Rocket · window rim",
      [0, 2.65, 0.64],
      { radius: 0.28, tube: 0.055 },
      "#293954",
      { material: { metalness: 0.65 } },
    );
    part(
      "sphere",
      "Rocket · window",
      [0, 2.65, 0.655],
      { radius: 0.255 },
      "#70d6ee",
      { scale: [1, 1, 0.18], material: { metalness: 0.25, roughness: 0.12 } },
    );
    for (let index = 0; index < 4; index++) {
      const angle = (index * Math.PI) / 2;
      part(
        "box",
        "Rocket · fin " + (index + 1),
        [Math.sin(angle) * 0.75, 0.8, Math.cos(angle) * 0.75],
        { width: 0.16, height: 1.25, depth: 0.6 },
        "#ec765b",
        { rotation: [0, angle, 0] },
      );
    }
    part(
      "cone",
      "Rocket · exhaust",
      [0, 0.3, 0],
      { radius: 0.24, height: 0.6 },
      "#f4b65c",
      {
        rotation: [0, 0, Math.PI],
        material: { emissive: "#ec765b", emissiveIntensity: 0.25 },
      },
    );
  } else if (name === "desk") {
    part(
      "box",
      "Desk · tabletop",
      [0, 1.75, 0],
      { width: 3.5, height: 0.16, depth: 1.55 },
      "#c59a75",
      { material: { metalness: 0, roughness: 0.65 } },
    );
    for (const x of [-1.4, 1.4]) {
      for (const z of [-0.55, 0.55])
        part(
          "box",
          "Desk · leg " + objects.length,
          [x, 0.83, z],
          { width: 0.12, height: 1.67, depth: 0.12 },
          "#263957",
        );
    }
    part(
      "box",
      "Desk · monitor",
      [0, 2.5, -0.37],
      { width: 1.38, height: 0.88, depth: 0.1 },
      "#263957",
    );
    part(
      "box",
      "Desk · screen",
      [0, 2.5, -0.312],
      { width: 1.22, height: 0.72, depth: 0.015 },
      "#547fe7",
      { material: { emissive: "#547fe7", emissiveIntensity: 0.2 } },
    );
    part(
      "cylinder",
      "Desk · monitor stand",
      [0, 2.05, -0.37],
      { radiusTop: 0.045, radiusBottom: 0.045, height: 0.4 },
      "#a8b7d0",
    );
    part(
      "box",
      "Desk · monitor base",
      [0, 1.86, -0.37],
      { width: 0.55, height: 0.06, depth: 0.35 },
      "#a8b7d0",
    );
    part(
      "box",
      "Desk · keyboard",
      [0, 1.87, 0.24],
      { width: 0.95, height: 0.075, depth: 0.32 },
      "#e2e8f3",
    );
    part(
      "cylinder",
      "Desk · stool seat",
      [0, 0.96, 1.35],
      { radiusTop: 0.42, radiusBottom: 0.42, height: 0.14 },
      "#547fe7",
    );
    for (let index = 0; index < 3; index++) {
      const angle = (index * Math.PI * 2) / 3;
      part(
        "cylinder",
        "Desk · stool leg " + (index + 1),
        [Math.sin(angle) * 0.28, 0.45, 1.35 + Math.cos(angle) * 0.28],
        { radiusTop: 0.035, radiusBottom: 0.05, height: 0.9 },
        "#263957",
      );
    }
  } else {
    fail("template", 'unknown template "' + name + '"');
  }
  return objects;
}
