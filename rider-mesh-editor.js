import * as THREE from "three";
import { meshTopology, componentVertices, selectedTriangles, extrudeMeshFaces, subdivideMeshFaces, deleteMeshComponents } from "./rider-mesh.js";

/** Component editing stays separate from whole-object transforms and animation. */
export function createMeshEditor({ scene, camera, renderer, gizmo, selectedMesh, selectedRecord, pauseAnimation,
  persistGeometry, commit, notify, refreshStats, syncInspector }) {
  const $ = (id) => document.getElementById(id);
  const pivot = new THREE.Object3D(), overlay = new THREE.Group();
  overlay.matrixAutoUpdate = false;
  scene.add(pivot, overlay);
  let mode = "object", topology = null, selection = new Set(), drag = null;
  const editable = () => selectedMesh()?.isMesh && !["meta", "light"].includes(selectedRecord()?.type) &&
    selectedRecord()?.visible && !selectedRecord()?.locked;
  const ids = () => topology ? componentVertices(topology, mode, selection) : [];
  const center = () => {
    const points = ids(), result = new THREE.Vector3();
    for (const i of points) result.add(topology.vertices[i].point);
    return points.length ? result.divideScalar(points.length) : result;
  };
  function clearOverlay() {
    for (const child of [...overlay.children]) {
      overlay.remove(child); child.geometry.dispose(); child.material.dispose();
    }
  }
  function geometry(points) { return new THREE.BufferGeometry().setFromPoints(points); }
  function refreshOverlay() {
    clearOverlay();
    if (mode === "object" || !topology || !editable()) return;
    const mesh = selectedMesh();
    mesh.updateMatrixWorld(true); overlay.matrix.copy(mesh.matrixWorld);
    for (const vertex of topology.vertices) vertex.point.fromBufferAttribute(mesh.geometry.getAttribute("position"), vertex.raw[0]);
    const selectedVertices = new Set(ids());
    const point = (i) => topology.vertices[i].point;
    const xray = $("meshXray").checked;
    const lines = new THREE.LineSegments(geometry(topology.edges.flatMap((edge) => edge.vertices.map(point))),
      new THREE.LineBasicMaterial({ color: 0x9994b0, transparent: true, opacity: .55, depthTest: !xray }));
    lines.renderOrder = 3; overlay.add(lines);
    if (mode === "vertex") {
      const points = new THREE.Points(geometry(topology.vertices.map((v) => v.point)),
        new THREE.PointsMaterial({ color: 0xd4cbed, size: 7, sizeAttenuation: false, depthTest: !xray }));
      points.renderOrder = 4; overlay.add(points);
    }
    if (selectedVertices.size) {
      const points = new THREE.Points(geometry([...selectedVertices].map(point)),
        new THREE.PointsMaterial({ color: 0xffb65c, size: 10, sizeAttenuation: false, depthTest: !xray }));
      points.renderOrder = 6; overlay.add(points);
    }
    if (mode === "edge" && selection.size) {
      const lines = new THREE.LineSegments(geometry([...selection].flatMap((i) => topology.edges[i].vertices.map(point))),
        new THREE.LineBasicMaterial({ color: 0xffb65c, depthTest: !xray }));
      lines.renderOrder = 5; overlay.add(lines);
    }
    if (mode === "face" && selection.size) {
      const points = [...selectedTriangles(topology, mode, selection)].flatMap((i) => topology.triangles[i].vertices.map(point));
      const faces = new THREE.Mesh(geometry(points), new THREE.MeshBasicMaterial({ color: 0xffb65c, transparent: true, opacity: .4,
        side: THREE.DoubleSide, depthTest: !xray, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      faces.renderOrder = 5; overlay.add(faces);
    }
  }
  function sync() {
    const active = mode !== "object";
    $("meshEditPanel").hidden = !active;
    document.querySelector(".transform-section").hidden = active;
    document.querySelectorAll("[data-component-mode]").forEach((button) => {
      const current = button.dataset.componentMode === mode;
      button.classList.toggle("active", current); button.setAttribute("aria-pressed", String(current));
    });
    if (!active || !topology) return;
    $("shapePanel").hidden = $("textPanel").hidden = true;
    $("meshCounts").textContent = `${topology.vertices.length} V · ${topology.edges.length} E · ${topology.faces.length} F`;
    $("componentStatus").textContent = `${selection.size} ${mode === "vertex" ? (selection.size === 1 ? "vertex" : "vertices") : mode + (selection.size === 1 ? "" : "s")} selected`;
    const position = center();
    ["componentX", "componentY", "componentZ"].forEach((id, i) => {
      if (document.activeElement !== $(id)) $(id).value = Number(position.getComponent(i).toFixed(4));
      $(id).disabled = !selection.size;
    });
    $("extrudeFacesBtn").disabled = $("subdivideFacesBtn").disabled = mode !== "face" || !selection.size;
    $("deleteComponentsBtn").disabled = !selection.size;
    document.querySelectorAll("[data-component-turn],[data-component-scale]").forEach((button) => { button.disabled = !selection.size; });
  }
  function attach() {
    if (mode === "object") return false;
    gizmo.detach();
    if (editable() && selection.size && topology) {
      selectedMesh().updateMatrixWorld(true);
      pivot.position.copy(center().applyMatrix4(selectedMesh().matrixWorld));
      pivot.rotation.set(0, 0, 0); pivot.scale.set(1, 1, 1); pivot.updateMatrixWorld(true);
      gizmo.attach(pivot);
    }
    return true;
  }
  function update() { refreshOverlay(); sync(); if (!drag) attach(); }
  function setMode(next) {
    if (next !== "object" && !editable()) {
      notify("Select an unlocked, visible shape or imported mesh first. Text can also be edited as a mesh."); return;
    }
    pauseAnimation();
    mode = next; selection.clear(); drag = null;
    topology = next === "object" ? null : meshTopology(selectedMesh().geometry);
    update();
    if (next === "object" && editable()) gizmo.attach(selectedMesh());
    syncInspector();
  }
  function rememberSelection() {
    if (mode === "face") return [...selectedTriangles(topology, mode, selection)];
    if (mode === "vertex") return [...selection].map((i) => topology.vertices[i].raw[0]);
    return [...selection].map((i) => topology.edges[i].vertices.map((v) => topology.vertices[v].raw[0]));
  }
  function rebuildSelection(remembered) {
    topology = meshTopology(selectedMesh().geometry);
    if (mode === "face") selection = new Set(remembered.map((i) => topology.triangles[i]?.face).filter((i) => i !== undefined));
    else if (mode === "vertex") selection = new Set(remembered.map((raw) => topology.rawToVertex[raw]));
    else {
      const keys = new Set(remembered.map((pair) => pair.map((raw) => topology.rawToVertex[raw]).sort((a, b) => a - b).join(":")));
      selection = new Set(topology.edges.flatMap((edge, i) => keys.has([...edge.vertices].sort((a, b) => a - b).join(":")) ? [i] : []));
    }
  }
  function startTransform() {
    if (mode === "object" || !selection.size || !editable()) return;
    const mesh = selectedMesh(); mesh.updateMatrixWorld(true); pivot.updateMatrixWorld(true);
    // Preserve logical polygons when moving a corner bends a quad, and retain
    // explicit subdivision edges across further edits and project round trips.
    mesh.geometry.userData.riderFaces = topology.triangles.map((triangle) => triangle.face);
    drag = { positions: mesh.geometry.getAttribute("position").array.slice(), inversePivot: pivot.matrixWorld.clone().invert(),
      world: mesh.matrixWorld.clone(), inverseWorld: mesh.matrixWorld.clone().invert(),
      raw: ids().flatMap((i) => topology.vertices[i].raw), selected: rememberSelection() };
  }
  function updateTransform() {
    if (!drag) return;
    pivot.updateMatrixWorld(true);
    const delta = drag.inverseWorld.clone().multiply(pivot.matrixWorld).multiply(drag.inversePivot).multiply(drag.world);
    const position = selectedMesh().geometry.getAttribute("position"), point = new THREE.Vector3();
    for (const raw of drag.raw) {
      point.fromArray(drag.positions, raw * 3).applyMatrix4(delta);
      position.setXYZ(raw, point.x, point.y, point.z);
    }
    position.needsUpdate = true;
    selectedMesh().geometry.computeVertexNormals();
    selectedMesh().geometry.computeBoundingBox(); selectedMesh().geometry.computeBoundingSphere();
    refreshOverlay(); sync();
  }
  function finishTransform() {
    if (!drag) return;
    const previous = drag; drag = null;
    const positions = selectedMesh().geometry.getAttribute("position").array;
    if (!previous.raw.some((raw) => [0, 1, 2].some((i) => positions[raw * 3 + i] !== previous.positions[raw * 3 + i]))) {
      update(); return;
    }
    try { persistGeometry(selectedMesh().geometry); rebuildSelection(previous.selected); commit(); }
    catch (error) {
      selectedMesh().geometry.getAttribute("position").array.set(previous.positions);
      selectedMesh().geometry.getAttribute("position").needsUpdate = true;
      selectedMesh().geometry.computeVertexNormals(); selectedMesh().geometry.computeBoundingBox(); selectedMesh().geometry.computeBoundingSphere();
      rebuildSelection(previous.selected); notify(error.message);
    }
    refreshStats(); syncInspector(); update();
  }
  function applyLocalTransform(matrix) {
    if (!selection.size || !editable()) return;
    startTransform();
    pivot.matrix.copy(drag.world).multiply(matrix).multiply(drag.inverseWorld).multiply(drag.inversePivot.clone().invert());
    pivot.matrix.decompose(pivot.position, pivot.quaternion, pivot.scale);
    updateTransform(); finishTransform();
  }
  ["componentX", "componentY", "componentZ"].forEach((id, axis) => $(id).addEventListener("change", () => {
    const value = Number($(id).value);
    if (!Number.isFinite(value) || Math.abs(value) > 10000 || !selection.size) { sync(); return; }
    const offset = new THREE.Vector3(); offset.setComponent(axis, value - center().getComponent(axis));
    applyLocalTransform(new THREE.Matrix4().makeTranslation(offset));
  }));
  document.querySelectorAll("[data-component-turn],[data-component-scale]").forEach((button) => button.addEventListener("click", () => {
    if (!selection.size || !editable()) return;
    startTransform();
    if (button.dataset.componentTurn) pivot.rotation.y += Number(button.dataset.componentTurn);
    else pivot.scale.multiplyScalar(Number(button.dataset.componentScale));
    updateTransform(); finishTransform();
  }));
  function operation(kind) {
    if (!editable() || !topology || !selection.size) return;
    let result;
    try {
      const mesh = selectedMesh();
      if (kind === "extrude") result = extrudeMeshFaces(mesh.geometry, topology, selection, Number($("extrudeDistance").value));
      else if (kind === "subdivide") result = subdivideMeshFaces(mesh.geometry, topology, selection);
      else result = deleteMeshComponents(mesh.geometry, topology, mode, selection);
      persistGeometry(result.geometry);
      const old = mesh.geometry; mesh.geometry = result.geometry; old.dispose();
      if (kind === "delete") { topology = meshTopology(mesh.geometry); selection.clear(); }
      else rebuildSelection(result.selectedTriangles);
      refreshStats(); syncInspector(); update(); commit("Mesh " + (kind === "delete" ? "components deleted" : kind === "extrude" ? "faces extruded" : "faces subdivided"));
    } catch (error) { result?.geometry.dispose(); notify(error.message); }
  }
  $("selectAllComponentsBtn").addEventListener("click", () => {
    if (!topology) return;
    const count = (mode === "vertex" ? topology.vertices : mode === "edge" ? topology.edges : topology.faces).length;
    selection = new Set(Array.from({ length: count }, (_, i) => i)); update();
  });
  $("clearComponentsBtn").addEventListener("click", () => { selection.clear(); update(); });
  $("meshXray").addEventListener("change", refreshOverlay);
  $("extrudeFacesBtn").addEventListener("click", () => operation("extrude"));
  $("subdivideFacesBtn").addEventListener("click", () => operation("subdivide"));
  $("deleteComponentsBtn").addEventListener("click", () => operation("delete"));
  $("exitMeshEditBtn").addEventListener("click", () => setMode("object"));
  document.querySelectorAll("[data-component-mode]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.componentMode)));

  function pick(event, ray) {
    if (mode === "object") return false;
    if (!editable() || !topology) return true;
    const mesh = selectedMesh(); mesh.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    let hitIndex = null;
    if (mode === "face") {
      const hit = ray.intersectObject(mesh)[0];
      if (hit) hitIndex = topology.triangles[hit.faceIndex]?.face;
    } else {
      const rect = renderer.domElement.getBoundingClientRect();
      const cursor = new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top);
      const project = (point) => {
        const p = point.clone().applyMatrix4(mesh.matrixWorld).project(camera);
        return { screen: new THREE.Vector2((p.x + 1) * rect.width / 2, (1 - p.y) * rect.height / 2), depth: p.z };
      };
      let bestDistance = 13, bestDepth = Infinity;
      const candidates = mode === "vertex" ? topology.vertices : topology.edges;
      candidates.forEach((candidate, index) => {
        let local, screen, depth;
        if (mode === "vertex") {
          local = candidate.point; ({ screen, depth } = project(local));
        } else {
          const a = topology.vertices[candidate.vertices[0]].point, b = topology.vertices[candidate.vertices[1]].point;
          const pa = project(a), pb = project(b), direction = pb.screen.clone().sub(pa.screen);
          const t = THREE.MathUtils.clamp(cursor.clone().sub(pa.screen).dot(direction) / (direction.lengthSq() || 1), 0, 1);
          screen = pa.screen.clone().lerp(pb.screen, t); depth = pa.depth + (pb.depth - pa.depth) * t;
          // Unproject the screen point so perspective edges use the correct depth.
          local = new THREE.Vector3(screen.x / rect.width * 2 - 1, 1 - screen.y / rect.height * 2, depth).unproject(camera).applyMatrix4(mesh.matrixWorld.clone().invert());
        }
        const distance = screen.distanceTo(cursor);
        if (depth < -1 || depth > 1 || distance > bestDistance + .5) return;
        if (!$("meshXray").checked) {
          const world = local.clone().applyMatrix4(mesh.matrixWorld);
          const occlusion = new THREE.Raycaster(camera.position, world.clone().sub(camera.position).normalize()).intersectObject(mesh)[0];
          if (occlusion && occlusion.distance < camera.position.distanceTo(world) - 0.002) return;
        }
        if (distance < bestDistance - .5 || depth < bestDepth) { bestDistance = distance; bestDepth = depth; hitIndex = index; }
      });
    }
    const add = event.shiftKey || $("meshMultiSelect").checked;
    if (!add) selection.clear();
    if (hitIndex !== null && hitIndex !== undefined) {
      if (add && selection.has(hitIndex)) selection.delete(hitIndex); else selection.add(hitIndex);
    }
    update(); return true;
  }
  return {
    get mode() { return mode; }, setMode, attach, pick, startTransform, updateTransform, finishTransform,
    sync, refreshPose: update, setVisible(visible) { overlay.visible = visible; },
    onObjectSelection() {
      drag = null; selection.clear();
      if (mode !== "object" && editable()) topology = meshTopology(selectedMesh().geometry);
      else { mode = "object"; topology = null; }
      update();
    },
    selectAll() { $("selectAllComponentsBtn").click(); },
    deleteSelection() { operation("delete"); },
    clearSelection() { selection.clear(); update(); },
  };
}
