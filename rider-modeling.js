/** Renderer helpers shared by the 3D and 2D Rider studios. */
import * as THREE from "three";
export {
  loadDefaultFont,
  createTextGeometry,
  readFontFile,
  normalizeFontData,
} from "./rider-fonts.js";

export const METABALL_VARIANTS = Object.freeze([
  "ball", "ellipsoid", "capsule", "chain", "cluster", "ring", "sheet",
]);
export const SHADER_VARIANTS = Object.freeze([
  "standard", "toon", "normal", "glass", "metal", "matte", "unlit",
]);

let toonGradient;
function gradient() {
  if (!toonGradient) {
    toonGradient = new THREE.DataTexture(
      new Uint8Array([45, 105, 170, 255]), 4, 1, THREE.RedFormat,
    );
    toonGradient.minFilter = toonGradient.magFilter = THREE.NearestFilter;
    toonGradient.generateMipmaps = false;
    toonGradient.needsUpdate = true;
  }
  return toonGradient;
}

/** Select an actual renderer material, rather than changing only its label. */
export function createRiderMaterial(record, options = {}) {
  const settings = record.material || {};
  const shader = settings.shader || "standard";
  const common = {
    color: settings.color || "#d6dbe5",
    opacity: settings.opacity ?? 1,
    transparent: (settings.opacity ?? 1) < 1,
    depthWrite: (settings.opacity ?? 1) >= 0.95,
    wireframe: options.displayMode === "wire",
    side: record.type === "plane" || options.mode === "2d"
      ? THREE.DoubleSide : THREE.FrontSide,
  };
  if (options.vertexColors) common.vertexColors = true;
  const lit = {
    ...common,
    emissive: settings.emissive || "#000000",
    emissiveIntensity: settings.emissiveIntensity || 0,
  };
  let material;
  if (shader === "normal") {
    const { color, vertexColors, ...normalOptions } = common;
    material = new THREE.MeshNormalMaterial(normalOptions);
  } else if (shader === "unlit") {
    material = new THREE.MeshBasicMaterial(common);
  } else if (shader === "toon") {
    material = new THREE.MeshToonMaterial({ ...lit, gradientMap: gradient() });
  } else {
    const physical = {
      ...lit,
      metalness: settings.metalness ?? 0.12,
      roughness: settings.roughness ?? 0.38,
    };
    if (shader === "glass") {
      Object.assign(physical, {
        metalness: 0,
        roughness: Math.min(0.18, physical.roughness),
        transmission: 0.88,
        thickness: 0.45,
        ior: 1.45,
        clearcoat: 1,
      });
    } else if (shader === "metal") {
      physical.metalness = Math.max(0.88, physical.metalness);
      physical.roughness = Math.min(0.22, physical.roughness);
    } else if (shader === "matte") {
      physical.metalness = 0;
      physical.roughness = Math.max(0.88, physical.roughness);
    }
    material = new THREE.MeshPhysicalMaterial(physical);
  }
  material.userData.riderShader = shader;
  return material;
}

/** Replace the material class on shader changes, reuse it during animation. */
export function applyRiderMaterial(mesh, record, options = {}) {
  const old = mesh.material;
  const settings = record.material || {};
  const shader = settings.shader || "standard";
  if (!old || Array.isArray(old) || old.userData.riderShader !== shader) {
    mesh.material = createRiderMaterial(record, options);
    if (Array.isArray(old)) old.forEach((material) => material.dispose());
    else old?.dispose();
    return mesh.material;
  }
  old.color?.set(settings.color || "#d6dbe5");
  old.emissive?.set(settings.emissive || "#000000");
  if ("emissiveIntensity" in old) old.emissiveIntensity = settings.emissiveIntensity || 0;
  if ("metalness" in old) {
    old.metalness = shader === "glass" || shader === "matte" ? 0
      : shader === "metal" ? Math.max(0.88, settings.metalness ?? 0.12)
        : settings.metalness ?? 0.12;
    old.roughness = shader === "glass" ? Math.min(0.18, settings.roughness ?? 0.38)
      : shader === "metal" ? Math.min(0.22, settings.roughness ?? 0.38)
        : shader === "matte" ? Math.max(0.88, settings.roughness ?? 0.38)
          : settings.roughness ?? 0.38;
  }
  old.opacity = settings.opacity ?? 1;
  const flags = {
    transparent: old.opacity < 1,
    depthWrite: old.opacity >= 0.95,
    wireframe: options.displayMode === "wire",
    side: record.type === "plane" || options.mode === "2d" ? THREE.DoubleSide : THREE.FrontSide,
  };
  if ("vertexColors" in old && shader !== "normal") flags.vertexColors = !!options.vertexColors;
  let changed = false;
  for (const [name, value] of Object.entries(flags)) {
    if (old[name] !== value) changed = true;
    old[name] = value;
  }
  if (changed) old.needsUpdate = true;
  return mesh.material;
}

/** Sources are in object-local space. Their radii follow object rotation and scale. */
export function getMetaballSources(record) {
  const p = record.parameters || {};
  const radius = Math.max(0.001, p.radius || 0.65);
  const influence = p.influence ?? 1.25;
  const source = (position, radii) => ({
    position,
    radius: Math.max(...radii),
    radii: radii.map((value) => Math.max(0.001, value * influence)),
  });
  if (record.metaSources?.length) {
    return record.metaSources.slice(0, 512).map((item) => source(
      item.position,
      item.radii || [item.radius, item.radius, item.radius],
    ));
  }
  const variant = p.variant || record.metaVariant || "ball";
  if (variant === "ellipsoid")
    return [source([0, 0, 0], [radius * 1.5, radius * 0.72, radius])];
  if (variant === "capsule")
    return [-1, -0.5, 0, 0.5, 1].map((y) => source(
      [0, y * radius, 0], [radius * 0.55, radius * 0.55, radius * 0.55],
    ));
  if (variant === "chain")
    return [-2, -1, 0, 1, 2].map((x) => source(
      [x * radius * 0.8, Math.sin(x * 1.15) * radius * 0.3, 0],
      [radius * 0.62, radius * 0.62, radius * 0.62],
    ));
  if (variant === "cluster")
    return [[0, 0, 0], [-0.7, -0.35, 0], [0.7, -0.35, 0], [0, 0.7, 0.15], [0, 0, 0.7]]
      .map((point) => source(point.map((v) => v * radius),
        [radius * 0.67, radius * 0.67, radius * 0.67]));
  if (variant === "ring")
    return Array.from({ length: 16 }, (_, index) => {
      const angle = index * Math.PI / 8;
      return source([Math.cos(angle) * radius * 1.3, Math.sin(angle) * radius * 1.3, 0],
        [radius * 0.23, radius * 0.23, radius * 0.23]);
    });
  if (variant === "sheet")
    return [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => source(
      [x * radius * 0.8, y * radius * 0.8, 0],
      [radius * 0.55, radius * 0.55, radius * 0.14],
    )));
  return [source([0, 0, 0], [radius, radius, radius])];
}

function transformedSources(records, mode) {
  const result = [];
  const position = new THREE.Vector3(), scale = new THREE.Vector3();
  const rotation = new THREE.Euler(), quaternion = new THREE.Quaternion();
  const matrix = new THREE.Matrix4(), local = new THREE.Matrix4();
  records.forEach((record) => {
    position.fromArray(record.position || [0, 0, 0]);
    rotation.set(...(record.rotation || [0, 0, 0]), "XYZ");
    quaternion.setFromEuler(rotation);
    scale.fromArray(record.scale || [1, 1, 1]);
    matrix.compose(position, quaternion, scale);
    getMetaballSources(record).forEach((item) => {
      const radii = [...item.radii];
      if (mode === "2d") radii[2] = Math.min(radii[0], radii[1]) * 0.16;
      local.makeScale(...radii);
      local.setPosition(...item.position);
      const world = matrix.clone().multiply(local);
      const e = world.elements;
      const center = new THREE.Vector3(e[12], e[13], e[14]);
      const extent = new THREE.Vector3(
        Math.hypot(e[0], e[4], e[8]),
        Math.hypot(e[1], e[5], e[9]),
        Math.hypot(e[2], e[6], e[10]),
      );
      result.push({
        center,
        extent,
        inverse: world.clone().invert().elements,
        color: new THREE.Color(record.material?.color || "#d6dbe5"),
      });
    });
  });
  return result;
}

/**
 * Populate a MarchingCubes field with affine ellipsoids. Unlike addBall(), this
 * preserves nonuniform scale and rotation. Bounds use independent axis lengths,
 * which keeps narrow glyphs and flat sheets visible at low watch resolutions.
 */
export function updateMetaballSurface(surface, records, options = {}) {
  const metas = records.filter((record) => record.type === "meta" && record.visible !== false);
  surface.visible = metas.length > 0;
  if (!metas.length) {
    surface.reset();
    surface.count = 0;
    surface.geometry.setDrawRange(0, 0);
    return { sources: 0, vertices: 0 };
  }
  const sources = transformedSources(metas, options.mode || "3d");
  const bounds = new THREE.Box3();
  for (const item of sources) {
    // The isosurface lies inside this margin even when nearby sources blend.
    const padding = item.extent.clone().multiplyScalar(1.8);
    bounds.expandByPoint(item.center.clone().sub(padding));
    bounds.expandByPoint(item.center.clone().add(padding));
  }
  const center = bounds.getCenter(new THREE.Vector3());
  const span = bounds.getSize(new THREE.Vector3());
  for (const axis of ["x", "y", "z"]) span[axis] = Math.max(0.025, span[axis]);
  surface.position.copy(center);
  surface.scale.copy(span).multiplyScalar(0.5);
  surface.rotation.set(0, 0, 0);
  surface.reset();
  const minimum = center.clone().sub(span.clone().multiplyScalar(0.5));
  const n = surface.size, n2 = n * n;
  const dx = span.x / n, dy = span.y / n, dz = span.z / n;
  const strength = surface.isolation + 12;
  const cutoff = Math.sqrt(strength / 12);
  const colors = surface.palette;
  const weights = new Float32Array(n * n * n);
  for (const item of sources) {
    const e = item.inverse;
    const extent = item.extent.clone().multiplyScalar(cutoff);
    const low = item.center.clone().sub(extent).sub(minimum);
    const high = item.center.clone().add(extent).sub(minimum);
    const x0 = Math.max(1, Math.floor(low.x / dx));
    const y0 = Math.max(1, Math.floor(low.y / dy));
    const z0 = Math.max(1, Math.floor(low.z / dz));
    const x1 = Math.min(n - 1, Math.ceil(high.x / dx));
    const y1 = Math.min(n - 1, Math.ceil(high.y / dy));
    const z1 = Math.min(n - 1, Math.ceil(high.z / dz));
    for (let z = z0; z < z1; z++) {
      const wz = minimum.z + z * dz;
      for (let y = y0; y < y1; y++) {
        const wy = minimum.y + y * dy;
        for (let x = x0; x < x1; x++) {
          const wx = minimum.x + x * dx;
          const lx = e[0] * wx + e[4] * wy + e[8] * wz + e[12];
          const ly = e[1] * wx + e[5] * wy + e[9] * wz + e[13];
          const lz = e[2] * wx + e[6] * wy + e[10] * wz + e[14];
          const distance2 = lx * lx + ly * ly + lz * lz;
          const contribution = strength / (0.00001 + distance2) - 12;
          if (contribution <= 0) continue;
          const index = z * n2 + y * n + x;
          surface.field[index] += contribution;
          const weight = Math.min(contribution, strength);
          weights[index] += weight;
          colors[index * 3] += item.color.r * weight;
          colors[index * 3 + 1] += item.color.g * weight;
          colors[index * 3 + 2] += item.color.b * weight;
        }
      }
    }
  }
  for (let index = 0; index < weights.length; index++) {
    if (!weights[index]) continue;
    colors[index * 3] /= weights[index];
    colors[index * 3 + 1] /= weights[index];
    colors[index * 3 + 2] /= weights[index];
  }
  const settings = { ...metas[0].material };
  for (const key of ["metalness", "roughness", "opacity", "emissiveIntensity"])
    settings[key] = metas.reduce((sum, item) => sum + (item.material?.[key] || 0), 0) / metas.length;
  const emission = new THREE.Color(0);
  metas.forEach((record) => emission.add(new THREE.Color(record.material?.emissive || "#000000")
    .multiplyScalar(record.material?.emissiveIntensity || 0)));
  emission.multiplyScalar(1 / metas.length);
  settings.emissive = "#" + emission.getHexString();
  settings.emissiveIntensity = emission.r + emission.g + emission.b > 0 ? 1 : 0;
  settings.color = "#ffffff";
  applyRiderMaterial(surface, { type: "meta", material: settings }, { ...options, vertexColors: true });
  surface.update();
  return { sources: sources.length, vertices: surface.count };
}

/**
 * Rasterize the real triangulated glyph fill into local field sources. Holes stay
 * empty because they are absent from the font's tessellation. The bounded source
 * count keeps converted text editable on small devices.
 */
export function geometryToMetaballSources(geometry, { maxSources = 128 } = {}) {
  maxSources = Math.max(8, Math.min(512, Math.floor(maxSources)));
  const position = geometry.getAttribute("position");
  if (!position?.count) throw new Error("The text has no visible glyphs to convert.");
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const index = geometry.index;
  const count = index ? index.count : position.count;
  const triangles = [];
  let area = 0;
  for (let offset = 0; offset + 2 < count; offset += 3) {
    const ids = [0, 1, 2].map((i) => index ? index.getX(offset + i) : offset + i);
    const a = new THREE.Vector2(position.getX(ids[0]), position.getY(ids[0]));
    const b = new THREE.Vector2(position.getX(ids[1]), position.getY(ids[1]));
    const c = new THREE.Vector2(position.getX(ids[2]), position.getY(ids[2]));
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (cross <= 1e-10) continue;
    triangles.push({ a, b, c, cross });
    area += cross * 0.5;
  }
  if (!triangles.length || area <= 0) throw new Error("Select visible text facing the canvas to convert it.");
  const spacing = Math.max(0.005, Math.sqrt(area / maxSources));
  const z = (bounds.min.z + bounds.max.z) * 0.5;
  const occupied = new Set();
  for (const { a, b, c, cross } of triangles) {
    const x0 = Math.floor((Math.min(a.x, b.x, c.x) - bounds.min.x) / spacing);
    const x1 = Math.ceil((Math.max(a.x, b.x, c.x) - bounds.min.x) / spacing);
    const y0 = Math.floor((Math.min(a.y, b.y, c.y) - bounds.min.y) / spacing);
    const y1 = Math.ceil((Math.max(a.y, b.y, c.y) - bounds.min.y) / spacing);
    for (let iy = y0; iy <= y1; iy++) for (let ix = x0; ix <= x1; ix++) {
      const x = bounds.min.x + (ix + 0.5) * spacing;
      const y = bounds.min.y + (iy + 0.5) * spacing;
      const u = ((b.x - x) * (c.y - y) - (b.y - y) * (c.x - x)) / cross;
      const v = ((c.x - x) * (a.y - y) - (c.y - y) * (a.x - x)) / cross;
      if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7) occupied.add(ix + "," + iy);
    }
  }
  if (!occupied.size) throw new Error("The text is too small to convert. Increase its size first.");
  const points = [...occupied].sort((a, b) => {
    const [ax, ay] = a.split(",").map(Number), [bx, by] = b.split(",").map(Number);
    return ax - bx || ay - by;
  });
  const step = Math.max(1, points.length / maxSources);
  const sources = [];
  for (let index = 0; index < points.length && sources.length < maxSources; index += step) {
    const [x, y] = points[Math.floor(index)].split(",").map(Number);
    sources.push({
      position: [bounds.min.x + (x + 0.5) * spacing, bounds.min.y + (y + 0.5) * spacing, z],
      radius: spacing * 0.65,
    });
  }
  return sources;
}
