import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {
  PARAMETER_LIMITS,
  createObjectRecord,
  normalizeProject,
  serializeProject,
  History,
  createTemplate,
} from "./rider-core.js";

const $ = (id) => document.getElementById(id);
const iconPaths = {
  cube: '<path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9"/>',
  sphere:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  move: '<path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"/>',
  rotate: '<path d="M4 9a8 8 0 1 1 1 9M4 4v5h5"/>',
  scale: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M4 4l6 6M14 14l6 6"/>',
  save: '<path d="M4 3h13l4 4v14H3V3zM7 3v7h9V3M7 21v-7h10v7"/>',
  file: '<path d="M14 3H5v18h14V8zM14 3v5h5M8 13h8M8 17h6"/>',
  folder: '<path d="M3 7V4h7l2 3h9v13H3z"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-7 5 8"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17v.1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2M12 21v2M1 12h2M21 12h2M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2"/>',
  organic:
    '<path d="M9 4c4-5 7 1 7 4 8 1 6 12 1 12-4 5-8 1-8-2-8-2-8-11 0-14Z"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9zM2 13l10 6 10-6M2 17l10 6 10-6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  magnet:
    '<path d="M5 3v10a7 7 0 0 0 14 0V3h-4v10a3 3 0 0 1-6 0V3zM5 7h4M15 7h4"/>',
  undo: '<path d="M4 9h10a7 7 0 0 1 0 14M4 9l5-5M4 9l5 5"/>',
  redo: '<path d="M20 9H10a7 7 0 0 0 0 14M20 9l-5-5M20 9l-5 5"/>',
  sliders:
    '<path d="M5 3v7M5 14v7M12 3v12M12 19v2M19 3v2M19 9v12"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="17" r="2"/><circle cx="19" cy="7" r="2"/>',
  focus:
    '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/><circle cx="12" cy="12" r="3"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  camera: '<path d="M3 7h5l2-3h4l2 3h5v14H3z"/><circle cx="12" cy="13" r="4"/>',
  arrowUpRight: '<path d="M6 18 18 6M6 6h12v12"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  reset: '<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/>',
  ground: '<path d="M3 20h18M12 3v12m-4-4 4 4 4-4"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M9 5c8-2 13 7 13 7l-3 4M6 6l-4 6s4 7 10 7l3-1"/>',
  cursor: '<path d="m5 3 15 10-8 1-3 7z"/>',
  arrowLeft: '<path d="M20 12H4m6-6-6 6 6 6"/>',
};
function icon(name) {
  return (
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' +
    (iconPaths[name] || iconPaths.cube) +
    "</svg>"
  );
}
document
  .querySelectorAll("[data-icon]")
  .forEach((el) => el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon)));
const STORE_KEY = "3d-rider.studio.v2";
let project,
  selectedId = null,
  history,
  displayMode = "material",
  snap = false,
  isDragging = false,
  dirty = false,
  toastTimer,
  saveTimer,
  autosaveAvailable = true;
const view = $("view"),
  scene = new THREE.Scene(),
  meshMap = new Map();
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
} catch (error) {
  $("loading").innerHTML =
    "<strong>Your browser needs WebGL to open the studio.</strong><span>Try a current browser with hardware acceleration enabled.</span>";
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.domElement.setAttribute(
  "aria-label",
  "3D modeling canvas: click to select, drag to orbit",
);
renderer.domElement.tabIndex = 0;
view.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 2000);
camera.position.set(8, 6, 10);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.minDistance = 0.4;
orbit.maxDistance = 500;
const gizmo = new TransformControls(camera, renderer.domElement);
gizmo.setSize(0.85);
scene.add(gizmo.getHelper());
const selectionBox = new THREE.BoxHelper(undefined, 0xb6a0ed);
selectionBox.visible = false;
scene.add(selectionBox);
const hemi = new THREE.HemisphereLight(0xe8e4ff, 0x343046, 2.0);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff0de, 3.4);
key.position.set(5, 9, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -20;
key.shadow.camera.right = 20;
key.shadow.camera.top = 20;
key.shadow.camera.bottom = -20;
key.shadow.normalBias = 0.03;
key.shadow.bias = -0.0001;
scene.add(key);
const rim = new THREE.DirectionalLight(0xc2b5ff, 2.0);
rim.position.set(-5, 5, -6);
scene.add(rim);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(2000, 2000),
  new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.24 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.012;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(100, 100, 0x484753, 0x30323b);
grid.material.transparent = true;
grid.material.opacity = 0.42;
scene.add(grid);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.25, 0.35, 2.5);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const metaMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  roughness: 0.4,
  metalness: 0.1,
  vertexColors: true,
});
const metaSurface = new MarchingCubes(44, metaMaterial, true, true, 100000);
metaSurface.isolation = 70;
metaSurface.visible = false;
scene.add(metaSurface);

function notify(message) {
  $("toast").textContent = message;
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 4000);
}
function selectedRecord() {
  return project.objects.find((o) => o.id === selectedId);
}
function selectedMesh() {
  return meshMap.get(selectedId);
}
function safeNumber(value, fallback, min = -10000, max = 10000) {
  const n = Number(value);
  return Number.isFinite(n) && value !== ""
    ? THREE.MathUtils.clamp(n, min, max)
    : fallback;
}
function geometryFor(o) {
  const p = o.parameters;
  if (o.type === "custom") {
    const g = new THREE.BufferGeometryLoader().parse(o.geometry);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
  switch (o.type) {
    case "box":
      return new THREE.BoxGeometry(p.width, p.height, p.depth);
    case "sphere":
    case "meta":
      return new THREE.SphereGeometry(
        p.radius || 1,
        p.widthSegments || 40,
        p.heightSegments || 24,
      );
    case "cylinder":
      return new THREE.CylinderGeometry(
        p.radiusTop ?? p.radius,
        p.radiusBottom ?? p.radius,
        p.height,
        p.radialSegments || 32,
      );
    case "cone":
      return new THREE.ConeGeometry(p.radius, p.height, p.radialSegments || 32);
    case "torus":
      return new THREE.TorusGeometry(
        p.radius,
        p.tube,
        p.radialSegments || 16,
        p.tubularSegments || 64,
      );
    case "plane":
      return new THREE.PlaneGeometry(p.width, p.height ?? p.depth).rotateX(
        -Math.PI / 2,
      );
    default:
      throw new Error("Unsupported shape: " + o.type);
  }
}
function updateMaterial(mesh, record) {
  const m = record.material;
  mesh.material.color.set(m.color);
  mesh.material.metalness = m.metalness;
  mesh.material.roughness = m.roughness;
  mesh.material.emissive.set(m.emissive);
  mesh.material.emissiveIntensity = m.emissiveIntensity;
  mesh.material.opacity = m.opacity;
  mesh.material.transparent = m.opacity < 1;
  mesh.material.depthWrite = m.opacity >= 0.95;
  mesh.material.wireframe = displayMode === "wire";
  mesh.material.side =
    record.type === "plane" ? THREE.DoubleSide : THREE.FrontSide;
  mesh.material.needsUpdate = true;
}
function createMesh(o) {
  let mesh;
  if (o.type === "light") {
    mesh = new THREE.Group();
    const light = new THREE.PointLight(
      o.light.color,
      o.light.intensity,
      o.light.range,
      o.light.decay,
    );
    light.castShadow = false;
    mesh.add(light);
    const marker = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.12, 1),
      new THREE.MeshBasicMaterial({ color: o.light.color, wireframe: true }),
    );
    marker.userData.editorLight = true;
    mesh.add(marker);
    mesh.userData.light = light;
  } else {
    mesh = new THREE.Mesh(geometryFor(o), new THREE.MeshPhysicalMaterial());
    updateMaterial(mesh, o);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  mesh.userData.recordId = o.id;
  mesh.name = o.name;
  mesh.position.fromArray(o.position);
  mesh.rotation.fromArray([...o.rotation, "XYZ"]);
  mesh.scale.fromArray(o.scale);
  mesh.visible = o.visible && o.type !== "meta";
  if (o.type === "light") mesh.children[1].visible = displayMode !== "rendered";
  scene.add(mesh);
  meshMap.set(o.id, mesh);
  return mesh;
}
function disposeMesh(mesh) {
  scene.remove(mesh);
  mesh.traverse((child) => {
    child.geometry?.dispose();
    if (child.material) child.material.dispose();
  });
}
function rebuildScene() {
  gizmo.detach();
  meshMap.forEach(disposeMesh);
  meshMap.clear();
  project.objects.forEach(createMesh);
  applyEnvironment();
  updateMetas();
  select(selectedId, false);
  refreshObjects();
  refreshStats();
  syncProjectHeading();
}
function applyEnvironment() {
  scene.background = new THREE.Color(project.environment.background);
  renderer.toneMappingExposure = project.environment.exposure;
  grid.visible = project.environment.grid && displayMode !== "rendered";
  floor.visible = displayMode !== "wire";
  $("background").value = project.environment.background;
  $("exposure").value = project.environment.exposure;
  $("exposureValue").textContent = project.environment.exposure.toFixed(2);
  $("gridBtn").classList.toggle("active", project.environment.grid);
  $("gridBtn").setAttribute("aria-pressed", String(project.environment.grid));
}
function updateMetas() {
  const metas = project.objects.filter((o) => o.type === "meta" && o.visible);
  metaSurface.visible = metas.length > 0;
  if (!metas.length) return;
  const bounds = new THREE.Box3();
  metas.forEach((o) => {
    const center = new THREE.Vector3(...o.position);
    const radius =
      (o.parameters.radius || 1) *
      Math.max(...o.scale.map(Math.abs)) *
      (o.parameters.influence || 1.25);
    bounds.expandByPoint(center.clone().addScalar(radius * 1.6));
    bounds.expandByPoint(center.clone().addScalar(-radius * 1.6));
  });
  const center = bounds.getCenter(new THREE.Vector3()),
    size = Math.max(...bounds.getSize(new THREE.Vector3()).toArray(), 3);
  metaSurface.position.copy(center);
  metaSurface.scale.setScalar(size / 2);
  metaSurface.reset();
  let metalness = 0,
    roughness = 0,
    opacity = 0,
    emission = new THREE.Color(0),
    strength = 0;
  metas.forEach((o) => {
    const point = new THREE.Vector3(...o.position)
      .sub(center)
      .divideScalar(size)
      .addScalar(0.5);
    const radius =
      (o.parameters.radius || 1) *
      Math.max(...o.scale.map(Math.abs)) *
      (o.parameters.influence || 1.25);
    const normalizedRadius = radius / size;
    const fieldStrength =
      normalizedRadius * normalizedRadius * (metaSurface.isolation + 12);
    metaSurface.addBall(
      point.x,
      point.y,
      point.z,
      fieldStrength,
      12,
      new THREE.Color(o.material.color),
    );
    metalness += o.material.metalness;
    roughness += o.material.roughness;
    opacity += o.material.opacity;
    emission.add(
      new THREE.Color(o.material.emissive).multiplyScalar(
        o.material.emissiveIntensity,
      ),
    );
    strength += o.material.emissiveIntensity;
  });
  metaMaterial.metalness = metalness / metas.length;
  metaMaterial.roughness = roughness / metas.length;
  metaMaterial.opacity = opacity / metas.length;
  metaMaterial.transparent = metaMaterial.opacity < 1;
  metaMaterial.emissive.copy(emission.multiplyScalar(1 / metas.length));
  metaMaterial.emissiveIntensity = strength ? 1 : 0;
  metaMaterial.wireframe = displayMode === "wire";
  metaSurface.update();
}
function syncProjectHeading() {
  $("projectName").value = project.name;
  $("sceneTitle").textContent = project.name;
}
function snapshot() {
  return { project: JSON.parse(serializeProject(project)), selectedId };
}
function commit(message) {
  dirty = true;
  history.push(snapshot());
  updateHistoryButtons();
  queueAutosave();
  if (message) notify(message);
}
function queueAutosave() {
  $("saveStatus").textContent = "Saving on this device…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, serializeProject(project));
      autosaveAvailable = true;
      $("saveStatus").textContent = "Saved on this device";
      $("saveStatus").classList.remove("unsaved");
    } catch {
      autosaveAvailable = false;
      $("saveStatus").textContent = "Download a file to save";
      $("saveStatus").classList.add("unsaved");
    }
  }, 400);
}
function updateHistoryButtons() {
  $("undoBtn").disabled = !history.canUndo;
  $("redoBtn").disabled = !history.canRedo;
}
function restore(state) {
  if (!state) return;
  project = normalizeProject(state.project);
  selectedId = state.selectedId;
  rebuildScene();
  updateHistoryButtons();
  dirty = true;
  queueAutosave();
}
function showTab(which) {
  const build = which === "build";
  $("buildPanel").hidden = !build;
  $("scenePanel").hidden = build;
  ["build", "scene"].forEach((t) => {
    const el = $(t + "Tab");
    el.classList.toggle("active", t === which);
    el.setAttribute("aria-selected", String(t === which));
    el.tabIndex = t === which ? 0 : -1;
  });
}
function select(id, openInspector = true) {
  selectedId = project.objects.some((o) => o.id === id) ? id : null;
  const o = selectedRecord(),
    mesh = selectedMesh();
  if (o && mesh && o.visible && !o.locked) {
    gizmo.attach(mesh);
    selectionBox.setFromObject(mesh);
    selectionBox.visible = displayMode !== "rendered";
  } else {
    gizmo.detach();
    selectionBox.visible = false;
  }
  syncInspector();
  refreshObjects();
  if (openInspector && window.innerWidth <= 950 && o) {
    $("inspectorPanel").classList.add("is-open");
    $("libraryPanel").classList.remove("is-open");
  }
}
function refreshObjects() {
  $("objects").replaceChildren();
  $("objectCount").textContent = project.objects.length;
  if (!project.objects.length) {
    const p = document.createElement("p");
    p.className = "scene-empty";
    p.textContent =
      "A blank canvas, ready for an idea. Add your first shape from Build.";
    $("objects").append(p);
  }
  project.objects.forEach((o) => {
    const row = document.createElement("div");
    row.className =
      "object-row" +
      (o.id === selectedId ? " selected" : "") +
      (!o.visible ? " is-hidden" : "");
    const b = document.createElement("button");
    b.className = "object-select";
    b.innerHTML = icon(
      o.type === "light" ? "sun" : o.type === "meta" ? "organic" : "cube",
    );
    const label = document.createElement("span");
    label.textContent = o.name;
    b.append(label);
    b.setAttribute("aria-pressed", String(o.id === selectedId));
    b.addEventListener("click", () => select(o.id));
    const visibility = document.createElement("button");
    visibility.className = "icon-button visibility";
    visibility.innerHTML = icon(o.visible ? "eye" : "eyeOff");
    visibility.title = o.visible ? "Hide object" : "Show object";
    visibility.setAttribute("aria-label", visibility.title + " " + o.name);
    visibility.addEventListener("click", () => {
      o.visible = !o.visible;
      meshMap.get(o.id).visible = o.visible && o.type !== "meta";
      updateMetas();
      select(selectedId, false);
      refreshStats();
      commit();
    });
    row.append(b, visibility);
    $("objects").append(row);
  });
}
function refreshStats() {
  let vertices = 0;
  project.objects
    .filter((o) => o.visible && !["meta", "light"].includes(o.type))
    .forEach(
      (o) =>
        (vertices +=
          meshMap.get(o.id)?.geometry?.attributes.position?.count || 0),
    );
  if (metaSurface.visible) vertices += metaSurface.count || 0;
  $("sceneStats").textContent =
    project.objects.length +
    " object" +
    (project.objects.length === 1 ? "" : "s") +
    " · " +
    vertices.toLocaleString() +
    " vertices";
}
const transformIds = ["px", "py", "pz", "rx", "ry", "rz", "sx", "sy", "sz"];
const materialIds = ["color", "metal", "rough", "opacity", "emit", "estr"];
function syncInspector() {
  const o = selectedRecord();
  $("emptyInspector").hidden = !!o;
  $("selectionControls").hidden = !o;
  $("selectedKind").textContent = o
    ? o.type === "custom"
      ? "IMPORTED MESH"
      : o.type.toUpperCase()
    : "NO SELECTION";
  if (!o) return;
  $("objectName").value = o.name;
  transformIds.forEach((id, i) => {
    const arr = i < 3 ? o.position : i < 6 ? o.rotation : o.scale;
    const n = arr[i % 3] * (i >= 3 && i < 6 ? 180 / Math.PI : 1);
    if (document.activeElement !== $(id)) $(id).value = Number(n.toFixed(3));
    $(id).disabled = o.locked;
  });
  $("materialPanel").hidden = o.type === "light";
  $("lightPanel").hidden = o.type !== "light";
  $("shapePanel").hidden = o.type === "custom" || o.type === "light";
  if (o.type === "light") {
    $("lightColor").value = o.light.color;
    $("lightIntensity").max = Math.max(200, o.light.intensity);
    $("lightIntensity").value = o.light.intensity;
    $("lightIntensityValue").textContent = o.light.intensity;
    $("lightRange").value = o.light.range;
  } else {
    const m = o.material;
    $("color").value = m.color;
    $("colorHex").textContent = m.color.toUpperCase();
    $("metal").value = m.metalness;
    $("rough").value = m.roughness;
    $("opacity").value = m.opacity;
    $("emit").value = m.emissive;
    $("estr").max = Math.max(10, m.emissiveIntensity);
    $("estr").value = m.emissiveIntensity;
    updateMaterialOutputs();
    renderShapeFields(o);
  }
}
function updateMaterialOutputs() {
  ["metal", "rough", "opacity"].forEach(
    (id) => ($(id + "Value").textContent = Number($(id).value).toFixed(2)),
  );
  $("estrValue").textContent = Number($("estr").value).toFixed(1);
  $("colorHex").textContent = $("color").value.toUpperCase();
}
function renderShapeFields(o) {
  const current = $("shapeFields").dataset.recordId;
  if (
    current === o.id &&
    $("shapeFields").children.length === Object.keys(o.parameters).length
  ) {
    $("shapeFields")
      .querySelectorAll("input")
      .forEach((input) => {
        if (document.activeElement !== input)
          input.value = o.parameters[input.dataset.parameter];
      });
    return;
  }
  $("shapeFields").dataset.recordId = o.id;
  $("shapeFields").replaceChildren();
  Object.keys(o.parameters).forEach((key) => {
    const label = document.createElement("label");
    label.textContent = key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (c) => c.toUpperCase());
    const input = document.createElement("input");
    input.type = "number";
    input.dataset.parameter = key;
    input.value = o.parameters[key];
    const limits = PARAMETER_LIMITS[key] || [0.001, 1000];
    input.min = limits[0];
    input.max = limits[1];
    input.step = /segments/i.test(key) ? "1" : "0.1";
    input.setAttribute("aria-label", label.textContent);
    input.addEventListener("change", () => {
      const fallback = o.parameters[key],
        next = safeNumber(input.value, fallback, ...limits);
      const value = /segments/i.test(key) ? Math.round(next) : next;
      try {
        o.parameters = createObjectRecord(o.type, {
          ...o,
          parameters: { ...o.parameters, [key]: value },
        }).parameters;
      } catch (error) {
        input.value = fallback;
        notify("Could not change shape: " + error.message);
        return;
      }
      const mesh = meshMap.get(o.id);
      mesh.geometry.dispose();
      mesh.geometry = geometryFor(o);
      updateMetas();
      selectionBox.setFromObject(mesh);
      refreshStats();
      syncInspector();
      commit();
    });
    label.append(input);
    $("shapeFields").append(label);
  });
}
function updateRecordFromMesh() {
  const mesh = selectedMesh(),
    o = selectedRecord();
  if (!mesh || !o) return;
  o.position = mesh.position.toArray();
  o.rotation = [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z];
  o.scale = mesh.scale
    .toArray()
    .map((v) => (Math.abs(v) < 0.01 ? (v < 0 ? -0.01 : 0.01) : v));
  mesh.scale.fromArray(o.scale);
  updateMetas();
  selectionBox.setFromObject(mesh);
  syncInspector();
}
gizmo.addEventListener("dragging-changed", (event) => {
  isDragging = event.value;
  orbit.enabled = !isDragging;
  if (!isDragging) {
    updateRecordFromMesh();
    refreshStats();
    commit();
  }
});
gizmo.addEventListener("objectChange", updateRecordFromMesh);
transformIds.forEach((id, i) =>
  $(id).addEventListener("change", () => {
    const o = selectedRecord(),
      mesh = selectedMesh();
    if (!o || !mesh) return;
    const array = i < 3 ? o.position : i < 6 ? o.rotation : o.scale,
      index = i % 3;
    let value = safeNumber(
      $(id).value,
      array[index] * (i >= 3 && i < 6 ? 180 / Math.PI : 1),
      i >= 6 ? -1000 : i >= 3 ? -18000 : -10000,
      i >= 6 ? 1000 : i >= 3 ? 18000 : 10000,
    );
    if (i >= 6 && Math.abs(value) < 0.001) value = value < 0 ? -0.001 : 0.001;
    if (i >= 3 && i < 6) value *= Math.PI / 180;
    array[index] = value;
    mesh.position.fromArray(o.position);
    mesh.rotation.set(...o.rotation);
    mesh.scale.fromArray(o.scale);
    updateMetas();
    selectionBox.setFromObject(mesh);
    syncInspector();
    commit();
  }),
);
materialIds.forEach((id) => {
  $(id).addEventListener("input", () => {
    const o = selectedRecord();
    if (!o || o.type === "light") return;
    const keys = {
      color: "color",
      metal: "metalness",
      rough: "roughness",
      opacity: "opacity",
      emit: "emissive",
      estr: "emissiveIntensity",
    };
    o.material[keys[id]] = ["color", "emit"].includes(id)
      ? $(id).value
      : +$(id).value;
    updateMaterial(selectedMesh(), o);
    updateMetas();
    updateMaterialOutputs();
  });
  $(id).addEventListener("change", () => {
    if (selectedRecord()) commit();
  });
});
$("objectName").addEventListener("change", () => {
  const o = selectedRecord();
  if (!o) return;
  o.name = $("objectName").value.trim() || "Untitled object";
  selectedMesh().name = o.name;
  syncInspector();
  refreshObjects();
  commit();
});
$("projectName").addEventListener("change", () => {
  project.name = $("projectName").value.trim() || "Untitled scene";
  syncProjectHeading();
  commit();
});
["lightColor", "lightIntensity", "lightRange"].forEach((id) => {
  const apply = () => {
    const o = selectedRecord(),
      mesh = selectedMesh();
    if (!o || o.type !== "light") return;
    const key = {
      lightColor: "color",
      lightIntensity: "intensity",
      lightRange: "range",
    }[id];
    o.light[key] =
      id === "lightColor"
        ? $(id).value
        : safeNumber(
            $(id).value,
            o.light[key],
            0,
            id === "lightIntensity" ? 1000 : 10000,
          );
    mesh.userData.light.color.set(o.light.color);
    mesh.userData.light.intensity = o.light.intensity;
    mesh.userData.light.distance = o.light.range;
    mesh.children[1].material.color.set(o.light.color);
    $("lightIntensityValue").textContent = o.light.intensity;
  };
  $(id).addEventListener("input", apply);
  $(id).addEventListener("change", () => {
    apply();
    commit();
  });
});
["background", "exposure"].forEach((id) => {
  $(id).addEventListener("input", () => {
    project.environment.background = $("background").value;
    project.environment.exposure = +$("exposure").value;
    applyEnvironment();
  });
  $(id).addEventListener("change", () => commit());
});
document.querySelectorAll("[data-material]").forEach((b) =>
  b.addEventListener("click", () => {
    const o = selectedRecord();
    if (!o || o.type === "light") return;
    const presets = {
      clay: {
        metalness: 0,
        roughness: 0.8,
        opacity: 1,
        emissive: "#000000",
        emissiveIntensity: 0,
      },
      metal: {
        metalness: 0.95,
        roughness: 0.22,
        opacity: 1,
        emissive: "#000000",
        emissiveIntensity: 0,
      },
      glass: {
        metalness: 0,
        roughness: 0.08,
        opacity: 0.28,
        emissive: "#000000",
        emissiveIntensity: 0,
      },
      glow: {
        metalness: 0,
        roughness: 0.4,
        opacity: 1,
        emissive: o.material.color,
        emissiveIntensity: 3,
      },
    };
    Object.assign(o.material, presets[b.dataset.material]);
    updateMaterial(selectedMesh(), o);
    updateMetas();
    syncInspector();
    commit(b.textContent + " material applied");
  }),
);
function addObject(type) {
  if (project.objects.length >= 1000) {
    notify("This scene has reached the 1,000 object limit.");
    return;
  }
  const o = createObjectRecord(type);
  const center = orbit.target.clone();
  o.position[0] = Math.round(center.x * 2) / 2;
  o.position[2] = Math.round(center.z * 2) / 2;
  if (type === "meta")
    o.position[0] +=
      project.objects.filter((x) => x.type === "meta").length * 0.8;
  if (type === "light") o.position[1] = 3;
  if (type === "meta")
    o.position[1] =
      (o.parameters.radius || 0.65) * (o.parameters.influence || 1.25);
  if (!canInsert([o])) return;
  project.objects.push(o);
  const mesh = createMesh(o);
  if (type !== "light" && type !== "meta") {
    const bounds = new THREE.Box3().setFromObject(mesh);
    o.position[1] -= bounds.min.y;
    mesh.position.y = o.position[1];
  }
  updateMetas();
  select(o.id);
  refreshStats();
  commit(o.name + " added");
}
function canInsert(objects) {
  try {
    normalizeProject({ ...project, objects: [...project.objects, ...objects] });
    return true;
  } catch (error) {
    notify("Could not add to scene: " + error.message);
    return false;
  }
}
document
  .querySelectorAll("[data-add]")
  .forEach((b) => b.addEventListener("click", () => addObject(b.dataset.add)));
document.querySelectorAll("[data-template]").forEach((b) =>
  b.addEventListener("click", () => {
    const records = createTemplate(b.dataset.template);
    if (!canInsert(records)) return;
    const existingMeshes = allModelMeshes();
    if (existingMeshes.length) {
      const existingBounds = new THREE.Box3();
      existingMeshes.forEach((m) => existingBounds.expandByObject(m));
      let starterMin = Infinity;
      records
        .filter((o) => o.type !== "light")
        .forEach((o) => {
          const g = geometryFor(o);
          g.computeBoundingBox();
          starterMin = Math.min(
            starterMin,
            g.boundingBox.min.x * Math.abs(o.scale[0]) + o.position[0],
          );
          g.dispose();
        });
      if (Number.isFinite(starterMin))
        records.forEach(
          (o) => (o.position[0] += existingBounds.max.x - starterMin + 1),
        );
    }
    const existingNames = new Set(project.objects.map((o) => o.name));
    records.forEach((o) => {
      if (existingNames.has(o.name)) o.name += " copy";
      project.objects.push(o);
      createMesh(o);
    });
    updateMetas();
    select(records[0].id, false);
    refreshObjects();
    refreshStats();
    frameObjects(records.map((o) => meshMap.get(o.id)));
    commit("Starter added — every part is yours to edit.");
    $("libraryPanel").classList.remove("is-open");
  }),
);
function setTool(mode) {
  gizmo.setMode(mode);
  document.querySelectorAll("[data-tool]").forEach((b) => {
    const active = b.dataset.tool === mode;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
}
document
  .querySelectorAll("[data-tool]")
  .forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool)));
function toggleSnap() {
  snap = !snap;
  gizmo.setTranslationSnap(snap ? 0.25 : null);
  gizmo.setRotationSnap(snap ? Math.PI / 12 : null);
  gizmo.setScaleSnap(snap ? 0.1 : null);
  $("snapBtn").classList.toggle("active", snap);
  $("snapBtn").setAttribute("aria-pressed", String(snap));
  notify(snap ? "Snap on: 0.25 units · 15° · 0.1 scale" : "Snapping off");
}
$("snapBtn").addEventListener("click", toggleSnap);
document.querySelectorAll("[data-mode]").forEach((b) =>
  b.addEventListener("click", () => {
    displayMode = b.dataset.mode;
    document.querySelectorAll("[data-mode]").forEach((x) => {
      const active = x === b;
      x.classList.toggle("active", active);
      x.setAttribute("aria-pressed", String(active));
    });
    project.objects
      .filter((o) => o.type !== "light")
      .forEach((o) => updateMaterial(meshMap.get(o.id), o));
    updateMetas();
    applyEnvironment();
    selectionBox.visible =
      !!selectedMesh() &&
      selectedRecord()?.visible &&
      displayMode !== "rendered";
    sceneLightMarkers(displayMode !== "rendered");
  }),
);
function sceneLightMarkers(visible) {
  project.objects
    .filter((o) => o.type === "light")
    .forEach((o) => (meshMap.get(o.id).children[1].visible = visible));
}
$("gridBtn").addEventListener("click", () => {
  project.environment.grid = !project.environment.grid;
  applyEnvironment();
  commit();
});
$("buildTab").addEventListener("click", () => showTab("build"));
$("sceneTab").addEventListener("click", () => showTab("scene"));
["buildTab", "sceneTab"].forEach((id) =>
  $(id).addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const which = id === "buildTab" ? "scene" : "build";
      showTab(which);
      $(which + "Tab").focus();
    }
  }),
);
function openBuild() {
  showTab("build");
  $("libraryPanel").classList.add("is-open");
  $("inspectorPanel").classList.remove("is-open");
}
$("sceneAddBtn").addEventListener("click", openBuild);
$("emptyAddBtn").addEventListener("click", openBuild);
$("libraryToggle").addEventListener("click", () => {
  $("libraryPanel").classList.toggle("is-open");
  $("inspectorPanel").classList.remove("is-open");
  if ($("libraryPanel").classList.contains("is-open"))
    $("buildPanel").hidden ? $("sceneTab").focus() : $("buildTab").focus();
});
$("inspectorToggle").addEventListener("click", () => {
  $("inspectorPanel").classList.toggle("is-open");
  $("libraryPanel").classList.remove("is-open");
  if ($("inspectorPanel").classList.contains("is-open"))
    $("inspectorPanel").querySelector("[data-panel-close]").focus();
});
document.querySelectorAll("[data-panel-close]").forEach((b) =>
  b.addEventListener("click", () => {
    const panel = b.closest(".sidebar");
    panel.classList.remove("is-open");
    $(
      panel.id === "libraryPanel" ? "libraryToggle" : "inspectorToggle",
    ).focus();
  }),
);
[
  ["libraryPanel", "libraryToggle"],
  ["inspectorPanel", "inspectorToggle"],
].forEach(([panel, button]) =>
  new MutationObserver(() =>
    $(button).setAttribute(
      "aria-expanded",
      String($(panel).classList.contains("is-open")),
    ),
  ).observe($(panel), { attributes: true, attributeFilter: ["class"] }),
);
function duplicateSelected() {
  const o = selectedRecord();
  if (!o) return;
  const copy = createObjectRecord(o.type, {
    ...structuredClone(o),
    id: undefined,
    name: o.name + " copy",
    position: [o.position[0] + 0.6, o.position[1], o.position[2] + 0.6],
  });
  if (!canInsert([copy])) return;
  project.objects.push(copy);
  createMesh(copy);
  updateMetas();
  select(copy.id);
  refreshStats();
  commit("Object duplicated");
}
function deleteSelected() {
  const o = selectedRecord();
  if (!o) return;
  const idx = project.objects.indexOf(o);
  gizmo.detach();
  disposeMesh(selectedMesh());
  meshMap.delete(o.id);
  project.objects.splice(idx, 1);
  updateMetas();
  select(project.objects[Math.min(idx, project.objects.length - 1)]?.id, false);
  refreshStats();
  commit("Object deleted");
}
$("duplicateBtn").addEventListener("click", duplicateSelected);
$("deleteBtn").addEventListener("click", deleteSelected);
$("resetTransformBtn").addEventListener("click", () => {
  const o = selectedRecord(),
    mesh = selectedMesh();
  if (!o) return;
  o.position = [0, 1, 0];
  o.rotation = [0, 0, 0];
  o.scale = [1, 1, 1];
  mesh.position.fromArray(o.position);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
  updateMetas();
  selectionBox.setFromObject(mesh);
  syncInspector();
  commit("Transform reset");
});
$("groundBtn").addEventListener("click", () => {
  const o = selectedRecord(),
    mesh = selectedMesh();
  if (!o || o.type === "light") return;
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  o.position[1] -= box.min.y;
  mesh.position.y = o.position[1];
  updateMetas();
  selectionBox.setFromObject(mesh);
  syncInspector();
  commit("Placed on ground");
});
$("undoBtn").addEventListener("click", () => restore(history.undo()));
$("redoBtn").addEventListener("click", () => restore(history.redo()));
function frameObjects(objects, direction = null) {
  const box = new THREE.Box3();
  objects.forEach((mesh) => {
    mesh.updateMatrixWorld(true);
    box.expandByObject(mesh);
  });
  if (box.isEmpty()) {
    orbit.target.set(0, 1, 0);
    camera.position.set(8, 6, 10);
    return;
  }
  const center = box.getCenter(new THREE.Vector3()),
    size = box.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 0.5);
  const distance =
    ((maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) *
      1.6) /
    Math.min(camera.aspect, 1);
  const dir =
    direction || camera.position.clone().sub(orbit.target).normalize();
  orbit.target.copy(center);
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.updateProjectionMatrix();
  orbit.update();
}
function allModelMeshes() {
  return project.objects
    .filter((o) => o.visible && o.type !== "light")
    .map((o) => meshMap.get(o.id));
}
$("frameBtn").addEventListener("click", () =>
  frameObjects(selectedMesh() ? [selectedMesh()] : allModelMeshes()),
);
$("cameraBtn").addEventListener("click", () => setCamera("perspective"));
function setCamera(name) {
  const directions = {
    perspective: new THREE.Vector3(7, 4.5, 9).normalize(),
    front: new THREE.Vector3(0, 0.0001, 1),
    top: new THREE.Vector3(0.0001, 1, 0),
    right: new THREE.Vector3(1, 0.0001, 0),
  };
  frameObjects(allModelMeshes(), directions[name]);
  document
    .querySelectorAll("[data-camera]")
    .forEach((b) => b.classList.toggle("active", b.dataset.camera === name));
}
document
  .querySelectorAll("[data-camera]")
  .forEach((b) =>
    b.addEventListener("click", () => setCamera(b.dataset.camera)),
  );
let pointerStart = null;
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (e.button === 0)
    pointerStart = {
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
      axis: gizmo.axis,
    };
});
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!pointerStart) return;
  const start = pointerStart;
  pointerStart = null;
  if (
    e.button !== 0 ||
    isDragging ||
    start.axis ||
    Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5 ||
    performance.now() - start.time > 600
  )
    return;
  const rect = renderer.domElement.getBoundingClientRect(),
    point = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    ),
    ray = new THREE.Raycaster();
  ray.setFromCamera(point, camera);
  const targets = project.objects
    .filter((o) => o.visible)
    .map((o) => meshMap.get(o.id));
  const hit = ray
    .intersectObjects(targets, true)
    .find(
      (h) => h.object.userData.recordId || h.object.parent?.userData.recordId,
    );
  select(
    hit
      ? hit.object.userData.recordId || hit.object.parent.userData.recordId
      : null,
    false,
  );
});
function filename(suffix) {
  return (
    (project.name
      .replace(/[^a-z0-9-_ ]/gi, "")
      .trim()
      .replace(/\s+/g, "-") || "3D-Rider") + suffix
  );
}
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function saveProject() {
  download(
    new Blob([serializeProject(project)], { type: "application/json" }),
    filename(".3drider"),
  );
  dirty = false;
  notify("Project downloaded — shapes, lights and materials included.");
}
$("saveBtn").addEventListener("click", saveProject);
$("openBtn").addEventListener("click", () => $("openFile").click());
$("importBtn").addEventListener("click", () => $("stlFile").click());
$("newBtn").addEventListener("click", () => $("newDialog").showModal());
$("helpBtn").addEventListener("click", () => $("helpDialog").showModal());
$("libraryHelpBtn").addEventListener("click", () =>
  $("helpDialog").showModal(),
);
document
  .querySelectorAll("[data-dialog-close]")
  .forEach((b) =>
    b.addEventListener("click", () => b.closest("dialog").close()),
  );
$("saveBeforeNewBtn").addEventListener("click", saveProject);
$("confirmNewBtn").addEventListener("click", () => {
  project = normalizeProject({
    version: 2,
    name: "Untitled scene",
    objects: [],
    environment: project.environment,
  });
  selectedId = null;
  rebuildScene();
  commit("A fresh canvas, ready for your next idea.");
  setCamera("perspective");
  $("newDialog").close();
  showTab("build");
});
$("openFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 32 * 1024 * 1024)
      throw new Error("Projects must be smaller than 32 MB.");
    const next = normalizeProject(await file.text());
    // Validate every imported geometry before replacing the current workspace.
    next.objects
      .filter((o) => o.type !== "light")
      .forEach((o) => {
        const g = geometryFor(o);
        g.dispose();
      });
    if (
      dirty &&
      !window.confirm(
        "Open this project and replace the current scene? Download your current project first if you want to keep a separate copy.",
      )
    )
      return;
    project = next;
    selectedId = next.objects[0]?.id;
    rebuildScene();
    commit(
      next.warnings?.length
        ? next.warnings.find((warning) => /placeholder/i.test(warning)) ||
            next.warnings[0]
        : "Project opened",
    );
    setCamera("perspective");
  } catch (error) {
    notify("Could not open project: " + error.message);
  } finally {
    e.target.value = "";
  }
});
$("stlFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 32 * 1024 * 1024)
      throw new Error("STL files must be smaller than 32 MB.");
    const geometry = new STLLoader().parse(await file.arrayBuffer()),
      position = geometry.attributes.position;
    if (!position || position.count < 3 || position.array.length > 4000000)
      throw new Error("This file has no usable mesh or is too large.");
    for (const n of position.array)
      if (!Number.isFinite(n))
        throw new Error("The mesh contains invalid coordinates.");
    geometry.computeVertexNormals();
    geometry.center();
    geometry.computeBoundingBox();
    const size = geometry.boundingBox.getSize(new THREE.Vector3()),
      max = Math.max(size.x, size.y, size.z);
    if (max <= 0) throw new Error("The mesh has no size.");
    geometry.scale(3 / max, 3 / max, 3 / max);
    geometry.computeBoundingBox();
    const o = createObjectRecord("custom", {
      name: file.name.replace(/\.stl$/i, ""),
      geometry: geometry.toJSON(),
      position: [0, -geometry.boundingBox.min.y, 0],
      material: { color: "#b6b4c8" },
    });
    geometry.dispose();
    if (!canInsert([o])) return;
    project.objects.push(o);
    createMesh(o);
    select(o.id);
    refreshStats();
    frameObjects([selectedMesh()]);
    commit("STL imported. Geometry will be included in saved projects.");
  } catch (error) {
    notify("Could not import STL: " + error.message);
  } finally {
    e.target.value = "";
  }
});
function exportGroup() {
  const group = new THREE.Group();
  project.objects
    .filter((o) => o.visible && !["light", "meta"].includes(o.type))
    .forEach((o) => {
      const original = meshMap.get(o.id),
        mesh = new THREE.Mesh(original.geometry, original.material);
      mesh.name = o.name;
      mesh.position.copy(original.position);
      mesh.quaternion.copy(original.quaternion);
      mesh.scale.copy(original.scale);
      group.add(mesh);
    });
  if (metaSurface.visible && metaSurface.count) {
    const geometry = metaSurface.geometry.clone();
    const count = metaSurface.count;
    ["position", "normal", "color", "uv"].forEach((name) => {
      const attr = geometry.attributes[name];
      if (attr)
        geometry.setAttribute(
          name,
          new THREE.BufferAttribute(
            attr.array.slice(0, count * attr.itemSize),
            attr.itemSize,
          ),
        );
    });
    geometry.setDrawRange(0, count);
    const mesh = new THREE.Mesh(geometry, metaMaterial);
    mesh.position.copy(metaSurface.position);
    mesh.scale.copy(metaSurface.scale);
    group.add(mesh);
  }
  group.updateMatrixWorld(true);
  return group;
}
function exportModel(format) {
  const group = exportGroup();
  if (!group.children.length) {
    notify("Add a visible shape before exporting.");
    return;
  }
  try {
    const data =
      format === "stl"
        ? new STLExporter().parse(group, { binary: true })
        : new OBJExporter().parse(group);
    download(
      new Blob([data], {
        type: format === "stl" ? "application/octet-stream" : "text/plain",
      }),
      filename("." + format),
    );
    notify(format.toUpperCase() + " model exported");
  } catch (error) {
    notify("Export failed: " + error.message);
  } finally {
    group.children
      .filter(
        (m) =>
          m.geometry !== meshMap.get(m.userData.recordId)?.geometry &&
          m.material === metaMaterial,
      )
      .forEach((m) => m.geometry.dispose());
    document.querySelector(".export-menu").open = false;
  }
}
$("exportStlBtn").addEventListener("click", () => exportModel("stl"));
$("exportObjBtn").addEventListener("click", () => exportModel("obj"));
$("renderBtn").addEventListener("click", () => {
  const oldGrid = grid.visible,
    oldBox = selectionBox.visible,
    oldGizmo = gizmo.getHelper().visible;
  grid.visible = false;
  selectionBox.visible = false;
  gizmo.getHelper().visible = false;
  sceneLightMarkers(false);
  composer.render();
  renderer.domElement.toBlob((blob) => {
    if (blob) {
      download(blob, filename(".png"));
      notify("Rendered image downloaded");
    } else notify("Could not export an image.");
  }, "image/png");
  grid.visible = oldGrid;
  selectionBox.visible = oldBox;
  gizmo.getHelper().visible = oldGizmo;
  sceneLightMarkers(displayMode !== "rendered");
  document.querySelector(".export-menu").open = false;
});
document.addEventListener("keydown", (e) => {
  if (
    e.target.closest("input,textarea,select,[contenteditable=true]") ||
    document.querySelector("dialog[open]")
  )
    return;
  const modifier = e.ctrlKey || e.metaKey,
    key = e.key.toLowerCase();
  if (modifier && key === "s") {
    e.preventDefault();
    saveProject();
  } else if (modifier && key === "z") {
    e.preventDefault();
    restore(e.shiftKey ? history.redo() : history.undo());
  } else if (modifier && key === "y") {
    e.preventDefault();
    restore(history.redo());
  } else if (modifier && key === "d") {
    e.preventDefault();
    duplicateSelected();
  } else if (!modifier && (key === "delete" || key === "backspace")) {
    e.preventDefault();
    deleteSelected();
  } else if (!modifier && ["g", "r", "s"].includes(key)) {
    e.preventDefault();
    setTool({ g: "translate", r: "rotate", s: "scale" }[key]);
  } else if (!modifier && key === "f") {
    e.preventDefault();
    frameObjects(selectedMesh() ? [selectedMesh()] : allModelMeshes());
  } else if (key === "shift" && !e.repeat) toggleSnap();
  else if (key === "escape") {
    select(null, false);
    $("libraryPanel").classList.remove("is-open");
    $("inspectorPanel").classList.remove("is-open");
  }
});
document.addEventListener("click", (e) => {
  const menu = document.querySelector(".export-menu");
  if (!menu.contains(e.target)) menu.open = false;
});
window.addEventListener("beforeunload", (e) => {
  if (dirty && !autosaveAvailable) {
    e.preventDefault();
    e.returnValue = "";
  }
});
function resize() {
  const w = view.clientWidth,
    h = view.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);
let recovered = false;
try {
  const saved = localStorage.getItem(STORE_KEY);
  if (saved) {
    project = normalizeProject(saved);
    recovered = true;
  }
} catch {
  notify(
    "The saved browser session could not be restored. You can still open a project file.",
  );
}
if (!project)
  project = normalizeProject({
    version: 2,
    name: "Little companion",
    objects: createTemplate("robot"),
    environment: { background: "#20232b", grid: true, exposure: 1.15 },
  });
selectedId = project.objects[0]?.id || null;
history = new History(snapshot(), 60);
rebuildScene();
resize();
setCamera("perspective");
updateHistoryButtons();
$("loading").hidden = true;
if (recovered) notify("Your last workspace is back. Keep creating.");
renderer.setAnimationLoop(() => {
  orbit.update();
  if (selectionBox.visible && selectedMesh())
    selectionBox.setFromObject(selectedMesh());
  composer.render();
});
